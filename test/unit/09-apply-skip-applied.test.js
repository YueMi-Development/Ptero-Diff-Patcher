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

describe("apply already applied patches skipping step", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
        runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
    });

    test("should skip already applied patch and force application when requested", () => {
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

        const patchFile = path.join(TEST_SCRATCH_DIR, "mock.patch");
        fs.writeFileSync(patchFile, patchContent, "utf8");

        // 1st run: applies cleanly
        const out1 = runCLI(`apply "${patchFile}"`);
        expect(out1).toContain("All patches successfully applied to files.");

        // Verify the state file was created
        const statePath = path.join(TEST_PROJECT_DIR, ".ptero-applied-patches.json");
        expect(fs.existsSync(statePath)).toBe(true);

        const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
        expect(state.applied.length).toBe(1);
        expect(state.applied[0].source).toBe("mock.patch");

        // 2nd run: should skip
        const out2 = runCLI(`apply "${patchFile}"`);
        expect(out2).toContain("Skipping patch (already applied): mock.patch");
        expect(out2).not.toContain("All patches successfully applied to files.");

        // 3rd run with --force: should attempt and fail due to conflict since it's already applied
        try {
            runCLI(`apply "${patchFile}" --force --no-fuzzy`);
            // should not reach here since applying already modified file causes conflict
            expect(true).toBe(false);
        } catch (err) {
            expect(err.message).toContain("Execution failed: Conflict: Could not apply patch");
        }
    });
});
