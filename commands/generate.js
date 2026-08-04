const fs = require("fs");
const path = require("path");
const git = require("isomorphic-git");
const diff = require("diff");
const { getConfig } = require("../utils/config");
const { DEFAULT_PROJECT_DIR, DEFAULT_PATCHES_DIR } = require("../utils/const");
const logger = require("../utils/logger");
const { getPatchHash } = require("../utils/hash");

function padZero(num, size = 4) {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

function sanitizeName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric chars with hyphen
        .replace(/^-+|-+$/g, "");    // trim leading/trailing hyphens
}

function formatPatchFilename(seqStr, commitHash, title, typeSuffix) {
    const separator = "-";
    const prefix = `${seqStr}`;
    const suffix = `${typeSuffix}`;
    const gitCommitHash = (commitHash || "00000000").substring(0, 8);
    const slug = title.substring(0, 8);
    return `${prefix}${separator}${gitCommitHash}${separator}${slug}${separator}${suffix}`;
}

async function resolveCommitRef(projectDir, ref) {
    // Handle relative refs like HEAD~1 or HEAD^
    const match = ref.match(/^(.*)(?:~|\^)(\d*)$/);
    let baseRef = ref;
    let parentsToWalk = 0;
    if (match) {
        baseRef = match[1] || "HEAD";
        parentsToWalk = match[2] ? parseInt(match[2], 10) : 1;
    } else if (ref.endsWith("~") || ref.endsWith("^")) {
        baseRef = ref.slice(0, -1) || "HEAD";
        parentsToWalk = 1;
    }

    let oid = await git.resolveRef({ fs, dir: projectDir, ref: baseRef });
    for (let i = 0; i < parentsToWalk; i++) {
        const commit = await git.readCommit({ fs, dir: projectDir, oid });
        if (commit.commit.parent && commit.commit.parent.length > 0) {
            oid = commit.commit.parent[0];
        } else {
            throw new Error(`Commit ${oid} has no parent (reached root commit during resolution of ${ref})`);
        }
    }
    return oid;
}

module.exports = async function generate(parsed) {
    logger.info("Generating patch...");

    const config = getConfig();
    const projectDir = parsed.options.dir || parsed.options.d || config.projectDir || DEFAULT_PROJECT_DIR;

    if (!fs.existsSync(path.join(projectDir, ".git"))) {
        logger.error(`Error: The directory ${projectDir} is not a Git repository.`);
        process.exit(1);
    }

    const commitsOpt = parsed.options.commits || parsed.options.commit || parsed.options.c;
    if (!commitsOpt || !commitsOpt.includes("..")) {
        logger.error("Error: Please specify a commit range using '..' (e.g. HEAD~1..HEAD or HEAD..HEAD).");
        logger.info("Usage: ptero-patch generate --commits <commit1>..<commit2>");
        process.exit(1);
    }

    const defaultOutput = config.patchesDir || DEFAULT_PATCHES_DIR;
    const isDefault = !parsed.options.output && !parsed.options.o;
    const outputOpt = parsed.options.output || parsed.options.o || defaultOutput;

    const parts = commitsOpt.split("..");
    const ref1 = parts[0] || "HEAD";
    const ref2 = parts[1] || "HEAD";

    // Determine output directory and base prefix
    let outDir = process.cwd();
    let baseName = "patch";

    const resolvedOutput = path.isAbsolute(outputOpt) ? outputOpt : path.join(process.cwd(), outputOpt);
    let isDir = isDefault;
    try {
        const stats = fs.existsSync(resolvedOutput) ? fs.statSync(resolvedOutput) : null;
        if (stats && stats.isDirectory()) {
            isDir = true;
        }
    } catch (e) {
        // ignore
    }

    if (isDir) {
        outDir = resolvedOutput;
    } else {
        outDir = path.dirname(resolvedOutput);
        baseName = path.basename(resolvedOutput).replace(/\.(patch|diff)$/i, "");
    }

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    try {
        logger.info(`Analyzing repository changes in: ${projectDir}`);

        let workQueue = []; // list of { title: string, trees: Array, isWorkdir: boolean }

        logger.info(`Comparing commits range: ${ref1} .. ${ref2}`);
        const oid1 = await resolveCommitRef(projectDir, ref1);
        const oid2 = await resolveCommitRef(projectDir, ref2);
        const log = await git.log({ fs, dir: projectDir, ref: oid2 });

        const commitList = [];
        for (const commit of log) {
            if (commit.oid === oid1) {
                break;
            }
            commitList.push(commit);
        }
        commitList.reverse(); // oldest first

        if (commitList.length === 0) {
            logger.info("No commits found in the specified range.");
            return;
        }

        for (const commit of commitList) {
            const title = sanitizeName(commit.commit.message.split("\n")[0]) || "commit";
            const parentRef = commit.commit.parent && commit.commit.parent.length > 0 ? commit.commit.parent[0] : null;
            
            let trees;
            if (parentRef) {
                trees = [git.TREE({ ref: parentRef }), git.TREE({ ref: commit.oid })];
            } else {
                trees = [git.TREE({ ref: commit.oid })]; // root commit
            }

            workQueue.push({
                title,
                trees,
                oid: commit.oid,
                isWorkdir: false
            });
        }

        let sequenceNum = 1;

        for (const step of workQueue) {
            const addedDiffs = [];
            const modifiedDiffs = [];

            await git.walk({
                fs,
                dir: projectDir,
                trees: step.trees,
                map: async function(filepath, treesList) {
                    // Skip directories and git internals
                    if (filepath === "." || filepath.startsWith(".git/")) return;

                    // If treesList has parent and child
                    const hasParent = treesList.length > 1;
                    const A = hasParent ? treesList[0] : null;
                    const B = hasParent ? treesList[1] : treesList[0];

                    const typeA = A ? await A.type() : null;
                    const typeB = B ? await B.type() : null;

                    if (typeA === "tree" || typeB === "tree") return;

                    const oidA = A ? await A.oid() : null;
                    const oidB = B ? await B.oid() : null;

                    if (oidA === oidB) return; // No change

                    // Retrieve contents
                    let contentA = "";
                    if (A) {
                        const blob = await A.content();
                        contentA = Buffer.from(blob).toString("utf8");
                    }

                    let contentB = "";
                    if (B) {
                        if (step.isWorkdir) {
                            const absolutePath = path.join(projectDir, filepath);
                            if (fs.existsSync(absolutePath)) {
                                contentB = fs.readFileSync(absolutePath, "utf8");
                            }
                        } else {
                            const blob = await B.content();
                            contentB = Buffer.from(blob).toString("utf8");
                        }
                    }

                    const fileA = A ? "a/" + filepath : "/dev/null";
                    const fileB = B ? "b/" + filepath : "/dev/null";

                    const patchStr = diff.createTwoFilesPatch(fileA, fileB, contentA, contentB, "", "", { context: 3 });
                    if (patchStr && patchStr.trim().length > 0) {
                        // Check if it's an addition (no parent or A was null)
                        const isAddition = !A;
                        if (isAddition) {
                            addedDiffs.push(patchStr);
                        } else {
                            modifiedDiffs.push(patchStr);
                        }
                    }
                }
            });

            // Write added files patch if any
            if (addedDiffs.length > 0) {
                const seqStr = padZero(sequenceNum++);
                const content = addedDiffs.join("\n");
                const hash = getPatchHash(content);
                const filename = formatPatchFilename(seqStr, step.oid, hash, "NEW.patch");
                const filepath = path.join(outDir, filename);
                fs.writeFileSync(filepath, content, "utf8");
                logger.info(`Patch created: ${filename} (at ${outDir})`);
            }

            // Write modified files patch if any
            if (modifiedDiffs.length > 0) {
                const seqStr = padZero(sequenceNum++);
                const content = modifiedDiffs.join("\n");
                const hash = getPatchHash(content);
                const filename = formatPatchFilename(seqStr, step.oid, hash, "MOD.patch");
                const filepath = path.join(outDir, filename);
                fs.writeFileSync(filepath, content, "utf8");
                logger.info(`Patch created: ${filename} (at ${outDir})`);
            }
        }

        logger.info("Patch generation completed.");
    } catch (err) {
        logger.error("Error generating patch:", err.message);
        process.exit(1);
    }
};
