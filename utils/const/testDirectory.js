const path = require("path");

const TEST_DIR = path.resolve(__dirname, "..", "..", "test");
const isTest = process.env.NODE_ENV === "test";
const workerSuffix = (isTest && process.env.VITEST_WORKER_ID) ? `-${process.env.VITEST_WORKER_ID}` : "";

const TEST_SCRATCH_DIR = path.join(TEST_DIR, `scratch${workerSuffix}`);
const TEST_PROJECT_DIR = path.join(TEST_SCRATCH_DIR, "test-project");
const TEST_BACKUP_DIR = path.join(TEST_SCRATCH_DIR, "test-backups");
const PATCH_OUT_PREFIX = path.join(TEST_SCRATCH_DIR, "test");

module.exports = {
    TEST_DIR,
    TEST_SCRATCH_DIR,
    TEST_PROJECT_DIR,
    TEST_BACKUP_DIR,
    PATCH_OUT_PREFIX
};
