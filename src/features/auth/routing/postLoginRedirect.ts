import { parseCanonicalRoute } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";

const SAFE_NON_WORKSPACE_DESTINATIONS = new Set<string>([
  ROUTE_KEYS.WORKSPACE_SELECTION,
  ROUTE_KEYS.INVITATION_ACCEPTANCE,
]);

function hasValidPercentEncoding(value: string): boolean {
  try {
    decodeURI(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Accepts the value returned by URLSearchParams.get(). It must not be decoded
 * again. Only canonical in-app destinations are returned.
 */
export function resolveSafePostLoginRedirect(rawRedirect: string | null | undefined): string | null {
  if (!rawRedirect) return null;
  const candidate = rawRedirect.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;
  if (candidate.includes("\\") || /[\u0000-\u001F\u007F]/u.test(candidate)) return null;
  if (!hasValidPercentEncoding(candidate)) return null;

  try {
    const url = new URL(candidate, "https://unicorecrm.invalid");
    if (url.origin !== "https://unicorecrm.invalid") return null;
    const isCanonicalWorkspaceRoute = parseCanonicalRoute(url.pathname) !== null;
    const isSafeStaticRoute = SAFE_NON_WORKSPACE_DESTINATIONS.has(url.pathname);
    if (!isCanonicalWorkspaceRoute && !isSafeStaticRoute) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function withRedirectQuery(path: string, redirect: string): string {
  const params = new URLSearchParams({ redirect });
  return `${path}?${params.toString()}`;
}
