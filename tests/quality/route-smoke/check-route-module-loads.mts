import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, stop } from "esbuild";
import { JSDOM } from "jsdom";
import { STUDIO_SECTIONS } from "../../../src/workspaces/studio/navigation/studioSectionRegistry";

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
assert.equal(studioDefinitions.length, STUDIO_SECTIONS.length + 1, "Studio load audit must include every registered section screen plus the Studio index route");
assert.ok(studioDefinitions.some(definition => definition.routeId === "StudioIndexRoute"));

function assertRouteExport(loadedModule: Record<string, unknown> | undefined, definition: RouteModuleDefinition) {
  assert.ok(loadedModule?.[definition.exportName], `${definition.routeId} must export ${definition.exportName}`);
}

const entry = definitions.map((definition, index) =>
  `import * as route${index} from ${JSON.stringify(definition.moduleSpecifier)};`,
).join("\n") + `\nexport const modules = [${definitions.map((_, index) => `route${index}`).join(",")}];`;

// Match the canonical bundled Studio/startup smoke harness: compile actual route modules,
// transform CSS side effects for JSDOM, and keep every module/export in the audit.
// Vite's production build separately validates and emits the real CSS assets.
const options = {
  absWorkingDir: root,
  outfile: "route-module-loads.js",
  bundle: true,
  write: false,
  metafile: true,
  format: "iife" as const,
  globalName: "routeModuleFixture",
  platform: "browser" as const,
  target: ["es2022"],
  define: {
    // No API host is involved in this module-load test; Connected acceptance is separate.
    "import.meta.env": JSON.stringify({ DEV: true, PROD: false, MODE: "test", BASE_URL: "/", VITE_RUNTIME_MODE: "demo" }),
  },
  loader: { ".css": "empty" as const },
  alias: { "@": "./src" },
  logLevel: "silent" as const,
};
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});

try {
  const result = await build({ ...options, stdin: { contents: entry, resolveDir: root, sourcefile: "route-module-fixture.ts", loader: "ts" } });
  assert.ok(result.outputFiles, "The route fixture must emit an in-memory bundle");
  assert.ok(result.metafile, "The route fixture must expose its actual dependency inventory");
  const bundle = result.outputFiles.find(file => file.path.endsWith(".js"));
  assert.ok(bundle, "All real route modules must compile into the in-memory load fixture");
  assert.ok(Object.keys(result.metafile.inputs).some(file => file.endsWith(".css")), "The CSS-bearing route import must be exercised");
  dom.window.eval(bundle.text);
  const modules = dom.window.eval("routeModuleFixture.modules") as Array<Record<string, unknown>>;
  assert.equal(modules.length, definitions.length, "Every discovered route must remain in the executable fixture");
  definitions.forEach((definition, index) => assertRouteExport(modules[index], definition));

  // Negative controls must still reject absent/wrong exports and unresolved imports.
  assert.throws(() => assertRouteExport({}, definitions[0]), /must export/u);
  assert.throws(() => assertRouteExport({ wrongExport: () => undefined }, definitions[0]), /must export/u);
  await assert.rejects(() => build({ ...options, stdin: {
    contents: 'export * from "@/app/router/__missing_route_negative_control__";', resolveDir: root,
    sourcefile: "route-missing-fixture.ts", loader: "ts",
  } }), /Could not resolve/u);
} finally {
  dom.window.close();
  stop();
}

console.log(`Route module load audit passed for ${definitions.length} route modules (${studioDefinitions.length} Studio modules), including CSS and missing-import/export negative controls.`);
