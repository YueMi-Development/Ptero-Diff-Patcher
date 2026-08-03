const fs = require("fs");
const path = require("path");

function loadEnvFile(envPath) {
    if (!fs.existsSync(envPath)) return;
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
        // Ignore errors
    }
}

function loadEnv() {
    const isTest = process.env.NODE_ENV === "test";
    const baseDir = path.resolve(__dirname, "..", "..");

    // Laravel/Vite style priority order
    const envFiles = [];
    if (isTest) {
        envFiles.push(".env.test");
    }
    envFiles.push(".env.local");
    envFiles.push(".env");

    for (const file of envFiles) {
        const envPath = path.join(baseDir, file);
        try {
            // Attempt to load using standard dotenv
            require("dotenv").config({ path: envPath });
        } catch (e) {
            // Fallback to zero-dependency parsing
            loadEnvFile(envPath);
        }
    }
}

loadEnv();

module.exports = {
    loadEnv
};
