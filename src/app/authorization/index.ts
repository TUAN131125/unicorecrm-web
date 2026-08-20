import type { CanonicalProductSpace } from "@/platform/navigation";
import type { EffectiveAccess } from "@/platform/access-control";

export type EffectiveShellAccess = EffectiveAccess;
export { useEffectiveShellAccess } from "./useEffectiveShellAccess";

export function firstAccessibleProductSpace(
  access: Pick<EffectiveAccess, "productSpaces">,
): CanonicalProductSpace | null {
  return (["crm", "studio", "people"] as const).find((space) => access.productSpaces.has(space)) || null;
}
