const crypto = require("crypto");

function getPatchHash(content) {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function verifyIntegrity(filename, content) {
    const match = filename.match(/^\d{4}-[a-f0-9]{8}-([a-f0-9]{8})-(NEW|MOD)\.patch$/i);
    if (match) {
        const expectedHashPrefix = match[1].toLowerCase();
        const actualHash = getPatchHash(content);
        const actualHashPrefix = actualHash.substring(0, 8).toLowerCase();
        if (actualHashPrefix !== expectedHashPrefix) {
            throw new Error(`Integrity check failed: patch content hash prefix '${actualHashPrefix}' does not match filename expected '${expectedHashPrefix}' for ${filename}`);
        }
    }
    return true;
}

module.exports = {
    getPatchHash,
    verifyIntegrity
};
