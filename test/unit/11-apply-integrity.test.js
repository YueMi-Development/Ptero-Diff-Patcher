const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { TEST_PROJECT_DIR, TEST_BACKUP_DIR, TEST_SCRATCH_DIR } = require("../../utils/const");

const WORKSPACE_DIR = path.resolve(__dirname, "../..");

function runCLI(args) {
    try {
        return execSync(`node index.js ${args}`, { cwd: WORKSPACE_DIR, encoding: "utf8" });
    } catch (err) {
        return {
            failed: true,
            stdout: err.stdout,
            stderr: err.stderr
        };
    }
}

describe("apply patch integrity check", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
        runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
    });

    test("should reject patch if content hash prefix does not match filename", () => {
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

        // Mismatched hash: using "deadbeef" instead of actual content hash prefix
        const patchFile = path.join(TEST_SCRATCH_DIR, "0001-00000000-deadbeef-MOD.patch");
        fs.writeFileSync(patchFile, patchContent, "utf8");

        const res = runCLI(`apply "${patchFile}"`);
        expect(res.failed).toBeUndefined();
        expect(res).toContain("Integrity check failed");
        expect(res).toContain("does not match filename expected 'deadbeef'");
        expect(res).toContain("No valid patches to apply after integrity check.");
    });

    test("should allow patch if content hash prefix matches filename perfectly", () => {
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

        // Calculate actual hash prefix
        const { getPatchHash } = require("../../utils/hash");
        const actualHashPrefix = getPatchHash(patchContent).substring(0, 8);

        const patchFile = path.join(TEST_SCRATCH_DIR, `0001-00000000-${actualHashPrefix}-MOD.patch`);
        fs.writeFileSync(patchFile, patchContent, "utf8");

        const res = runCLI(`apply "${patchFile}"`);
        expect(res.failed).toBeUndefined(); // command succeeded
        expect(res).toContain("All patches successfully applied to files.");
    });

    test("should bypass integrity check if --no-integrity is specified", () => {
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

        const patchFile = path.join(TEST_SCRATCH_DIR, "0001-00000000-deadbeef-MOD.patch");
        fs.writeFileSync(patchFile, patchContent, "utf8");

        const res = runCLI(`apply "${patchFile}" --no-integrity`);
        expect(res.failed).toBeUndefined(); // command succeeded
        expect(res).toContain("All patches successfully applied to files.");
    });
});
