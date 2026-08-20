import type { QuickSetupStepId } from "../application/quickSetup.types";
import {
  completeStudioQuickSetupStateStep,
  dismissStudioQuickSetupState,
  getStudioQuickSetupState,
  openStudioQuickSetupState,
  skipStudioQuickSetupStateStep,
  subscribeToStudioQuickSetup,
} from "./studioCoreRuntime";

export const getQuickSetupState = () => getStudioQuickSetupState();
export const openQuickSetup = () => openStudioQuickSetupState();
export const dismissQuickSetupAutoOpen = () => dismissStudioQuickSetupState();
export const completeQuickSetupStep = (stepId: QuickSetupStepId) => completeStudioQuickSetupStateStep(stepId);
export const skipQuickSetupStep = (stepId: QuickSetupStepId) => skipStudioQuickSetupStateStep(stepId);
export const subscribeToQuickSetup = (listener: (state: ReturnType<typeof getStudioQuickSetupState>) => void) => subscribeToStudioQuickSetup(listener);
