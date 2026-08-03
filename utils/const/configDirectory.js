const path = require("path");
const os = require("os");
const fs = require("fs");

function loadEnv() {
    const envPath = path.resolve(__dirname, "..", "..", ".env");
    if (fs.existsSync(envPath)) {
        try {
            const content = fs.readFileSync(envPath, "utf8");
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) return;
                const index = trimmed.indexOf("=");
                if (index === -1) return;
                const key = trimmed.substring(0, index).trim();
                const value = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, "");
                if (!(key in process.env)) {
                    process.env[key] = value;
                }
            });
        } catch (e) {
            // Ignore errors reading .env
        }
    }
}

try {
    require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
} catch (e) {
    loadEnv();
}

const CONFIG_DIR_NAME = "ptero-patcher";
const isTest = process.env.NODE_ENV === "test";

const CONFIG_DIR = process.env.PTERO_CONFIG_DIR || (
    isTest
        ? path.resolve(__dirname, "..", "..", "test", "scratch")
        : path.join(os.homedir(), ".config", CONFIG_DIR_NAME)
);

const workerSuffix = (isTest && process.env.VITEST_WORKER_ID) ? `-${process.env.VITEST_WORKER_ID}` : "";
const DEFAULT_CONFIG_NAME = `config${workerSuffix}.yml`;
const DEFAULT_CONFIG_PATH = path.join(CONFIG_DIR, DEFAULT_CONFIG_NAME);

module.exports = {
    CONFIG_DIR_NAME,
    CONFIG_DIR,
    DEFAULT_CONFIG_NAME,
    DEFAULT_CONFIG_PATH
};