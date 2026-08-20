import fs from "node:fs";
import path from "node:path";
import { normalizeRepositoryPath } from "./path-normalization.mjs";

/**
 * @typedef {object} WalkFilesOptions
 * @property {(filePath: string, entryName: string) => boolean} [include]
 * @property {(entryName: string, absolutePath: string) => boolean} [excludeDirectory]
 * @property {boolean} [followSymbolicLinks]
 * @property {boolean} [sort]
 */

export const DEFAULT_IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "artifacts",
  "playwright-report",
  "test-results",
  ".vite",
]);

export function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

export function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function writeJson(filePath, value) {
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * @param {string} rootDirectory
 * @param {WalkFilesOptions} [options]
 * @returns {string[]}
 */
export function walkFiles(rootDirectory, options = {}) {
  const {
    include = () => true,
    excludeDirectory = (entryName) => DEFAULT_IGNORED_DIRECTORIES.has(entryName),
    followSymbolicLinks = false,
    sort = true,
  } = options;
  const output = [];
  if (!fs.existsSync(rootDirectory)) return output;

  const visit = (directory) => {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    if (sort) entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excludeDirectory(entry.name, absolutePath)) visit(absolutePath);
        continue;
      }
      if (entry.isSymbolicLink() && followSymbolicLinks) {
        const stats = fs.statSync(absolutePath);
        if (stats.isDirectory()) visit(absolutePath);
        else if (include(absolutePath, entry.name)) output.push(absolutePath);
        continue;
      }
      if (entry.isFile() && include(absolutePath, entry.name)) output.push(absolutePath);
    }
  };

  visit(rootDirectory);
  return output;
}

/**
 * @param {string} rootDirectory
 * @param {WalkFilesOptions} [options]
 * @returns {string[]}
 */
export function walkAllFiles(rootDirectory, options = {}) {
  return walkFiles(rootDirectory, {
    excludeDirectory: () => false,
    sort: false,
    ...options,
  });
}

/**
 * @param {string} repositoryRoot
 * @param {WalkFilesOptions} [options]
 * @returns {string[]}
 */
export function listRepositoryRelativeFiles(repositoryRoot, options = {}) {
  return walkFiles(repositoryRoot, options).map((filePath) => normalizeRepositoryPath(path.relative(repositoryRoot, filePath)));
}
