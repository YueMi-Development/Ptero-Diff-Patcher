const crypto = require("crypto");

function getPatchHash(content) {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

module.exports = { getPatchHash };
