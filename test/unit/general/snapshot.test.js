const fs = require("fs");
const path = require("path");
const tar = require("tar");
const { TEST_PROJECT_DIR, TEST_BACKUP_DIR, TEST_SCRATCH_DIR } = require("../../../utils/const");

module.exports = async function run(runCLI) {
    if (fs.existsSync(TEST_SCRATCH_DIR)) {
        fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });

    // Initialize config
    runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);

    const filePath = path.join(TEST_PROJECT_DIR, "hello.txt");
    fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");

    // Manually create a backup snapshot archive to list and restore
    const snapshotName = "backup-2026-08-03T15-00-00-000Z.tar.gz";
    const archivePath = path.join(TEST_BACKUP_DIR, snapshotName);

    // Create a mock original file to restore
    const backupFile = path.join(TEST_SCRATCH_DIR, "hello-original.txt");
    fs.writeFileSync(backupFile, "Original Hello World\n", "utf8");

    // Create tarball
    await tar.create({
        gzip: true,
        file: archivePath,
        cwd: TEST_SCRATCH_DIR
    }, ["hello-original.txt"]);

    console.log("\nTesting 'snapshot list' command...");
    const listOut = runCLI("snapshot list");
    if (!listOut.includes(snapshotName)) {
        throw new Error("Snapshot was not found in list output!");
    }

    console.log("\nTesting 'snapshot restore' command...");
    // The restore command restores snapshot to project directory.
    runCLI(`snapshot restore "${snapshotName}"`);

    const restoredFile = path.join(TEST_PROJECT_DIR, "hello-original.txt");
    console.log("Restored file exists:", fs.existsSync(restoredFile));
    console.log("Content:", fs.readFileSync(restoredFile, "utf8"));
};
