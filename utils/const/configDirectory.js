const path = require("path");
const os = require("os");

const CONFIG_DIR_NAME = "ptero-patcher";
const CONFIG_DIR = path.join(os.homedir(), ".config", CONFIG_DIR_NAME);
const DEFAULT_CONFIG_NAME = "config.yml";
const DEFAULT_CONFIG_PATH = path.join(CONFIG_DIR, DEFAULT_CONFIG_NAME);

module.exports = {
    CONFIG_DIR_NAME,
    CONFIG_DIR,
    DEFAULT_CONFIG_NAME,
    DEFAULT_CONFIG_PATH
};