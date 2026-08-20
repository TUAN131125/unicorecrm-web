export type CanonicalProductSpace = "crm" | "studio" | "people";

export interface CanonicalRouteContext {
  workspaceKey: string;
  productSpace: CanonicalProductSpace;
  relativePath: string;
}

export const CANONICAL_PRODUCT_SPACES: readonly CanonicalProductSpace[] = [
  "crm",
  "studio",
  "people",
] as const;

export const DEFAULT_WORKSPACE_KEY = "unicore-vietnam";

const CANONICAL_PREFIX = "/w/";

export function stripLeadingSlash(pathname: string): string {
  return pathname.replace(/^\/+/, "");
}

export function workspaceSpaceBase(
  workspaceKey: string,
  productSpace: CanonicalProductSpace,
): string {
  return `/w/${workspaceKey}/${productSpace}`;
}

export function toWorkspacePath(
  workspaceKey: string,
  productSpace: CanonicalProductSpace,
  path = "",
): string {
  const relative = stripLeadingSlash(path);
  return relative
    ? `${workspaceSpaceBase(workspaceKey, productSpace)}/${relative}`
    : workspaceSpaceBase(workspaceKey, productSpace);
}

export function parseCanonicalRoute(pathname: string): CanonicalRouteContext | null {
  const match = pathname.match(/^\/w\/([^/]+)\/(crm|studio|people)(?:\/(.*))?\/?$/);
  if (!match) return null;
  return {
    workspaceKey: decodeURIComponent(match[1]),
    productSpace: match[2] as CanonicalProductSpace,
    relativePath: match[3] || "",
  };
}

export function relativeRoutePath(path: string): string {
  return stripLeadingSlash(path);
}

export function productSpaceHome(
  workspaceKey: string,
  productSpace: CanonicalProductSpace,
): string {
  if (productSpace === "crm") return toWorkspacePath(workspaceKey, "crm", "dashboard");
  if (productSpace === "studio") return toWorkspacePath(workspaceKey, "studio");
  return toWorkspacePath(workspaceKey, "people", "members");
}

export function inferLegacyProductSpace(pathname: string): CanonicalProductSpace {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (
    normalized.startsWith("/settings/users-permissions") ||
    normalized.startsWith("/settings/roles-permissions") ||
    normalized.startsWith("/settings/audit-logs")
  ) {
    return "people";
  }
  if (normalized.startsWith("/settings/")) return "studio";
  return "crm";
}

export function canonicalizeLegacyPath(workspaceKey: string, pathname: string): string {
  const productSpace = inferLegacyProductSpace(pathname);

  if (productSpace === "people") {
    if (pathname.startsWith("/settings/audit-logs")) {
      return toWorkspacePath(workspaceKey, "people", "audit");
    }
    return toWorkspacePath(workspaceKey, "people", "members");
  }

  return toWorkspacePath(workspaceKey, productSpace, pathname);
}

export function isCanonicalRoute(pathname: string): boolean {
  return pathname.startsWith(CANONICAL_PREFIX) && parseCanonicalRoute(pathname) !== null;
}
