import { parseCanonicalRoute, stripLeadingSlash, type CanonicalProductSpace } from "@/platform/navigation";
import { ROUTE_METADATA } from "@/app/routes/routeMeta";
import { SCREEN_GUIDANCE_BY_ID } from "./guidanceRegistry";
import type { CapabilityPredicate, ScreenGuidance } from "@/guidance/domain/guidance.types";

const PEOPLE_ROUTE_GUIDANCE: Record<string, string> = {
  members: "people.members.access",
  roles: "people.roles.access",
  audit: "people.audit.access",
};

function routePatternMatches(pattern: string, relativePath: string): boolean {
  const patternParts = stripLeadingSlash(pattern).split("/").filter(Boolean);
  const pathParts = stripLeadingSlash(relativePath).split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

function routeSpecificity(path: string): number {
  return stripLeadingSlash(path)
    .split("/")
    .filter(Boolean)
    .reduce((score, part) => score + (part.startsWith(":") ? 1 : 10), 0);
}

export type ResolvedGuidanceContext = {
  workspaceKey: string;
  productSpace: CanonicalProductSpace;
  relativePath: string;
  routeKey?: string;
  guidance?: ScreenGuidance;
};

export function resolveGuidanceContext(pathname: string, _can: CapabilityPredicate): ResolvedGuidanceContext | null {
  const canonical = parseCanonicalRoute(pathname);
  if (!canonical) return null;

  if (canonical.productSpace === "people") {
    const segment = stripLeadingSlash(canonical.relativePath).split("/")[0] || "members";
    const guidance = SCREEN_GUIDANCE_BY_ID.get(PEOPLE_ROUTE_GUIDANCE[segment]);
    return {
      ...canonical,
      routeKey: guidance?.routeKey,
      guidance,
    };
  }

  const matches = Object.entries(ROUTE_METADATA)
    .filter(([, meta]) => meta.guidanceId && routePatternMatches(meta.path, canonical.relativePath))
    .sort(([, left], [, right]) => routeSpecificity(right.path) - routeSpecificity(left.path));
  const [routeKey, meta] = matches[0] || [];
  const guidance = meta?.guidanceId ? SCREEN_GUIDANCE_BY_ID.get(meta.guidanceId) : undefined;

  return {
    ...canonical,
    routeKey,
    guidance: guidance && guidance.productSpace === canonical.productSpace ? guidance : undefined,
  };
}
