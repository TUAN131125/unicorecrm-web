const fs = require("node:fs");
const path = require("node:path");

function walkFiles(rootDirectory, options = {}) {
  const results = [];
  const pending = [path.resolve(rootDirectory)];
  const excludeDirectory = options.excludeDirectory ?? (() => false);
  const include = options.include ?? (() => true);

  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excludeDirectory(entry.name, target)) pending.push(target);
      } else if (entry.isFile() && include(target, entry.name)) {
        results.push(target);
      }
    }
  }

  return results;
}

function walkAllFiles(rootDirectory, options = {}) {
  return walkFiles(rootDirectory, options);
}

module.exports = { walkAllFiles, walkFiles };
