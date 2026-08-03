const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const {
    TEST_DIR,
    TEST_SCRATCH_DIR,
    TEST_PROJECT_DIR,
    TEST_BACKUP_DIR,
    PATCH_OUT_PREFIX
} = require("../utils/const");

const WORKSPACE_DIR = path.resolve(__dirname, "..");

function runCLI(args) {
    console.log(`> node index.js ${args}`);
    try {
        const out = execSync(`node index.js ${args}`, { cwd: WORKSPACE_DIR, encoding: "utf8" });
        console.log(out);
        return out;
    } catch (err) {
        console.error("CLI Execution failed:");
        console.error(err.stdout || err.message);
        throw err;
    }
}

async function test() {
    console.log("Setting up test environment...");

    // Clean previous runs
    if (fs.existsSync(TEST_SCRATCH_DIR)) {
        fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_SCRATCH_DIR, { recursive: true });
    fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });

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

    console.log("\n1. Testing 'init' command...");
    runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);

    // Modify hello.txt and commit as Second commit
    console.log("Modifying and committing hello.txt as Second commit...");
    fs.writeFileSync(filePath, "Hello World\nModified Line 2\nLine 3\nLine 4\n", "utf8");
    execSync("git add hello.txt", { cwd: TEST_PROJECT_DIR });
    execSync('git commit -m "Second commit"', { cwd: TEST_PROJECT_DIR });

    console.log("\n2. Testing 'generate' command...");
    runCLI(`generate --commits HEAD~1..HEAD --output "${PATCH_OUT_PREFIX}"`);

    const generatedPatchFile = path.join(TEST_SCRATCH_DIR, "0001-second-commit-modified.patch");
    console.log("Generated patch content:");
    console.log(fs.readFileSync(generatedPatchFile, "utf8"));

    // Reset hello.txt back to commit state manually
    console.log("Resetting hello.txt to original...");
    fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");

    console.log("\n3. Testing 'apply' command (dry-run)...");
    runCLI(`apply "${generatedPatchFile}" --dry-run`);

    console.log("\n4. Testing 'apply' command (actual)...");
    runCLI(`apply "${generatedPatchFile}"`);

    console.log("Content after patch:");
    console.log(fs.readFileSync(filePath, "utf8"));

    console.log("\n5. Testing 'snapshot list' command...");
    const listOut = runCLI("snapshot list");

    // Extract backup filename from output
    const match = listOut.match(/backup-[\w-]+\.tar\.gz/);
    if (!match) {
        throw new Error("Could not find backup file in list output!");
    }
    const backupFile = match[0];
    console.log(`Found backup snapshot: ${backupFile}`);

    // Reset hello.txt back to original manually
    fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");
    console.log("Reset hello.txt manually. Content before restore:");
    console.log(fs.readFileSync(filePath, "utf8"));

    console.log("\n6. Testing 'snapshot restore' command...");
    runCLI(`snapshot restore "${backupFile}"`);

    console.log("Content after restore (should be patched content):");
    console.log(fs.readFileSync(filePath, "utf8"));

    console.log("\n7. Testing 'apply' command with a directory of patches...");
    const patchesDir = path.join(TEST_SCRATCH_DIR, "test-patches-dir");
    if (fs.existsSync(patchesDir)) {
        fs.rmSync(patchesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(patchesDir);
    // Copy patch to the patches folder
    fs.copyFileSync(generatedPatchFile, path.join(patchesDir, "p1.patch"));

    // Reset hello.txt manually
    fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");
    console.log("Reset hello.txt manually. Content before directory patch:");
    console.log(fs.readFileSync(filePath, "utf8"));

    runCLI(`apply "${patchesDir}"`);
    console.log("Content after directory patch (should be modified content):");
    console.log(fs.readFileSync(filePath, "utf8"));

    console.log("\nALL TESTS PASSED SUCCESSFULLY!");
}

test().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
