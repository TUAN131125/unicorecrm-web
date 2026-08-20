import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAuthSessionSnapshot,
  subscribeToAuthSession,
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
  const initialSession = getAuthSessionSnapshot();
  if (!initialSession) throw new Error("PlatformStateProvider requires an authenticated session.");

  const [session, setSession] = useState<AuthSession>(initialSession);
  const [crmConfig, setCrmConfigState] = useState(getWorkspaceConfigSnapshot);
  const [activeWorkspace, setActiveWorkspace] = useState(getWorkspaceContextSnapshot);
  const [workspaceContextRevision, setWorkspaceContextRevision] = useState(0);

  useEffect(() => subscribeToAuthSession((next) => {
    if (next) setSession(next);
  }), []);
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
