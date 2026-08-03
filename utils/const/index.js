const configDirectory = require("./configDirectory");
const projectDirectory = require("./projectDirectory");

module.exports = {
    ...configDirectory,
    ...projectDirectory
};
