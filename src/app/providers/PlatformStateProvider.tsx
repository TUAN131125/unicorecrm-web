import { isConnectedWorkspaceRuntime, getWorkspaceBootstrapSnapshot, subscribeToWorkspaceBootstrap } from "@/platform/workspace-context";
import { getAccessGovernanceRuntimeBinding, isAccessGovernanceRuntimeConfigured } from "@/platform/access-control";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAuthSessionSnapshot,
  type AuthSession,
} from "@/platform/identity-auth";
import {
  getWorkspaceConfigSnapshot,
  subscribeToWorkspaceConfig,
  updateWorkspaceConfig,
} from "@/platform/workspace-config";
import {
  getWorkspaceContextSnapshot,
  listWorkspaceMemberships,
  subscribeToWorkspaceContext,
  switchWorkspaceContext,
  type WorkspaceMembership,
} from "@/platform/workspace-context";
import type { CrmWorkspaceConfig } from "@/platform/workspace-config";
import { PlatformStateContextProvider, type PlatformStateContextValue } from "@/platform/application-state";

import { startCustomerConversionRuntime } from "@/workflows/customer-conversion";

export const PlatformStateProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const session = useAuthSessionSnapshot();
  const [, setRevision] = useState(0);
  useEffect(() => subscribeToWorkspaceBootstrap(() => setRevision((r) => r + 1)), []);
  useEffect(() => isAccessGovernanceRuntimeConfigured()
    ? getAccessGovernanceRuntimeBinding().subscribe(() => setRevision((r) => r + 1)) : undefined, []);
  if (!session || session.status !== "ACTIVE") return null;
  if (isConnectedWorkspaceRuntime()) {
    const context = getWorkspaceBootstrapSnapshot();
    const access = isAccessGovernanceRuntimeConfigured() && context ? getAccessGovernanceRuntimeBinding().getEffectiveAccess(context.workspace.workspaceId) : undefined;
    if (!context || !access || access.accountId !== session.principal.accountId
      || context.workspace.membershipId !== access.membershipId || context.workspace.memberId !== access.memberId) return null;
  }
  return <AuthenticatedPlatformStateProvider key={JSON.stringify([session.sessionId, session.principal.accountId])} session={session}>{children}</AuthenticatedPlatformStateProvider>;
};

const AuthenticatedPlatformStateProvider: React.FC<React.PropsWithChildren<{ session: AuthSession }>> = ({ children, session }) => {
  const [crmConfig, setCrmConfigState] = useState(getWorkspaceConfigSnapshot);
  const [activeWorkspace, setActiveWorkspace] = useState(getWorkspaceContextSnapshot);
  const [workspaceContextRevision, setWorkspaceContextRevision] = useState(0);

  useEffect(() => subscribeToWorkspaceConfig(setCrmConfigState), []);
  useEffect(
    () => subscribeToWorkspaceContext((workspace) => {
      setActiveWorkspace(workspace);
      setCrmConfigState(getWorkspaceConfigSnapshot());
      setWorkspaceContextRevision((revision) => revision + 1);
    }),
    [],
  );
  useEffect(() => startCustomerConversionRuntime(), [workspaceContextRevision]);

  const setCrmConfig: React.Dispatch<React.SetStateAction<CrmWorkspaceConfig>> = (updater) => {
    updateWorkspaceConfig((current) => (typeof updater === "function" ? updater(current) : updater));
  };

  const switchWorkspace = useCallback(
    (workspaceKey: string) => switchWorkspaceContext(workspaceKey),
    [],
  );

  const workspaceMemberships = listWorkspaceMemberships().map((membership) => membership.workspaceId === activeWorkspace.workspaceId ? { ...membership, name: crmConfig.name } : membership);
  const displayedActiveWorkspace = { ...activeWorkspace, name: crmConfig.name };
  const activeMembership = workspaceMemberships.find((membership) => membership.workspaceId === activeWorkspace.workspaceId) || displayedActiveWorkspace;

  const value = useMemo<PlatformStateContextValue>(
    () => ({
      session,
      crmConfig,
      setCrmConfig,
      activeWorkspace: displayedActiveWorkspace,
      activeMembership,
      workspaceMemberships,
      switchWorkspace,
      workspaceContextRevision,
    }),
    [session, crmConfig, displayedActiveWorkspace, activeMembership, workspaceMemberships, switchWorkspace, workspaceContextRevision],
  );

  return <PlatformStateContextProvider value={value}>{children}</PlatformStateContextProvider>;
};
