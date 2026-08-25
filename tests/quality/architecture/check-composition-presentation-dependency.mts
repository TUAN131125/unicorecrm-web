import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";

/**
 * Composition dependency direction (M11, DF-20).
 *
 * `check-architecture.mjs` rejects an import *specifier* that names presentation. That is
 * a text rule on one edge, and M7 walked straight past it: `connectedWorkflowServices.ts`
 * imported `@/workflows/customer-commercial-actions`, a perfectly innocent-looking
 * workflow barrel, which re-exported the Deals module barrel, which re-exported its
 * presentation components. Nothing in the composition source named presentation, and the
 * only symptom was a `.tsx` loader error inside an unrelated gate.
 *
 * The property that actually matters is a graph property: no path in the static import
 * graph may lead from application composition or module infrastructure to a presentation
 * component. So this gate builds the graph and traverses it, and reports the offending
 * path rather than the offending line.
 *
 * Scope note — the traversal follows *static* imports and re-exports only. A dynamic
 * `await import(...)` is a deliberate lazy boundary: it is what keeps the AI capability
 * from pulling the Tasks module into the entry bundle, and it does not place presentation
 * in the eager module graph that broke M7. Dynamic edges are counted and reported, never
 * traversed.
 */

const root = repositoryRoot;
const srcRoot = path.join(root, "src");
const toPosix = (value: string) => value.split(path.sep).join("/");
const relative = (file: string) => toPosix(path.relative(root, file));

const sourceFiles = walkFiles(srcRoot).filter((file: string) => /\.(?:ts|tsx)$/u.test(file));
assert.ok(sourceFiles.length > 500, `The source tree must be readable (found ${sourceFiles.length} files).`);

// ---------------------------------------------------------------------------
// 1. Static import graph.
// ---------------------------------------------------------------------------

const EXTENSIONS = [".ts", ".tsx", ".mts", ".d.ts"];
const INDEX_FILES = ["index.ts", "index.tsx", "index.mts"];

/** Resolve a module specifier the way the bundler and the test loader both do. */
function resolveSpecifier(fromFile: string, specifier: string): string | undefined {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith("./") || specifier.startsWith("../")) base = path.resolve(path.dirname(fromFile), specifier);
  else return undefined; // bare package specifier: outside the repository graph.

  for (const extension of ["", ...EXTENSIONS]) {
    const candidate = `${base}${extension}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  for (const indexFile of INDEX_FILES) {
    const candidate = path.join(base, indexFile);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

interface Edges { static: string[]; dynamic: string[] }

/**
 * Static edges are `import ... from`, `export ... from` and bare `import "…"`. Type-only
 * edges are excluded: `import type` is erased before the module ever loads, so it cannot
 * pull a component into the runtime graph.
 */
function readEdges(file: string): Edges {
  const source = fs.readFileSync(file, "utf8");
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const edges: Edges = { static: [], dynamic: [] };

  const push = (into: string[], specifier: string) => {
    const resolved = resolveSpecifier(file, specifier);
    if (resolved) into.push(resolved);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.importClause?.isTypeOnly) push(edges.static, node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.isTypeOnly) push(edges.static, node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length > 0
      && ts.isStringLiteralLike(node.arguments[0]!)
    ) {
      push(edges.dynamic, (node.arguments[0] as ts.StringLiteralLike).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return edges;
}

const graph = new Map<string, Edges>();
for (const file of sourceFiles) graph.set(file, readEdges(file));

const staticEdgeCount = [...graph.values()].reduce((total, edges) => total + edges.static.length, 0);
const dynamicEdgeCount = [...graph.values()].reduce((total, edges) => total + edges.dynamic.length, 0);
assert.ok(
  staticEdgeCount > 1000,
  `The import graph must actually be populated (found ${staticEdgeCount} static edges). An empty graph would make `
    + "every traversal below pass vacuously.",
);

// ---------------------------------------------------------------------------
// 2. What counts as presentation.
// ---------------------------------------------------------------------------

/**
 * A React component module.
 *
 * The subject is `.tsx`, not "anything under a presentation folder". That is deliberate
 * and it is the precise property M7 violated: a component module is what the test loader
 * could not parse, what drags React into a non-UI graph, and what a wiring module has no
 * reason to load. A presentation *model* (`customerPresentation.ts`) is plain TypeScript
 * that happens to live next to components; treating it as a component would force every
 * module barrel to be split without protecting anything.
 */
const isComponentModule = (file: string): boolean => relative(file).endsWith(".tsx");

/** A component owned by a product surface: module, workflow or workspace UI. */
const isProductComponent = (file: string): boolean => {
  const relativePath = relative(file);
  if (!isComponentModule(file)) return false;
  if (/^src\/(?:components|features)\//u.test(relativePath)) return true;
  return /\/presentation\//u.test(relativePath);
};

/**
 * A component published by a cross-cutting library — `@/platform/<capability>` or
 * `@/shared/*` — alongside the contracts that non-UI code is required to import.
 */
const isLibraryComponent = (file: string): boolean => {
  const relativePath = relative(file);
  return isComponentModule(file) && /^src\/(?:platform|shared)\//u.test(relativePath);
};

// ---------------------------------------------------------------------------
// 3. Wiring roots.
// ---------------------------------------------------------------------------

const compositionRoots = sourceFiles.filter((file) => /^src\/app\/composition\//u.test(relative(file)));
assert.ok(compositionRoots.length > 0, "Application composition must be present.");

const infrastructureRoots = sourceFiles.filter((file) => /^src\/modules\/[^/]+\/infrastructure\//u.test(relative(file)));
assert.ok(infrastructureRoots.length > 0, "Module infrastructure must be present.");

/**
 * Composition files allowed to reach a product component transitively.
 *
 * `demoApplicationServiceBundle.ts` is the demo composition: it wires the demo-owned local
 * workflow runtimes, and those runtimes import module barrels (`@/modules/deals`,
 * `@/modules/tasks`) to reach the snapshot commands they coordinate. Those barrels also
 * re-export the module's form components, so the demo bundle reaches them.
 *
 * That is the sanctioned demo seam — `quality.workflow-coordinator-ownership` already pins
 * this same file as the only permitted importer of the local WF-01 runtime — and unpicking
 * it means splitting every module barrel, which is a repository-wide refactor rather than a
 * gate change. It is carried as a deferred finding.
 *
 * What matters is that the CONNECTED composition and module infrastructure stay clean, and
 * the exemption is one exact filename: any other composition file that acquires a transitive
 * presentation dependency — the M7 defect — fails below.
 */
const sanctionedRoots = new Set<string>([
  "src/app/composition/demoApplicationServiceBundle.ts",
]);

/**
 * Breadth-first search for the shortest static path from `start` to a matching module.
 *
 * `frontier` marks modules the search may reach but must not expand through. It exists so
 * one root cause is reported once: a platform React adapter is its own reviewed boundary
 * (section 4), and continuing through it would re-report every component that adapter
 * happens to render as if composition had reached it directly.
 */
function findPath(
  start: string,
  matches: (file: string) => boolean,
  frontier: (file: string) => boolean = () => false,
): string[] | undefined {
  const seen = new Set<string>([start]);
  const queue: string[][] = [[start]];
  while (queue.length > 0) {
    const trail = queue.shift()!;
    const current = trail[trail.length - 1]!;
    for (const next of graph.get(current)?.static ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      const extended = [...trail, next];
      if (matches(next)) return extended;
      if (frontier(next)) continue;
      queue.push(extended);
    }
  }
  return undefined;
}

const findPresentationPath = (start: string) => findPath(start, isProductComponent, isLibraryComponent);

const violations: string[] = [];
for (const rootFile of [...compositionRoots, ...infrastructureRoots]) {
  if (sanctionedRoots.has(relative(rootFile))) continue;
  const trail = findPresentationPath(rootFile);
  if (!trail) continue;
  violations.push(trail.map(relative).join("\n      -> "));
}

assert.deepEqual(
  violations,
  [],
  "Application composition and module infrastructure must not reach a presentation component through the static "
    + "import graph. A barrel in the middle of the path is still a dependency: it loads the component when the "
    + "wiring module loads. Import the specific application or availability module instead of the barrel.\n\n  "
    + violations.join("\n\n  "),
);

// ---------------------------------------------------------------------------
// 4. Platform React adapters reachable from wiring — an explicit review boundary.
//
// A platform capability barrel such as `@/platform/access-control` publishes its runtime
// authorization helpers *and* its React adapters from one entry point, and module
// application code is required to use that entry point: `check-architecture.mjs` forbids
// application code from importing any `/runtime/` path directly, so the barrel is the only
// sanctioned route to `assertRuntimeCapability`.
//
// That means wiring code legitimately reaches a platform `.tsx` today. It is the same
// latent hazard as M7 — a component sitting in the eager graph of a non-UI module — but
// splitting platform barrels is a platform-wide refactor, not an M11 gate change, so it is
// carried as a deferred finding instead of silently ignored.
//
// The inventory is therefore exact rather than a pattern exemption: a NEW platform React
// module appearing in wiring's reach fails this gate until it is reviewed, and a chain
// that disappears must be removed from the pin.
// ---------------------------------------------------------------------------

const platformReactReach = new Map<string, string>();
for (const rootFile of [...compositionRoots, ...infrastructureRoots]) {
  const trail = findPath(rootFile, isLibraryComponent);
  if (!trail) continue;
  platformReactReach.set(relative(rootFile), trail.map(relative).join(" -> "));
}

const pinnedPlatformReactReach = [
  "src/app/composition/demoApplicationServiceBundle.ts",
  "src/modules/payments/infrastructure/InMemoryPaymentApiAdapter.ts",
];

assert.deepEqual(
  [...platformReactReach.keys()].sort(),
  pinnedPlatformReactReach.slice().sort(),
  "The set of wiring modules that transitively reach a platform React adapter must match exactly. A new entry is "
    + "the M7 shape reappearing: import the specific platform module rather than the capability barrel, or review "
    + "and pin it here.\nObserved:\n"
    + [...platformReactReach.values()].map((trail) => `  ${trail}`).join("\n"),
);

// ---------------------------------------------------------------------------
// 5. The traversal must be able to fail.
//
// A graph search that never reaches presentation from anywhere would report "clean" for
// the wrong reason. Prove the machinery works by finding a path from a real presentation
// entry point, using the same resolver, the same edges and the same predicate.
// ---------------------------------------------------------------------------

const applicationEntry = sourceFiles.find((file) => relative(file) === "src/app/AppRoutes.tsx")
  ?? sourceFiles.find((file) => relative(file) === "src/main.tsx");
assert.ok(applicationEntry, "An application entry point must exist to self-test the traversal.");
assert.ok(
  findPresentationPath(applicationEntry) !== undefined || isProductComponent(applicationEntry),
  "The traversal must be able to reach presentation from the application entry point. If it cannot, the resolver is "
    + "broken and every clean result above is vacuous.",
);

console.log(
  `quality.composition-presentation-dependency: PASS (${graph.size} modules, ${staticEdgeCount} static and `
    + `${dynamicEdgeCount} dynamic edges; ${compositionRoots.length} composition and ${infrastructureRoots.length} `
    + `infrastructure roots traversed, ${sanctionedRoots.size} sanctioned demo root(s) exempt, `
    + `${platformReactReach.size} pinned library-component reaches, zero unreviewed transitive paths to a product `
    + "component).",
);
