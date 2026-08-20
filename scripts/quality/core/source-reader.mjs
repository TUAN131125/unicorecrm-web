import path from "node:path";
import { readUtf8, walkFiles } from "./filesystem.mjs";

export const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);

export function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

export function collectSourceFiles(rootDirectory, options = {}) {
  const callerInclude = options.include;
  return walkFiles(rootDirectory, {
    ...options,
    include: (filePath, name) => isSourceFile(filePath) && (callerInclude ? callerInclude(filePath, name) : true),
  });
}

export function readSource(filePath) {
  return readUtf8(filePath);
}

export function readSources(filePaths) {
  return filePaths.map((filePath) => ({ filePath, source: readSource(filePath) }));
}
