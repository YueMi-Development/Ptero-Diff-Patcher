const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { TEST_PROJECT_DIR, TEST_BACKUP_DIR, TEST_SCRATCH_DIR } = require("../../utils/const");

const WORKSPACE_DIR = path.resolve(__dirname, "../..");

function runCLI(args) {
    try {
        return execSync(`node index.js ${args}`, { cwd: WORKSPACE_DIR, encoding: "utf8" });
    } catch (err) {
        console.error("CLI stdout:", err.stdout);
        console.error("CLI stderr:", err.stderr);
        throw err;
    }
}

describe("large 10 commit patch generation and application step", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
        runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
    });

    test("should successfully generate and apply 10 commits with added/modified/deleted files and subdirectories", () => {
        execSync("git init", { cwd: TEST_PROJECT_DIR });
        execSync("git config user.name 'Test'", { cwd: TEST_PROJECT_DIR });
        execSync("git config user.email 'test@example.com'", { cwd: TEST_PROJECT_DIR });

        // Baseline commit
        const helloFile = path.join(TEST_PROJECT_DIR, "hello.txt");
        fs.writeFileSync(helloFile, "Baseline Content\n", "utf8");
        execSync("git add hello.txt", { cwd: TEST_PROJECT_DIR });
        execSync('git commit -m "Baseline commit"', { cwd: TEST_PROJECT_DIR });

        const baselineCommit = execSync("git rev-parse HEAD", { cwd: TEST_PROJECT_DIR, encoding: "utf8" }).trim();

        // 10 commits
        const commitActions = [
            () => {
                fs.mkdirSync(path.join(TEST_PROJECT_DIR, "src"), { recursive: true });
                fs.writeFileSync(path.join(TEST_PROJECT_DIR, "src/app.js"), "console.log('App Started');\n");
            },
            () => {
                fs.writeFileSync(path.join(TEST_PROJECT_DIR, "src/utils.js"), "module.exports = { add: (a, b) => a + b };\n");
                fs.appendFileSync(path.join(TEST_PROJECT_DIR, "src/app.js"), "const utils = require('./utils');\n");
            },
            () => {
                fs.mkdirSync(path.join(TEST_PROJECT_DIR, "configs"), { recursive: true });
                fs.writeFileSync(path.join(TEST_PROJECT_DIR, "configs/config.json"), '{\n  "port": 8080\n}\n');
            },
            () => {
                fs.writeFileSync(path.join(TEST_PROJECT_DIR, "configs/config.json"), '{\n  "port": 3000,\n  "debug": true\n}\n');
                fs.appendFileSync(path.join(TEST_PROJECT_DIR, "src/app.js"), "console.log('Port configured');\n");
            },
            () => {
                execSync("git rm src/utils.js", { cwd: TEST_PROJECT_DIR });
            },
            () => {
                fs.writeFileSync(path.join(TEST_PROJECT_DIR, "README.md"), "# Ptero Diff Patcher Test\n");
            },
            () => {
                fs.appendFileSync(path.join(TEST_PROJECT_DIR, "README.md"), "This is a test run.\n");
                fs.mkdirSync(path.join(TEST_PROJECT_DIR, "docs"), { recursive: true });
                fs.writeFileSync(path.join(TEST_PROJECT_DIR, "docs/index.md"), "# Docs Index\n");
            },
            () => {
                // Rename docs/index.md to docs/main.md
                execSync("git mv docs/index.md docs/main.md", { cwd: TEST_PROJECT_DIR });
                fs.writeFileSync(path.join(TEST_PROJECT_DIR, "docs/main.md"), "# Main Docs\n");
            },
            () => {
                fs.appendFileSync(path.join(TEST_PROJECT_DIR, "src/app.js"), "console.log('Done');\n");
                fs.appendFileSync(path.join(TEST_PROJECT_DIR, "docs/main.md"), "Updated doc info.\n");
            },
            () => {
                execSync("git rm configs/config.json", { cwd: TEST_PROJECT_DIR });
            }
        ];

        for (let i = 0; i < commitActions.length; i++) {
            commitActions[i]();
            execSync("git add -u", { cwd: TEST_PROJECT_DIR });
            execSync("git add -f .", { cwd: TEST_PROJECT_DIR });
            execSync(`git commit -m "Test commit ${i + 1}"`, { cwd: TEST_PROJECT_DIR });
        }

        const targetCommit = execSync("git rev-parse HEAD", { cwd: TEST_PROJECT_DIR, encoding: "utf8" }).trim();

        // Generate patches
        const largePatchDir = path.join(TEST_SCRATCH_DIR, "large-patch-output");
        fs.mkdirSync(largePatchDir, { recursive: true });
        runCLI(`generate --commits ${baselineCommit}..${targetCommit} --output "${largePatchDir}"`);

        // Check that sequential patches are generated
        const files = fs.readdirSync(largePatchDir).sort();
        expect(files.length).toBeGreaterThan(5);
        expect(files[0]).toMatch(/^0001-/);

        // Reset git repo back to baselineCommit
        execSync(`git reset --hard ${baselineCommit}`, { cwd: TEST_PROJECT_DIR });
        execSync("git clean -fd", { cwd: TEST_PROJECT_DIR });

        // Apply patches sequentially
        runCLI(`apply "${largePatchDir}"`);

        // Verify the files match targetCommit exactly
        execSync(`git reset --hard ${targetCommit}`, { cwd: TEST_PROJECT_DIR });
        const expectedAppJs = fs.readFileSync(path.join(TEST_PROJECT_DIR, "src/app.js"), "utf8").replace(/\r\n/g, "\n");
        const expectedReadme = fs.readFileSync(path.join(TEST_PROJECT_DIR, "README.md"), "utf8").replace(/\r\n/g, "\n");
        const expectedMainMd = fs.readFileSync(path.join(TEST_PROJECT_DIR, "docs/main.md"), "utf8").replace(/\r\n/g, "\n");
        const configExists = fs.existsSync(path.join(TEST_PROJECT_DIR, "configs/config.json"));

        // Reset git repo to baselineCommit to verify patched state matches
        execSync(`git reset --hard ${baselineCommit}`, { cwd: TEST_PROJECT_DIR });
        execSync("git clean -fd", { cwd: TEST_PROJECT_DIR });

        // Apply the patches to baseline and check if it matches expected target state
        runCLI(`apply "${largePatchDir}"`);

        const actualAppJs = fs.readFileSync(path.join(TEST_PROJECT_DIR, "src/app.js"), "utf8").replace(/\r\n/g, "\n");
        const actualReadme = fs.readFileSync(path.join(TEST_PROJECT_DIR, "README.md"), "utf8").replace(/\r\n/g, "\n");
        const actualMainMd = fs.readFileSync(path.join(TEST_PROJECT_DIR, "docs/main.md"), "utf8").replace(/\r\n/g, "\n");

        expect(actualAppJs).toBe(expectedAppJs);
        expect(actualReadme).toBe(expectedReadme);
        expect(actualMainMd).toBe(expectedMainMd);
        expect(configExists).toBe(false);
    }, 30000);
});
