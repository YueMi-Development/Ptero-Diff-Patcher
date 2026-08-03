const fs = require("fs");
const path = require("path");
const tar = require("tar");
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

describe("snapshot command", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
        runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
    });

    test("should list snapshots and restore successfully", async () => {
        const filePath = path.join(TEST_PROJECT_DIR, "hello.txt");
        fs.writeFileSync(filePath, "Hello World\nLine 2\nLine 3\n", "utf8");

        const snapshotName = "backup-2026-08-03T15-00-00-000Z.tar.gz";
        const archivePath = path.join(TEST_BACKUP_DIR, snapshotName);

        const backupFile = path.join(TEST_SCRATCH_DIR, "hello-original.txt");
        fs.writeFileSync(backupFile, "Original Hello World\n", "utf8");

        await tar.create({
            gzip: true,
            file: archivePath,
            cwd: TEST_SCRATCH_DIR
        }, ["hello-original.txt"]);

        const listOut = runCLI("snapshot list");
        expect(listOut).toContain(snapshotName);

        const restoreOut = runCLI(`snapshot restore "${snapshotName}"`);
        expect(restoreOut).toContain("Restore completed successfully.");

        const restoredFile = path.join(TEST_PROJECT_DIR, "hello-original.txt");
        expect(fs.existsSync(restoredFile)).toBe(true);
        expect(fs.readFileSync(restoredFile, "utf8")).toBe("Original Hello World\n");
    });
});
