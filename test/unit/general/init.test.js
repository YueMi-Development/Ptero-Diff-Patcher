const fs = require("fs");
const path = require("path");
const { TEST_PROJECT_DIR, TEST_BACKUP_DIR, TEST_SCRATCH_DIR } = require("../../../utils/const");

module.exports = async function run(runCLI) {
    console.log("Setting up project directories...");
    if (fs.existsSync(TEST_SCRATCH_DIR)) {
        fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });

    console.log("\nTesting 'init' command...");
    runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
};
