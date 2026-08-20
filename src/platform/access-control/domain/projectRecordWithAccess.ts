import type { EffectiveAccess } from "./accessControl.types";

/**
 * Applies record-level authorization and field security to a single read model.
 * The function is intentionally pure so repositories, projections, and tests use
 * the same policy semantics without depending on browser/session runtime state.
 */
export function projectRecordWithAccess<T extends Record<string, unknown>>(
  access: EffectiveAccess,
  resourceKey: string,
  record: T,
): T | null {
  if (!access.canAccessRecord(resourceKey, record)) return null;

  const projected = { ...record } as Record<string, unknown>;
  Object.keys(projected).forEach((fieldKey) => {
    const fieldAccess = access.getFieldAccess(resourceKey, fieldKey);
    if (fieldAccess === "HIDDEN") delete projected[fieldKey];
    else if (fieldAccess === "MASKED") projected[fieldKey] = "••••••";
  });

  return projected as T;
}
