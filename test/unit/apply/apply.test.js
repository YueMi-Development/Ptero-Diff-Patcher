const fs = require("fs");
const path = require("path");
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

    // Write a mock patch
    const patchContent = `diff --git a/hello.txt b/hello.txt
index 0000000..1111111 100644
--- a/hello.txt
+++ b/hello.txt
@@ -1,3 +1,4 @@
 Hello World
-Line 2
+Modified Line 2
 Line 3
+Line 4
`;
    const patchFile = path.join(TEST_SCRATCH_DIR, "mock.patch");
    fs.writeFileSync(patchFile, patchContent, "utf8");

    console.log("\nTesting 'apply' command (dry-run)...");
    runCLI(`apply "${patchFile}" --dry-run`);

    console.log("\nTesting 'apply' command (actual)...");
    runCLI(`apply "${patchFile}"`);

    console.log("Content after patch:");
    console.log(fs.readFileSync(filePath, "utf8"));

    console.log("\nTesting 'apply' command with a directory of patches...");
    const patchesDir = path.join(TEST_SCRATCH_DIR, "test-patches-dir");
    if (fs.existsSync(patchesDir)) {
        fs.rmSync(patchesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(patchesDir);
    fs.copyFileSync(patchFile, path.join(patchesDir, "p1.patch"));

    // Reset hello.txt manually
    fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");
    runCLI(`apply "${patchesDir}"`);

    console.log("Content after directory patch (should be modified content):");
    console.log(fs.readFileSync(filePath, "utf8"));
};
