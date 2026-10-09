import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useEffectiveAccess } from "@/platform/access-control";

export function useContactReadAuthorityScope(): string {
  const { workspaceId } = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  return JSON.stringify([workspaceId, access.accountId, access.membershipId, access.memberId, access.authorityRevision]);
}
