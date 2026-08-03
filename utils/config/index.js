const main = require("./main");
const envFiles = require("./envFiles");
const logger = require("./logger");

module.exports = {
    ...main,
    ...envFiles,
    ...logger
};
