const RECORD_ROUTE_PREFIXES: Record<string, string> = {
  support: "/support/cases",
};

/**
 * Resolves owner-module record links used by Customer, Contact and Organization
 * coordinators. Relationship pages never own the destination record; they only
 * route operators to the module that owns it.
 */
export function relationshipRecordPath(moduleKey: string, recordId: string): string {
  const normalizedModule = moduleKey.replace(/^\/+|\/+$/g, "");
  const normalizedId = encodeURIComponent(recordId);
  const prefix = RECORD_ROUTE_PREFIXES[normalizedModule] ?? `/${normalizedModule}`;
  return `${prefix}/${normalizedId}`;
}
