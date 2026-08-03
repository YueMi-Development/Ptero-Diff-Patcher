const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const { DEFAULT_CONFIG_PATH, CONFIG_DIR } = require("../const");

function getConfig() {
    if (!fs.existsSync(DEFAULT_CONFIG_PATH)) {
        return {};
    }
    try {
        const fileContent = fs.readFileSync(DEFAULT_CONFIG_PATH, "utf8");
        return YAML.parse(fileContent) || {};
    } catch (error) {
        console.error(`Error reading config at ${DEFAULT_CONFIG_PATH}:`, error.message);
        return {};
    }
}

function writeConfig(config) {
    try {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        const yamlStr = YAML.stringify(config);
        fs.writeFileSync(DEFAULT_CONFIG_PATH, yamlStr, "utf8");
        return true;
    } catch (error) {
        console.error(`Error writing config at ${DEFAULT_CONFIG_PATH}:`, error.message);
        return false;
    }
}

module.exports = {
    getConfig,
    writeConfig
};
