const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { TEST_DIR, TEST_SCRATCH_DIR } = require("../utils/const");

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

function getTestFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getTestFiles(fullPath));
        } else if (file.endsWith(".test.js") || file.endsWith(".js")) {
            results.push(fullPath);
        }
    });
    return results;
}

async function runAll() {
    console.log("Setting up test environment...");
    if (fs.existsSync(TEST_SCRATCH_DIR)) {
        fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_SCRATCH_DIR, { recursive: true });

    const unitDir = path.join(TEST_DIR, "unit");
    const testFiles = getTestFiles(unitDir);

    if (testFiles.length === 0) {
        console.log("No unit tests found under test/unit/");
        return;
    }

    console.log(`Found ${testFiles.length} test file(s). Running tests...`);
    for (const file of testFiles) {
        // Ensure a clean scratch folder state before each test run
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_SCRATCH_DIR, { recursive: true });

        const relativeName = path.relative(unitDir, file);
        console.log(`\n========================================`);
        console.log(`Running Category: ${relativeName}`);
        console.log(`========================================`);
        const runTest = require(file);
        if (typeof runTest === "function") {
            await runTest(runCLI);
        } else {
            console.warn(`Warning: Test file ${relativeName} does not export a function.`);
        }
    }

    console.log("\nALL TESTS COMPLETED SUCCESSFULLY!");
}

runAll().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
