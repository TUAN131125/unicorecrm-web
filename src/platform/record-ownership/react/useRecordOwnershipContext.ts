import { useMemo } from "react";
import type { Capability } from "@/platform/access-control";
import { useEffectiveAccess } from "@/platform/access-control";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type { OwnershipResourceKey } from "../domain/recordOwnership.types";
import { getRecordOwnershipContext } from "../runtime/recordOwnershipRuntime";

export function useRecordOwnershipContext(resourceKey: OwnershipResourceKey, assignCapability: Capability) {
  const session = useAuthSessionSnapshot();
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  return useMemo(
    () => getRecordOwnershipContext(resourceKey, assignCapability),
    [resourceKey, assignCapability, session?.sessionId, workspace.workspaceId, access.capabilities, access.memberId],
  );
}
