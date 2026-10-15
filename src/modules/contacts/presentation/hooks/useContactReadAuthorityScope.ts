import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useEffectiveAccess } from "@/platform/access-control";

export function useContactReadAuthorityScope(): string {
  const { workspaceId } = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  const session = useAuthSessionSnapshot();
  return JSON.stringify([workspaceId, access.accountId, access.membershipId, access.memberId, access.authorityRevision, session?.status ?? null, session?.sessionId ?? null, session?.principal.accountId ?? null]);
}
