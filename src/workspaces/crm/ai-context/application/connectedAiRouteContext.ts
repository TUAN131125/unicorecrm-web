import { parseCanonicalRoute } from "@/platform/navigation";
import { buildGlobalAiContext, type AiContextWrapper } from "./aiContextBuilder";

/** A route supplies a reference, never browser-held CRM facts or read authority. */
export function buildConnectedAiRouteContext(pathname?: string): AiContextWrapper {
  const context = buildGlobalAiContext({ leads: [], contacts: [], customers: [], deals: [], quotes: [], orders: [], cases: [], products: [] });
  if (!pathname) return context;
  const canonical = parseCanonicalRoute(pathname);
  const path = canonical?.relativePath ? `/${canonical.relativePath}` : pathname;
  const match = /^\/(leads|contacts|customers|organizations|deals|tasks)\/([^/]+)$/u.exec(path);
  const types = { leads: "lead", contacts: "contact", customers: "customer", organizations: "organization", deals: "deal", tasks: "task" } as const;
  if (!match?.[1] || !match[2] || !(match[1] in types)) return context;
  try {
    context.focusedItem = { entityType: types[match[1] as keyof typeof types], data: { id: decodeURIComponent(match[2]) } };
  } catch { /* A malformed route supplies no reference. */ }
  return context;
}
