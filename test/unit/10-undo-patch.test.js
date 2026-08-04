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

describe("undo command step", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
        runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
    });

    test("should successfully undo a patch, revert file changes, and remove from applied list", () => {
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

        // 1. Apply patch
        runCLI(`apply "${patchFile}"`);
        expect(fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n")).toBe("Hello World\nModified Line 2\nLine 3\nLine 4\n");

        const statePath = path.join(TEST_PROJECT_DIR, ".ptero-applied-patches.json");
        let state = JSON.parse(fs.readFileSync(statePath, "utf8"));
        expect(state.applied.some(item => item.source === "mock.patch")).toBe(true);

        // 2. Undo patch
        runCLI(`undo "${patchFile}"`);
        expect(fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n")).toBe("Hello World\nLine 2\nLine 3\n");

        state = JSON.parse(fs.readFileSync(statePath, "utf8"));
        expect(state.applied.some(item => item.source === "mock.patch")).toBe(false);

        // 3. Trying to undo again should fail
        try {
            runCLI(`undo "${patchFile}"`);
            expect(true).toBe(false);
        } catch (err) {
            expect(err.message).toContain("Patch is not marked as applied: mock.patch");
        }
    });
});
