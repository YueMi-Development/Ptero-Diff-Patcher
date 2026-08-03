const path = require("path");

const OS_ROOT_DIR = "/";
const OS_VAR_DIR = path.join(OS_ROOT_DIR, "var");
const OS_VAR_LIB_DIR = path.join(OS_VAR_DIR, "lib");
const OS_VAR_WEB_DIR = path.join(OS_VAR_DIR, "www");

const PTERODACTYL_DIR = "pterodactyl";
const PATCHES_DIR_NAME = "patches";
const SNAPSHOTS_DIR_NAME = "snapshots";

const DEFAULT_PROJECT_DIR = path.join(OS_VAR_WEB_DIR, PTERODACTYL_DIR);
const DEFAULT_PATCHES_DIR = path.join(DEFAULT_PROJECT_DIR, PATCHES_DIR_NAME);
const DEFAULT_BACKUP_DIR = path.join(OS_VAR_LIB_DIR, PTERODACTYL_DIR, SNAPSHOTS_DIR_NAME);

module.exports = {
    PTERODACTYL_DIR,
    PATCHES_DIR_NAME,
    SNAPSHOTS_DIR_NAME,
    DEFAULT_PROJECT_DIR,
    DEFAULT_PATCHES_DIR,
    DEFAULT_BACKUP_DIR
};
