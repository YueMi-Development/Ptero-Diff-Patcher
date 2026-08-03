const fs = require("fs");
const path = require("path");
const tar = require("tar");
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

describe("snapshot list step", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_SCRATCH_DIR)) {
            fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
        runCLI(`init --project-dir "${TEST_PROJECT_DIR}" --backup-dir "${TEST_BACKUP_DIR}"`);
    });

    test("should list snapshot backups successfully", async () => {
        const filePath = path.join(TEST_PROJECT_DIR, "hello.txt");
        fs.writeFileSync(filePath, "Hello World\n", "utf8");

        const backupFilename = "backup-2026-08-03T15-00-00-000Z.tar.gz";
        const backupPath = path.join(TEST_BACKUP_DIR, backupFilename);

        await tar.c(
            {
                gzip: true,
                file: backupPath,
                cwd: TEST_PROJECT_DIR
            },
            ["hello.txt"]
        );

        const out = runCLI("snapshot list");
        expect(out).toContain(backupFilename);
    });
});
