import { getShippingBookingCollectionResource } from "../../application/vertical-slice/shippingAuthoritativeQueries";
import { replaceShippingSnapshot } from "../../public/api";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useShippingAuthoritative() {
  const workspace = useWorkspaceContextSnapshot();
  return useModuleAuthoritativeResource(getShippingBookingCollectionResource(), {
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceShippingSnapshot([]),
  });
}
