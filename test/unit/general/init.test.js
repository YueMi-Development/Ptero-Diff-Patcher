const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { TEST_PROJECT_DIR, TEST_BACKUP_DIR, TEST_SCRATCH_DIR } = require("../../../utils/const");

const WORKSPACE_DIR = path.resolve(__dirname, "../../..");

function runCLI(args) {
    try {
        return execSync(`node index.js ${args}`, { cwd: WORKSPACE_DIR, encoding: "utf8" });
    } catch (err) {
        console.error("CLI stdout:", err.stdout);
        console.error("CLI stderr:", err.stderr);
        throw err;
    }
}

describe("init command", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
    });

    test("should initialize project configuration successfully", () => {
        const out = runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
        expect(out).toContain("Configuration saved successfully.");
        expect(out).toContain(TEST_PROJECT_DIR);
        expect(out).toContain(TEST_BACKUP_DIR);
    });
});
