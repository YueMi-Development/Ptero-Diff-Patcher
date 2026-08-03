const fs = require("fs");
const path = require("path");
const tar = require("tar");
const { getConfig } = require("../utils/config");
const { DEFAULT_PROJECT_DIR, DEFAULT_BACKUP_DIR } = require("../utils/const");
const logger = require("../utils/logger");

module.exports = async function snapshot(parsed) {
    const subCommand = parsed._args[0];
    const snapshotName = parsed._args[1];

    const config = getConfig();
    const projectDir = parsed.options.dir || parsed.options.d || config.projectDir || DEFAULT_PROJECT_DIR;
    const backupDir = config.backupDir || DEFAULT_BACKUP_DIR;

    if (!subCommand) {
        logger.error("Error: Please specify a snapshot action: 'list' or 'restore <name>'.");
        logger.info("Usage:\n  ptero-patch snapshot list\n  ptero-patch snapshot restore <name>");
        process.exit(1);
    }

    if (subCommand === "list") {
        logger.info(`Listing snapshots in: ${backupDir}`);
        if (!fs.existsSync(backupDir)) {
            logger.info("No snapshots found (backup directory does not exist).");
            return;
        }

        const files = fs.readdirSync(backupDir).filter(f => f.endsWith(".tar.gz"));
        if (files.length === 0) {
            logger.info("No snapshots found.");
            return;
        }

        logger.info("\nAvailable Snapshots:");
        files.forEach(file => {
            const stats = fs.statSync(path.join(backupDir, file));
            logger.info(`- ${file} (${(stats.size / 1024).toFixed(2)} KB) - Created: ${stats.mtime.toLocaleString()}`);
        });
        logger.info("");
    } else if (subCommand === "restore") {
        if (!snapshotName) {
            logger.error("Error: Please specify the snapshot filename to restore.");
            process.exit(1);
        }

        const snapshotPath = path.isAbsolute(snapshotName) ? snapshotName : path.join(backupDir, snapshotName);
        if (!fs.existsSync(snapshotPath)) {
            logger.error(`Error: Snapshot file does not exist at ${snapshotPath}`);
            process.exit(1);
        }

        logger.info(`Restoring snapshot: ${snapshotPath} to ${projectDir}...`);
        try {
            await tar.x({
                file: snapshotPath,
                C: projectDir
            });
            logger.info("Restore completed successfully.");
        } catch (err) {
            logger.error("Error extracting snapshot:", err.message);
            process.exit(1);
        }
    } else {
        logger.error(`Error: Unknown snapshot action '${subCommand}'.`);
        logger.info("Available actions: 'list', 'restore'");
        process.exit(1);
    }
};
