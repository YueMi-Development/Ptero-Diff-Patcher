const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { TEST_PROJECT_DIR, TEST_BACKUP_DIR, PATCH_OUT_PREFIX, TEST_SCRATCH_DIR } = require("../../utils/const");

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

describe("generate command (single commit) step", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
        runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
    });

    test("should generate sequentially numbered patches for commit range", () => {
        execSync("git init", { cwd: TEST_PROJECT_DIR });
        execSync("git config user.name 'Test'", { cwd: TEST_PROJECT_DIR });
        execSync("git config user.email 'test@example.com'", { cwd: TEST_PROJECT_DIR });

        const filePath = path.join(TEST_PROJECT_DIR, "hello.txt");
        fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");
        execSync("git add hello.txt", { cwd: TEST_PROJECT_DIR });
        execSync('git commit -m "Initial commit"', { cwd: TEST_PROJECT_DIR });

        fs.writeFileSync(filePath, "Hello World\nModified Line 2\nLine 3\nLine 4\n", "utf8");
        execSync("git add hello.txt", { cwd: TEST_PROJECT_DIR });
        execSync('git commit -m "Second commit"', { cwd: TEST_PROJECT_DIR });

        const out = runCLI(`generate --commits HEAD~1..HEAD --output "${PATCH_OUT_PREFIX}"`);
        const match = out.match(/Patch created: (0001-[a-f0-9]+-MOD\.patch)/);
        expect(match).not.toBeNull();
        const filename = match[1];
        expect(out).toContain(`Patch created: ${filename}`);

        const generatedPatchFile = path.join(TEST_SCRATCH_DIR, filename);
        expect(fs.existsSync(generatedPatchFile)).toBe(true);
        expect(fs.readFileSync(generatedPatchFile, "utf8")).toContain("+Modified Line 2");
    });
});
