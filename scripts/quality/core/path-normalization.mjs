import path from "node:path";

export function toPosixPath(value) {
  return value.replaceAll(path.sep, "/");
}

export function normalizeRepositoryPath(value) {
  const normalized = path.posix.normalize(toPosixPath(value));
  return normalized === "." ? "" : normalized.replace(/^\.\//u, "");
}

export function hasPathSegment(value, segment) {
  return normalizeRepositoryPath(value).split("/").includes(segment);
}
