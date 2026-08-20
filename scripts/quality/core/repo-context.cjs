"use strict";

const path = require("node:path");

// CommonJS interop for the single remaining CJS quality executable.
const repositoryRoot = path.resolve(__dirname, "../../..");
const resolveFromRepository = (...segments) => path.resolve(repositoryRoot, ...segments);
const relativeToRepository = (filePath) => path.relative(repositoryRoot, path.resolve(filePath)).split(path.sep).join("/");

module.exports = { repositoryRoot, resolveFromRepository, relativeToRepository };
