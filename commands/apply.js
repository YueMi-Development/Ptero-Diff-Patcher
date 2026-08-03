const fs = require("fs");
const path = require("path");
const axios = require("axios");
const diff = require("diff");
const tar = require("tar");
const { getConfig } = require("../utils/config");
const { DEFAULT_PROJECT_DIR, DEFAULT_BACKUP_DIR } = require("../utils/const");
const logger = require("../utils/logger");

function cleanPath(p) {
    if (!p) return "";
    return p.replace(/^[ab]\//, "");
}

function reversePatch(patch) {
    return {
        ...patch,
        oldFileName: patch.newFileName,
        newFileName: patch.oldFileName,
        hunks: patch.hunks.map(hunk => {
            return {
                ...hunk,
                oldStart: hunk.newStart,
                oldLines: hunk.newLines,
                newStart: hunk.oldStart,
                newLines: hunk.oldLines,
                lines: hunk.lines.map(line => {
                    if (line.startsWith("+")) {
                        return "-" + line.slice(1);
                    } else if (line.startsWith("-")) {
                        return "+" + line.slice(1);
                    }
                    return line;
                })
            };
        })
    };
}

module.exports = async function apply(parsed) {
    const patchSource = parsed._args[0];
    if (!patchSource) {
        logger.error("Error: Please specify a patch file path or URL.");
        logger.info("Usage: ptero-patch apply <patch-file-or-url> [options]");
        process.exit(1);
    }

    const config = getConfig();
    const projectDir = parsed.options.dir || parsed.options.d || config.projectDir || DEFAULT_PROJECT_DIR;
    const backupDir = config.backupDir || DEFAULT_BACKUP_DIR;

    const dryRun = !!(parsed.options["dry-run"] || parsed.options.dryRun);
    const noBackup = !!(parsed.options["no-backup"] || parsed.options.noBackup);
    const reverse = !!(parsed.options.reverse || parsed.options.R);

    try {
        logger.info(`Loading patch from: ${patchSource}`);
        let patchContent = "";
        if (patchSource.startsWith("http://") || patchSource.startsWith("https://")) {
            const response = await axios.get(patchSource, { responseType: "text" });
            patchContent = response.data;
        } else {
            const absolutePatchPath = path.isAbsolute(patchSource) ? patchSource : path.join(process.cwd(), patchSource);
            if (!fs.existsSync(absolutePatchPath)) {
                logger.error(`Error: Patch file does not exist at ${absolutePatchPath}`);
                process.exit(1);
            }
            patchContent = fs.readFileSync(absolutePatchPath, "utf8");
        }

        let patches = diff.parsePatch(patchContent);
        if (patches.length === 0) {
            logger.error("Error: Could not parse any valid patches from the input source.");
            process.exit(1);
        }

        if (reverse) {
            console.log("Reversing patches...");
            patches = patches.map(reversePatch);
        }

        // 1. Identify files to modify and back up
        const filesToBackup = [];
        const filesToPatch = []; // list of { patch, relativePath, absolutePath, exists }

        for (const p of patches) {
            const oldFile = p.oldFileName;
            const newFile = p.newFileName;
            const targetFile = (oldFile && oldFile !== "/dev/null") ? oldFile : newFile;
            const relPath = cleanPath(targetFile);
            if (!relPath || relPath === "/dev/null") continue;

            const absPath = path.join(projectDir, relPath);
            const exists = fs.existsSync(absPath);

            filesToPatch.push({
                patch: p,
                relativePath: relPath,
                absolutePath: absPath,
                exists
            });

            if (exists) {
                filesToBackup.push(relPath);
            }
        }

        // 2. Perform Backup Archiving
        if (!dryRun && !noBackup && filesToBackup.length > 0) {
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const backupFilename = `backup-${timestamp}.tar.gz`;
            const backupPath = path.join(backupDir, backupFilename);

            logger.info(`Archiving ${filesToBackup.length} original file(s) into: ${backupPath}`);
            await tar.c(
                {
                    gzip: true,
                    file: backupPath,
                    cwd: projectDir
                },
                filesToBackup
            );
            logger.info("Snapshot successfully created.");
        }

        // 3. Dry-Run / Test Patch Application
        logger.info(dryRun ? "Simulating patch application (dry-run)..." : "Applying patches...");
        const results = [];
        let hasFailures = false;

        for (const fileObj of filesToPatch) {
            let originalContent = "";
            if (fileObj.exists) {
                originalContent = fs.readFileSync(fileObj.absolutePath, "utf8");
            }

            const patchedResult = diff.applyPatch(originalContent, fileObj.patch);
            if (patchedResult === false) {
                logger.error(`[FAIL] Conflict: Could not apply patch to ${fileObj.relativePath}`);
                hasFailures = true;
            } else {
                results.push({
                    fileObj,
                    content: patchedResult
                });
                logger.info(`[OK] ${dryRun ? "Can patch" : "Patched"} ${fileObj.relativePath}`);
            }
        }

        if (hasFailures) {
            logger.error("\nError: Patch application encountered conflicts. No changes written.");
            process.exit(1);
        }

        // 4. Write changes to disk if not dry-run
        if (!dryRun) {
            for (const res of results) {
                const dirOfFile = path.dirname(res.fileObj.absolutePath);
                if (!fs.existsSync(dirOfFile)) {
                    fs.mkdirSync(dirOfFile, { recursive: true });
                }
                fs.writeFileSync(res.fileObj.absolutePath, res.content, "utf8");
            }
            logger.info("\nAll patches successfully applied to files.");
        } else {
            logger.info("\nDry-run complete. Patch can be applied cleanly without errors.");
        }

    } catch (err) {
        logger.error("Error during patch application:", err.message);
        process.exit(1);
    }
};
