import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const modulesRoot = path.join(repositoryRoot, "src/modules");
const moduleNames = fs
  .readdirSync(modulesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const sourceSpecifierPattern = /(?:from\s*|import\s*\(\s*)["'](@\/modules\/[^"']+)["']/gu;
const failures: string[] = [];

for (const moduleName of moduleNames) {
  const moduleRoot = path.join(modulesRoot, moduleName);
  const ownBarrel = `@/modules/${moduleName}`;

  for (const target of walkFiles(moduleRoot, {
    include: (_filePath: string, entryName: string) => /\.(?:cts|mts|ts|tsx)$/u.test(entryName),
  })) {
    const source = fs.readFileSync(target, "utf8");
    for (const match of source.matchAll(sourceSpecifierPattern)) {
      if (match[1] !== ownBarrel && !match[1].startsWith(`${ownBarrel}/`)) continue;
      const line = source.slice(0, match.index).split("\n").length;
      failures.push(`${path.relative(repositoryRoot, target).replaceAll(path.sep, "/")}:${line} imports its own absolute module path ${match[1]}`);
    }
  }
}

if (failures.length > 0) {
  console.error(
    `Module files must not import their own absolute module path. Use a relative internal path instead:\n${failures
      .map((failure) => `- ${failure}`)
      .join("\n")}`,
  );
  process.exitCode = 1;
} else {
  console.log(`Module self-barrel boundary check passed for ${moduleNames.length} modules.`);
}
