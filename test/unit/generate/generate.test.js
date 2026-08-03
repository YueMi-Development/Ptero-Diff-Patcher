const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { TEST_PROJECT_DIR, TEST_BACKUP_DIR, PATCH_OUT_PREFIX, TEST_SCRATCH_DIR } = require("../../../utils/const");

module.exports = async function run(runCLI) {
    if (fs.existsSync(TEST_SCRATCH_DIR)) {
        fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });

    // Initialize config
    runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);

    // Initialize git repo in test project
    console.log("Initializing git repository in test-project...");
    execSync("git init", { cwd: TEST_PROJECT_DIR });
    execSync("git config user.name 'Test'", { cwd: TEST_PROJECT_DIR });
    execSync("git config user.email 'test@example.com'", { cwd: TEST_PROJECT_DIR });

    // Create hello.txt and commit
    const filePath = path.join(TEST_PROJECT_DIR, "hello.txt");
    fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");
    execSync("git add hello.txt", { cwd: TEST_PROJECT_DIR });
    execSync('git commit -m "Initial commit"', { cwd: TEST_PROJECT_DIR });

    // Modify hello.txt and commit as Second commit
    console.log("Modifying and committing hello.txt as Second commit...");
    fs.writeFileSync(filePath, "Hello World\nModified Line 2\nLine 3\nLine 4\n", "utf8");
    execSync("git add hello.txt", { cwd: TEST_PROJECT_DIR });
    execSync('git commit -m "Second commit"', { cwd: TEST_PROJECT_DIR });

    console.log("\nTesting 'generate' command...");
    runCLI(`generate --commits HEAD~1..HEAD --output "${PATCH_OUT_PREFIX}"`);

    const generatedPatchFile = path.join(TEST_SCRATCH_DIR, "0001-second-commit-modified.patch");
    console.log("Generated patch content:");
    console.log(fs.readFileSync(generatedPatchFile, "utf8"));
};
