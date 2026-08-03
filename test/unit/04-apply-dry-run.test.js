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

describe("apply dry-run step", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
        runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
    });

    test("should dry-run patch cleanly without modifying file", () => {
        const filePath = path.join(TEST_PROJECT_DIR, "hello.txt");
        fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");

        const patchContent = [
            "diff --git a/hello.txt b/hello.txt",
            "--- a/hello.txt",
            "+++ b/hello.txt",
            "@@ -1,3 +1,4 @@",
            " Hello World",
            "-Line 2",
            "+Modified Line 2",
            " Line 3",
            "+Line 4"
        ].join("\n") + "\n";

        const patchFile = path.join(TEST_SCRATCH_DIR, "dry-run.patch");
        fs.writeFileSync(patchFile, patchContent, "utf8");

        const dryRunOut = runCLI(`apply "${patchFile}" --dry-run`);
        expect(dryRunOut).toContain("Dry-run complete. All patches can be applied cleanly");

        // Verify file is NOT modified
        const fileContent = fs.readFileSync(filePath, "utf8");
        expect(fileContent).toBe("Hello World\nLine 2\nLine 3\n");
    });
});
