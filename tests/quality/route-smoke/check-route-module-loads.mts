import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const routeFiles = [
  "src/app/router/workspaces/crmWorkspaceRoutes.tsx",
  "src/app/router/workspaces/studioWorkspaceRoutes.tsx",
  "src/app/router/workspaces/peopleAccessWorkspaceRoutes.tsx",
] as const;

interface RouteModuleDefinition {
  routeFile: string;
  routeId: string;
  moduleSpecifier: string;
  exportName: string;
}

const definitions: RouteModuleDefinition[] = [];
const definitionPattern = /lazyRouteComponent\s*\(\s*["']([^"']+)["']\s*,\s*\(\s*\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)\s*,\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>\s*\3\.([A-Za-z0-9_]+)\s*[,)]/gu;

for (const relativePath of routeFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const pattern = new RegExp(definitionPattern.source, definitionPattern.flags);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    definitions.push({
      routeFile: relativePath,
      routeId: match[1],
      moduleSpecifier: match[2],
      exportName: match[4],
    });
  }
}

assert.ok(definitions.length >= 60, "All canonical lazy route modules must be included in the load audit");
assert.equal(new Set(definitions.map((definition) => definition.routeId)).size, definitions.length, "Lazy route IDs must be unique");
const studioDefinitions = definitions.filter((definition) => definition.routeFile.endsWith("studioWorkspaceRoutes.tsx"));
assert.equal(studioDefinitions.length, 12, "Studio load audit must include eleven section screens plus the Studio index route");

for (const definition of definitions) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Timed out loading ${definition.routeId}`)), 10_000);
  });

  try {
    const loadedModule = await Promise.race([
      import(definition.moduleSpecifier),
      timeout,
    ]);

    assert.ok(
      loadedModule[definition.exportName as keyof typeof loadedModule],
      `${definition.routeId} must export ${definition.exportName}`,
    );
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

console.log(`Route module load audit passed for ${definitions.length} route modules (${studioDefinitions.length} Studio modules).`);
