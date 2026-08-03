const path = require("path");
const fs = require("fs");
const { CONFIG_DIR } = require("../const");

const LOGS_DIR = path.join(CONFIG_DIR, "logs");

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

module.exports = {
    LOGS_DIR
};
