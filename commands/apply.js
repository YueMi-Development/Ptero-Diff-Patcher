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
    
    const fuzzOpt = parsed.options.fuzz || parsed.options.f;
    const fuzzFactor = fuzzOpt ? parseInt(fuzzOpt, 10) || 0 : 0;

    try {
        let patchSources = [];
        if (patchSource.startsWith("http://") || patchSource.startsWith("https://")) {
            patchSources.push({ type: "url", path: patchSource });
        } else {
            const absolutePath = path.isAbsolute(patchSource) ? patchSource : path.join(process.cwd(), patchSource);
            if (!fs.existsSync(absolutePath)) {
                logger.error(`Error: Path does not exist at ${absolutePath}`);
                process.exit(1);
            }
            const stat = fs.statSync(absolutePath);
            if (stat.isDirectory()) {
                const files = fs.readdirSync(absolutePath)
                    .filter(f => f.endsWith(".patch") || f.endsWith(".diff"))
                    .map(f => path.join(absolutePath, f));

                if (files.length === 0) {
                    logger.error(`Error: No .patch or .diff files found in directory ${absolutePath}`);
                    process.exit(1);
                }

                // Sort alphabetically ascending
                files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                files.forEach(f => patchSources.push({ type: "file", path: f }));
            } else {
                patchSources.push({ type: "file", path: absolutePath });
            }
        }

        // Virtual file cache to process patch updates one-by-one in memory
        const fileCache = {};

        function getFileContent(absPath) {
            if (fileCache[absPath]) {
                return fileCache[absPath].content;
            }
            const exists = fs.existsSync(absPath);
            const content = exists ? fs.readFileSync(absPath, "utf8") : "";
            fileCache[absPath] = {
                content,
                exists,
                originalContent: content,
                dirty: false
            };
            return content;
        }

        for (const sourceItem of patchSources) {
            logger.info(`Loading patch from: ${sourceItem.path}`);
            let patchContent = "";
            if (sourceItem.type === "url") {
                const response = await axios.get(sourceItem.path, { responseType: "text" });
                patchContent = response.data;
            } else {
                patchContent = fs.readFileSync(sourceItem.path, "utf8");
            }

            let parsed = diff.parsePatch(patchContent);
            if (parsed.length === 0) {
                logger.warn(`Warning: Could not parse any valid patches from ${sourceItem.path}`);
                continue;
            }

            if (reverse) {
                logger.info("Reversing patches...");
                parsed = parsed.map(reversePatch);
            }

            for (const p of parsed) {
                const oldFile = p.oldFileName;
                const newFile = p.newFileName;
                const targetFile = (oldFile && oldFile !== "/dev/null") ? oldFile : newFile;
                const relPath = cleanPath(targetFile);
                if (!relPath || relPath === "/dev/null") continue;

                const absPath = path.join(projectDir, relPath);
                const originalContent = getFileContent(absPath);

                const patchedResult = diff.applyPatch(originalContent, p, { fuzzFactor });
                if (patchedResult === false) {
                    logger.error(`[FAIL] Conflict: Could not apply patch from ${path.basename(sourceItem.path)} to ${relPath}`);
                    process.exit(1);
                }

                fileCache[absPath].content = patchedResult;
                fileCache[absPath].dirty = true;
                fileCache[absPath].relativePath = relPath;
                logger.info(`[OK] Applied patch step to ${relPath}`);
            }
        }

        // Identify modified/new files
        const modifiedFiles = Object.keys(fileCache).filter(key => fileCache[key].dirty);
        if (modifiedFiles.length === 0) {
            logger.info("No modifications to apply.");
            return;
        }

        // 2. Perform Backup Snapshot of existing original files
        if (!dryRun && !noBackup) {
            const filesToBackup = modifiedFiles
                .filter(key => fileCache[key].exists)
                .map(key => fileCache[key].relativePath);

            if (filesToBackup.length > 0) {
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
        }

        // 3. Write changes to disk if not dry-run
        if (!dryRun) {
            for (const absPath of modifiedFiles) {
                const cacheObj = fileCache[absPath];
                const dirOfFile = path.dirname(absPath);
                if (!fs.existsSync(dirOfFile)) {
                    fs.mkdirSync(dirOfFile, { recursive: true });
                }
                fs.writeFileSync(absPath, cacheObj.content, "utf8");
                logger.info(`[WRITE] Saved changes to ${cacheObj.relativePath}`);
            }
            logger.info("\nAll patches successfully applied to files.");
        } else {
            logger.info("\nDry-run complete. All patches can be applied cleanly without errors.");
        }

    } catch (err) {
        logger.error("Error during patch application:", err.message);
        process.exit(1);
    }
};
