import React, { createContext, useContext } from "react";
import type { AuthSession } from "@/platform/identity-auth";
import type { CrmWorkspaceConfig } from "@/platform/workspace-config";
import type { WorkspaceMembership } from "@/platform/workspace-context";

export interface PlatformStateContextValue {
  session: AuthSession;
  crmConfig: CrmWorkspaceConfig;
  setCrmConfig: React.Dispatch<React.SetStateAction<CrmWorkspaceConfig>>;
  activeWorkspace: WorkspaceMembership;
  activeMembership: WorkspaceMembership;
  workspaceMemberships: WorkspaceMembership[];
  switchWorkspace: (workspaceKey: string) => Promise<WorkspaceMembership>;
  workspaceContextRevision: number;
}

const PlatformStateContext = createContext<PlatformStateContextValue | null>(null);

export interface PlatformStateContextProviderProps extends React.PropsWithChildren {
  value: PlatformStateContextValue;
}

export const PlatformStateContextProvider: React.FC<PlatformStateContextProviderProps> = ({ value, children }) => (
  <PlatformStateContext.Provider value={value}>{children}</PlatformStateContext.Provider>
);

export const usePlatformState = (): PlatformStateContextValue => {
  const context = useContext(PlatformStateContext);
  if (!context) throw new Error("usePlatformState must be used inside PlatformStateProvider.");
  return context;
};
