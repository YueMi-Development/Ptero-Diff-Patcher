const fs = require("fs");
const path = require("path");
const axios = require("axios");
const diff = require("diff");
const tar = require("tar");
const { getPatchHash } = require("../utils/hash");
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

function getAppliedPatches(projectDir) {
    const statePath = path.join(projectDir, ".ptero-applied-patches.json");
    if (!fs.existsSync(statePath)) {
        return { applied: [] };
    }
    try {
        const fileContent = fs.readFileSync(statePath, "utf8");
        return JSON.parse(fileContent) || { applied: [] };
    } catch (e) {
        return { applied: [] };
    }
}

function saveAppliedPatches(projectDir, state) {
    const statePath = path.join(projectDir, ".ptero-applied-patches.json");
    try {
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
    } catch (e) {
        logger.error(`Failed to save applied patch state: ${e.message}`);
    }
}

module.exports = async function apply(parsed) {
    const patchSource = parsed._args[0];
    if (!patchSource) {
        throw new Error("Please specify a patch file path or URL.");
    }

    const config = getConfig();
    const projectDir = parsed.options.dir || parsed.options.d || config.projectDir || DEFAULT_PROJECT_DIR;
    const backupDir = config.backupDir || DEFAULT_BACKUP_DIR;

    const dryRun = !!(parsed.options["dry-run"] || parsed.options.dryRun);
    const noBackup = !!(parsed.options["no-backup"] || parsed.options.noBackup);
    const isUndo = parsed._command === "undo" || !!parsed.options.undo;
    const reverse = isUndo || !!(parsed.options.reverse || parsed.options.R);
    const force = !!parsed.options.force;

    const noFuzzy = !!(parsed.options["no-fuzzy"] || parsed.options.noFuzzy);
    const noIntegrity = !!(parsed.options["no-integrity"] || parsed.options.noIntegrity);
    const fuzzOpt = parsed.options.fuzz || parsed.options.f;
    const maxFuzz = noFuzzy ? 0 : (fuzzOpt !== undefined ? parseInt(fuzzOpt, 10) || 0 : 3);

    try {
        let patchSources = [];
        if (patchSource.startsWith("http://") || patchSource.startsWith("https://")) {
            patchSources.push({ type: "url", path: patchSource });
        } else {
            const absolutePath = path.isAbsolute(patchSource) ? patchSource : path.join(process.cwd(), patchSource);
            if (!fs.existsSync(absolutePath)) {
                throw new Error(`Path does not exist at ${absolutePath}`);
            }
            const stat = fs.statSync(absolutePath);
            if (stat.isDirectory()) {
                const files = fs.readdirSync(absolutePath)
                    .filter(f => f.endsWith(".patch") || f.endsWith(".diff"))
                    .map(f => path.join(absolutePath, f));

                if (files.length === 0) {
                    throw new Error(`No .patch or .diff files found in directory ${absolutePath}`);
                }

                // Sort alphabetically ascending
                files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                files.forEach(f => patchSources.push({ type: "file", path: f }));
            } else {
                patchSources.push({ type: "file", path: absolutePath });
            }
        }

        if (reverse) {
            patchSources.reverse();
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
                dirty: false,
                deleted: false
            };
            return content;
        }

        const appliedState = getAppliedPatches(projectDir);
        const newlyApplied = [];

        for (const sourceItem of patchSources) {
            let patchContent = "";
            if (sourceItem.type === "url") {
                logger.info(`Loading patch from: ${sourceItem.path}`);
                const response = await axios.get(sourceItem.path, { responseType: "text" });
                patchContent = response.data;
            } else {
                patchContent = fs.readFileSync(sourceItem.path, "utf8");
            }

            const hash = getPatchHash(patchContent);
            const patchIdentifier = sourceItem.type === "url" ? sourceItem.path : path.basename(sourceItem.path);

            if (sourceItem.type !== "url" && !noIntegrity) {
                const match = patchIdentifier.match(/^\d{4}-[a-f0-9]{8}-([a-f0-9]{8})-(NEW|MOD)\.patch$/i);
                if (match) {
                    const expectedHashPrefix = match[1].toLowerCase();
                    const actualHashPrefix = hash.substring(0, 8).toLowerCase();
                    if (actualHashPrefix !== expectedHashPrefix) {
                        throw new Error(`Integrity check failed: patch content hash prefix '${actualHashPrefix}' does not match filename expected '${expectedHashPrefix}' for ${patchIdentifier}`);
                    }
                }
            }

            const alreadyApplied = appliedState.applied.some(item => item.hash === hash);

            if (isUndo) {
                if (!alreadyApplied && !force) {
                    throw new Error(`Patch is not marked as applied: ${patchIdentifier}. Use --force to proceed anyway.`);
                }
            } else {
                if (alreadyApplied && !force) {
                    logger.info(`Skipping patch (already applied): ${patchIdentifier}`);
                    continue;
                }
            }

            let parsed = diff.parsePatch(patchContent);
            if (parsed.length === 0) {
                logger.warn(`Warning: Could not parse any valid patches from ${patchIdentifier}`);
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

                const isDeletion = newFile === "/dev/null";
                if (isDeletion) {
                    fileCache[absPath].content = "";
                    fileCache[absPath].dirty = true;
                    fileCache[absPath].deleted = true;
                    fileCache[absPath].relativePath = relPath;
                    logger.info(`[OK] Applied patch step to delete ${relPath} (fuzz: 0)`);
                    continue;
                }

                fileCache[absPath].deleted = false;

                let patchedResult = false;
                let appliedFuzz = 0;
                for (let f = 0; f <= maxFuzz; f++) {
                    patchedResult = diff.applyPatch(originalContent, p, { fuzzFactor: f });
                    if (patchedResult !== false) {
                        appliedFuzz = f;
                        break;
                    }
                }

                if (patchedResult === false) {
                    throw new Error(`Conflict: Could not apply patch from ${patchIdentifier} to ${relPath} (tried fuzz 0 to ${maxFuzz})`);
                }

                fileCache[absPath].content = patchedResult;
                fileCache[absPath].dirty = true;
                fileCache[absPath].relativePath = relPath;
                logger.info(`[OK] Applied patch step to ${relPath} (fuzz: ${appliedFuzz})`);
            }

            if (isUndo) {
                newlyApplied.push({ action: "remove", hash });
            } else {
                newlyApplied.push({
                    action: "add",
                    item: {
                        source: patchIdentifier,
                        hash,
                        appliedAt: new Date().toISOString()
                    }
                });
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
                if (cacheObj.deleted) {
                    if (fs.existsSync(absPath)) {
                        fs.unlinkSync(absPath);
                        logger.info(`[DELETE] Deleted ${cacheObj.relativePath}`);
                    }
                    continue;
                }
                const dirOfFile = path.dirname(absPath);
                if (!fs.existsSync(dirOfFile)) {
                    fs.mkdirSync(dirOfFile, { recursive: true });
                }
                fs.writeFileSync(absPath, cacheObj.content, "utf8");
                logger.info(`[WRITE] Saved changes to ${cacheObj.relativePath}`);
            }

            // Persist the newly applied/removed patches to state file
            for (const actionItem of newlyApplied) {
                if (actionItem.action === "add") {
                    appliedState.applied.push(actionItem.item);
                } else if (actionItem.action === "remove") {
                    appliedState.applied = appliedState.applied.filter(item => item.hash !== actionItem.hash);
                }
            }
            saveAppliedPatches(projectDir, appliedState);

            logger.info("\nAll patches successfully applied to files.");
        } else {
            logger.info("\nDry-run complete. All patches can be applied cleanly without errors.");
        }

    } catch (err) {
        logger.error("Error during patch application:", err.message);
        throw err;
    }
};
