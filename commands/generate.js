const fs = require("fs");
const path = require("path");
const git = require("isomorphic-git");
const diff = require("diff");
const { getConfig } = require("../utils/config");
const { DEFAULT_PROJECT_DIR } = require("../utils/const");
const logger = require("../utils/logger");

module.exports = async function generate(parsed) {
    logger.info("Generating patch...");

    const config = getConfig();
    const projectDir = parsed.options.dir || parsed.options.d || config.projectDir || DEFAULT_PROJECT_DIR;

    if (!fs.existsSync(path.join(projectDir, ".git"))) {
        logger.error(`Error: The directory ${projectDir} is not a Git repository.`);
        process.exit(1);
    }

    const commitsOpt = parsed.options.commits || parsed.options.c;
    const outputOpt = parsed.options.output || parsed.options.o || "ptero.patch";

    let ref1 = "HEAD";
    let ref2 = null; // represents working directory if null

    if (commitsOpt) {
        if (commitsOpt.includes("..")) {
            const parts = commitsOpt.split("..");
            ref1 = parts[0] || "HEAD";
            ref2 = parts[1] || "HEAD";
        } else {
            ref1 = commitsOpt;
        }
    }

    try {
        logger.info(`Analyzing repository changes in: ${projectDir}`);
        let trees = [];
        if (ref2) {
            logger.info(`Comparing commits: ${ref1} .. ${ref2}`);
            const oid1 = await git.resolveRef({ fs, dir: projectDir, ref: ref1 });
            const oid2 = await git.resolveRef({ fs, dir: projectDir, ref: ref2 });
            trees = [git.TREE({ ref: oid1 }), git.TREE({ ref: oid2 })];
        } else {
            logger.info(`Comparing HEAD commit against working directory...`);
            const oid1 = await git.resolveRef({ fs, dir: projectDir, ref: ref1 });
            trees = [git.TREE({ ref: oid1 }), git.WORKDIR()];
        }

        const patchBlocks = [];

        await git.walk({
            fs,
            dir: projectDir,
            trees,
            map: async function(filepath, [A, B]) {
                // Skip directories and git internals
                if (filepath === "." || filepath.startsWith(".git/")) return;
                const typeA = A ? await A.type() : null;
                const typeB = B ? await B.type() : null;

                if (typeA === "tree" || typeB === "tree") {
                    return; // Skip walking directory names themselves
                }

                const oidA = A ? await A.oid() : null;
                const oidB = B ? await B.oid() : null;

                if (oidA === oidB) {
                    return; // No change
                }

                // Retrieve contents
                let contentA = "";
                if (A) {
                    const blob = await A.content();
                    contentA = Buffer.from(blob).toString("utf8");
                }

                let contentB = "";
                if (B) {
                    if (ref2) {
                        const blob = await B.content();
                        contentB = Buffer.from(blob).toString("utf8");
                    } else {
                        // Working directory file
                        const absolutePath = path.join(projectDir, filepath);
                        if (fs.existsSync(absolutePath)) {
                            contentB = fs.readFileSync(absolutePath, "utf8");
                        }
                    }
                }

                const fileA = A ? "a/" + filepath : "/dev/null";
                const fileB = B ? "b/" + filepath : "/dev/null";

                const patchStr = diff.createTwoFilesPatch(fileA, fileB, contentA, contentB, "", "", { context: 3 });
                // Only push if there's actual diff content
                if (patchStr && patchStr.trim().length > 0) {
                    patchBlocks.push(patchStr);
                }
            }
        });

        if (patchBlocks.length === 0) {
            logger.info("No changes detected. Patch file not created.");
            return;
        }

        const patchContent = patchBlocks.join("\n");
        const outputPath = path.isAbsolute(outputOpt) ? outputOpt : path.join(process.cwd(), outputOpt);
        fs.writeFileSync(outputPath, patchContent, "utf8");
        logger.info(`Patch file successfully created at: ${outputPath}`);
    } catch (err) {
        logger.error("Error generating patch:", err.message);
        process.exit(1);
    }
};
