const { getConfig, writeConfig } = require("../utils/config");
const { DEFAULT_PROJECT_DIR, DEFAULT_BACKUP_DIR, DEFAULT_PATCHES_DIR } = require("../utils/const");
const logger = require("../utils/logger");

module.exports = async function init(parsed) {
    logger.info("Initializing Pterodactyl Diff Patcher config...");

    const currentConfig = getConfig();

    const projectDir = parsed.options["project-dir"] || parsed.options.p || currentConfig.projectDir || DEFAULT_PROJECT_DIR;
    const backupDir = parsed.options["backup-dir"] || parsed.options.b || currentConfig.backupDir || DEFAULT_BACKUP_DIR;
    const patchesDir = parsed.options["patches-dir"] || parsed.options.d || currentConfig.patchesDir || DEFAULT_PATCHES_DIR;

    const newConfig = {
        projectDir,
        backupDir,
        patchesDir
    };

    const success = writeConfig(newConfig);
    if (success) {
        logger.info("\nConfiguration saved successfully.");
        logger.info(`Pterodactyl Project Directory: ${projectDir}`);
        logger.info(`Backup/Snapshot Directory:     ${backupDir}`);
        logger.info(`Patches Directory:             ${patchesDir}`);
    } else {
        logger.error("Failed to save configuration.");
    }
};
