const configDirectory = require("./configDirectory");
const projectDirectory = require("./projectDirectory");
const testDirectory = require("./testDirectory");

module.exports = {
    ...configDirectory,
    ...projectDirectory,
    ...testDirectory
};
