import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { repositoryRoot } from "./repo-context.mjs";

const extensions = ["", ".ts", ".tsx", ".mts", ".mjs", ".js"];
const indexFiles = ["index.ts", "index.tsx", "index.mts", "index.mjs", "index.js"];

function resolveFile(basePath) {
  for (const extension of extensions) {
    const candidate = `${basePath}${extension}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return pathToFileURL(candidate).href;
  }
  for (const indexFile of indexFiles) {
    const candidate = path.join(basePath, indexFile);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return pathToFileURL(candidate).href;
  }
  return undefined;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolved = resolveFile(path.join(repositoryRoot, "src", specifier.slice(2)));
    if (resolved) return { url: resolved, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const resolved = resolveFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (resolved) return { url: resolved, shortCircuit: true };
    }
    throw error;
  }
}
