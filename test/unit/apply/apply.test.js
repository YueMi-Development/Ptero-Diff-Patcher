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

describe("apply command", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
        runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
    });

    test("should dry-run and apply patch cleanly", () => {
        const filePath = path.join(TEST_PROJECT_DIR, "hello.txt");
        fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");

        const patchContent = [
            "diff --git a/hello.txt b/hello.txt",
            "index 0000000..1111111 100644",
            "--- a/hello.txt",
            "+++ b/hello.txt",
            "@@ -1,3 +1,4 @@",
            " Hello World",
            "-Line 2",
            "+Modified Line 2",
            " Line 3",
            "+Line 4"
        ].join("\n") + "\n";
        const patchFile = path.join(TEST_SCRATCH_DIR, "mock.patch");
        fs.writeFileSync(patchFile, patchContent, "utf8");

        const dryRunOut = runCLI(`apply "${patchFile}" --dry-run`);
        expect(dryRunOut).toContain("Dry-run complete. All patches can be applied cleanly");

        const applyOut = runCLI(`apply "${patchFile}"`);
        expect(applyOut).toContain("All patches successfully applied to files.");
        expect(fs.readFileSync(filePath, "utf8")).toBe("Hello World\nModified Line 2\nLine 3\nLine 4\n");
    });

    test("should apply a directory of patches", () => {
        const filePath = path.join(TEST_PROJECT_DIR, "hello.txt");
        fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");

        const patchContent = [
            "diff --git a/hello.txt b/hello.txt",
            "index 0000000..1111111 100644",
            "--- a/hello.txt",
            "+++ b/hello.txt",
            "@@ -1,3 +1,4 @@",
            " Hello World",
            "-Line 2",
            "+Modified Line 2",
            " Line 3",
            "+Line 4"
        ].join("\n") + "\n";
        const patchesDir = path.join(TEST_SCRATCH_DIR, "test-patches-dir");
        fs.mkdirSync(patchesDir);
        fs.writeFileSync(path.join(patchesDir, "p1.patch"), patchContent, "utf8");

        const applyOut = runCLI(`apply "${patchesDir}"`);
        expect(applyOut).toContain("All patches successfully applied to files.");
        expect(fs.readFileSync(filePath, "utf8")).toBe("Hello World\nModified Line 2\nLine 3\nLine 4\n");
    });
});
