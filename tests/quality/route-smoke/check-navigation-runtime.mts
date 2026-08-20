import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { matchRoutes, type RouteObject } from "react-router-dom";
import { DEFAULT_CRM_WORKSPACE_CONFIG } from "../../../src/platform/workspace-config/workspaceConfigDefaults";
import { createCrmWorkspaceRoutes } from "../../../src/app/router/workspaces/crmWorkspaceRoutes";
import { createPeopleAccessWorkspaceRoutes } from "../../../src/app/router/workspaces/peopleAccessWorkspaceRoutes";
import { createStudioWorkspaceRoutes } from "../../../src/app/router/workspaces/studioWorkspaceRoutes";

const root = repositoryRoot;
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const main = source("src/main.tsx");
const crmRoutes = source("src/app/router/CrmRoutes.tsx");
const routeBoundary = source("src/app/router/runtime/RouteScreenBoundary.tsx");
const routeWrapper = source("src/app/router/runtime/wrapRouteTreeWithScreenBoundaries.tsx");
const lazyRouteRuntime = source("src/app/router/runtime/lazyRouteComponent.ts");
const routeErrorRuntime = source("src/app/router/runtime/routeScreenErrors.ts");
const routeErrorBoundary = source("src/components/LazyRouteErrorBoundary.tsx");

assert.ok(main.includes("createHashRouter"), "Hash routing must be owned by a data router so shell blockers receive DataRouterContext");
assert.ok(main.includes("RouterProvider"), "The router owner must provide DataRouterContext");
assert.match(main, /<RouterProvider\s+router=\{router\}\s+useTransitions=\{false\}/, "Router transition deferral must be disabled at the owner boundary");
assert.equal(/import\s*\{[^}]*\bHashRouter\b/.test(main), false, "Declarative HashRouter cannot host the shell useBlocker contract");
assert.ok(crmRoutes.includes("useRoutes(routeTree, resolveQuickSetupBackground(location))"), "Route matching must preserve the committed location behind the Quick Setup overlay");
assert.ok(crmRoutes.includes("<QuickSetupRouteOverlay />"), "Quick Setup must compose as a route overlay");
assert.ok(crmRoutes.includes("wrapRouteTreeWithScreenBoundaries(routes"), "All product-space routes must be isolated from lazy suspension");
assert.equal(crmRoutes.includes("useRoutes(routeTree, location)"), false, "CrmRoutes must not pass the unmodified location as a pathname-key workaround");
assert.equal(crmRoutes.includes("routeRenderKey"), false, "Global route render keys must not control navigation recovery");
assert.ok(routeBoundary.includes("<Suspense"), "Each route screen must catch its own lazy suspension");
assert.ok(routeBoundary.includes("<LazyRouteErrorBoundary"), "Each route screen must catch its own load/runtime error");
assert.ok(routeBoundary.includes("location.pathname"), "Route screen error boundaries must reset for the committed pathname");
assert.ok(routeBoundary.includes('data-loading-pathname={pathname}'), "Loading UI must expose the target pathname for diagnostics");
assert.ok(routeBoundary.includes("LazyRouteErrorBoundary key={resetKey}"), "Route failures must reset when the target pathname changes");
assert.ok(routeBoundary.includes("routeId={routeId}"), "Route error diagnostics must retain the owning route ID");
assert.ok(routeBoundary.includes('const resetKey = `${routeId}:${location.pathname}`'), "Route boundaries must reset by screen pathname only");
assert.equal(routeBoundary.includes('${location.search}'), false, "Query-backed tabs must not remount the whole route screen");
assert.ok(routeWrapper.includes("wrapRouteTreeWithScreenBoundaries(route.children"), "Route boundary wrapping must recurse through nested route trees");
assert.ok(lazyRouteRuntime.includes("Promise.race"), "Lazy route loading must have a timeout race");
assert.ok(lazyRouteRuntime.includes("DEFAULT_ROUTE_LOAD_TIMEOUT_MS = 15_000"), "Hung route chunks must have a deterministic timeout");
assert.ok(lazyRouteRuntime.includes("did not load within"), "Hung route chunks must fail visibly instead of loading forever");
assert.ok(lazyRouteRuntime.includes("RouteModuleLoadError"), "Lazy route failures must preserve a structured module-load error");
assert.ok(routeErrorRuntime.includes('"MODULE_LOAD" | "CONFIGURATION" | "RENDER"'), "Route failures must distinguish module, configuration and render errors");
assert.ok(routeErrorBoundary.includes("data-route-error-kind"), "Route error UI must expose the classified failure kind");
assert.ok(routeErrorBoundary.includes("routeId={routeId}") === false, "The route ID is supplied by RouteScreenBoundary rather than hard-coded in the error component");
assert.equal(routeErrorBoundary.includes("A network or interface loading error occurred"), false, "Render failures must not be mislabeled as network errors");

for (const routeFile of [
  "src/app/router/workspaces/crmWorkspaceRoutes.tsx",
  "src/app/router/workspaces/studioWorkspaceRoutes.tsx",
  "src/app/router/workspaces/peopleAccessWorkspaceRoutes.tsx",
]) {
  const text = source(routeFile);
  assert.ok(text.includes("lazyRouteComponent"), `${routeFile} must use the guarded route loader`);
  assert.equal(text.includes("= lazy("), false, `${routeFile} must not bypass the guarded route loader`);
}

const routeTree: RouteObject[] = [
  { path: "/w/:workspaceKey/crm", children: createCrmWorkspaceRoutes(DEFAULT_CRM_WORKSPACE_CONFIG) },
  { path: "/w/:workspaceKey/studio", children: createStudioWorkspaceRoutes() },
  { path: "/w/:workspaceKey/people", children: createPeopleAccessWorkspaceRoutes() },
];

const expectedRoutes = [
  ["/w/unicore-vietnam/crm/dashboard", "dashboard"],
  ["/w/unicore-vietnam/crm/leads", "leads"],
  ["/w/unicore-vietnam/crm/contacts", "contacts"],
  ["/w/unicore-vietnam/crm/organizations", "organizations"],
  ["/w/unicore-vietnam/crm/orders", "orders"],
  ["/w/unicore-vietnam/studio/settings/business-information", "settings/business-information"],
  ["/w/unicore-vietnam/studio/settings/pipelines-statuses", "settings/pipelines-statuses"],
  ["/w/unicore-vietnam/people/members", "members"],
  ["/w/unicore-vietnam/people/roles", "roles"],
] as const;
for (const [pathname, expectedLeaf] of expectedRoutes) {
  const matches = matchRoutes(routeTree, pathname);
  assert.ok(matches, `${pathname} must resolve`);
  assert.equal(matches.at(-1)?.route.path, expectedLeaf, `${pathname} must resolve to ${expectedLeaf}`);
}
const organizations = matchRoutes(routeTree, "/w/unicore-vietnam/crm/organizations");
assert.notEqual(organizations?.at(-1)?.route.path, "leads", "Organizations can never resolve to the Lead route");

const redirects = source("src/app/router/redirects/CanonicalRouteRedirects.tsx");
assert.ok(redirects.includes("CanonicalRouteNotFound"), "Canonical wildcard misses must render an explicit not-found state");
assert.ok(redirects.includes('data-route-state="not-found"'), "Canonical route misses need a testable not-found state");
assert.ok(redirects.includes("Trang này không còn tồn tại hoặc đã được chuyển"), "Route fallback must render a clear user-facing not-found state");

console.log("Navigation runtime contracts: OK");
