export type QuickSetupStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export const QUICK_SETUP_FLOW_VERSION = 3;

export type QuickSetupStepId =
  | "business-profile"
  | "locale-currency"
  | "workspace-blueprint";

export const QUICK_SETUP_STEP_IDS: readonly QuickSetupStepId[] = [
  "business-profile",
  "locale-currency",
  "workspace-blueprint",
] as const;

export interface QuickSetupState {
  status: QuickSetupStatus;
  currentStepId: QuickSetupStepId | null;
  completedStepIds: QuickSetupStepId[];
  skippedStepIds: QuickSetupStepId[];
  autoOpenDismissedAt: string | null;
  lastOpenedAt: string | null;
  completedAt: string | null;
  revision: number;
  flowVersion: number;
}

export function shouldAutoOpenQuickSetup(state: QuickSetupState, canConfigure: boolean): boolean {
  return canConfigure && state.status === "NOT_STARTED" && state.autoOpenDismissedAt === null;
}
