import path from "node:path";
import { fileURLToPath } from "node:url";

const coreDirectory = path.dirname(fileURLToPath(import.meta.url));

/** Canonical repository root derived from this module's stable location. */
export const repositoryRoot = path.resolve(coreDirectory, "../../..");

export function resolveFromRepository(...segments) {
  return path.resolve(repositoryRoot, ...segments);
}

export function relativeToRepository(filePath) {
  return path.relative(repositoryRoot, path.resolve(filePath)).replaceAll(path.sep, "/");
}

export function assertInsideRepository(filePath) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(repositoryRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path is outside repository root: ${resolved}`);
  }
  return resolved;
}
