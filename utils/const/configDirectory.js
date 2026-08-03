const path = require("path");
const os = require("os");

require("../config/envFiles");

const CONFIG_DIR_NAME = "ptero-patcher";
const isTest = process.env.NODE_ENV === "test";

const CONFIG_DIR = process.env.PTERO_CONFIG_DIR || (
    isTest
        ? path.resolve(__dirname, "..", "..", "test", "scratch")
        : path.join(os.homedir(), ".config", CONFIG_DIR_NAME)
);

const workerSuffix = (isTest && process.env.VITEST_WORKER_ID) ? `-${process.env.VITEST_WORKER_ID}` : "";
const DEFAULT_CONFIG_NAME = `config${workerSuffix}.yml`;
const DEFAULT_CONFIG_PATH = path.join(CONFIG_DIR, DEFAULT_CONFIG_NAME);

module.exports = {
    CONFIG_DIR_NAME,
    CONFIG_DIR,
    DEFAULT_CONFIG_NAME,
    DEFAULT_CONFIG_PATH
};