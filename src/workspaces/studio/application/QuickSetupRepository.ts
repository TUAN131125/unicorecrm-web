import type { QuickSetupState, QuickSetupStepId } from "./quickSetup.types";

export interface QuickSetupRepository {
  getState(): QuickSetupState;
  open(): QuickSetupState;
  dismissAutoOpen(): QuickSetupState;
  completeStep(stepId: QuickSetupStepId): QuickSetupState;
  skipStep(stepId: QuickSetupStepId): QuickSetupState;
  subscribe(listener: (state: QuickSetupState) => void): () => void;
}
