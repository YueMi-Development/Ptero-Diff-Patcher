import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        sequence: {
            sequencer: class AlphabeticalSequencer {
                async shard(files) {
                    return files;
                }
                async sort(files) {
                    return [...files].sort((a, b) => {
                        const pathA = Array.isArray(a) ? a[1] : (a.filepath || a.path || String(a));
                        const pathB = Array.isArray(b) ? b[1] : (b.filepath || b.path || String(b));
                        return pathA.localeCompare(pathB);
                    });
                }
            }
        }
    }
});
