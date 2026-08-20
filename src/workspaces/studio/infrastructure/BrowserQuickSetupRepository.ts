import type { StoragePort } from "@/platform/persistence";
import type { QuickSetupRepository } from "../application/QuickSetupRepository";
import {
  QUICK_SETUP_FLOW_VERSION,
  QUICK_SETUP_STEP_IDS,
  type QuickSetupState,
  type QuickSetupStepId,
} from "../application/quickSetup.types";

const KEY = "quick-setup-metadata";

export const EMPTY_QUICK_SETUP_STATE: QuickSetupState = {
  status: "NOT_STARTED",
  currentStepId: null,
  completedStepIds: [],
  skippedStepIds: [],
  autoOpenDismissedAt: null,
  lastOpenedAt: null,
  completedAt: null,
  revision: 1,
  flowVersion: QUICK_SETUP_FLOW_VERSION,
};

function normalizeState(value: QuickSetupState | null | undefined): QuickSetupState {
  if (!value) return structuredClone(EMPTY_QUICK_SETUP_STATE);

  if (value.flowVersion !== QUICK_SETUP_FLOW_VERSION) {
    return {
      ...structuredClone(EMPTY_QUICK_SETUP_STATE),
      autoOpenDismissedAt: value.autoOpenDismissedAt ?? null,
      revision: typeof value.revision === "number" ? value.revision : 1,
    };
  }

  const isKnownStep = (stepId: string): stepId is QuickSetupStepId => QUICK_SETUP_STEP_IDS.includes(stepId as QuickSetupStepId);
  const completedStepIds = value.completedStepIds.filter(isKnownStep);
  const skippedStepIds = value.skippedStepIds.filter((stepId) => isKnownStep(stepId) && !completedStepIds.includes(stepId));
  const currentStepId = value.currentStepId && isKnownStep(value.currentStepId) ? value.currentStepId : null;

  const nextStepId = QUICK_SETUP_STEP_IDS.find((stepId) => !completedStepIds.includes(stepId) && !skippedStepIds.includes(stepId)) ?? null;
  const completed = nextStepId === null;

  return {
    ...value,
    flowVersion: QUICK_SETUP_FLOW_VERSION,
    completedStepIds,
    skippedStepIds,
    currentStepId: completed ? null : (currentStepId ?? nextStepId),
    status: completed ? "COMPLETED" : (value.status === "NOT_STARTED" ? "NOT_STARTED" : "IN_PROGRESS"),
    completedAt: completed ? value.completedAt ?? new Date().toISOString() : null,
    revision: typeof value.revision === "number" ? value.revision : 1,
  };
}

export class BrowserQuickSetupRepository implements QuickSetupRepository {
  private readonly listeners = new Set<(state: QuickSetupState) => void>();
  private current: QuickSetupState;

  constructor(private readonly storage: StoragePort) {
    this.current = normalizeState(this.storage.get<QuickSetupState>(KEY));
    this.storage.set(KEY, this.current);
  }

  getState(): QuickSetupState { return structuredClone(this.current); }

  open(): QuickSetupState {
    const firstPending = QUICK_SETUP_STEP_IDS.find((stepId) => !this.current.completedStepIds.includes(stepId) && !this.current.skippedStepIds.includes(stepId))
      ?? QUICK_SETUP_STEP_IDS[0];
    const completed = this.current.status === "COMPLETED";
    return this.commit({
      ...this.current,
      status: completed ? "COMPLETED" : "IN_PROGRESS",
      currentStepId: completed ? null : (this.current.currentStepId ?? firstPending),
      lastOpenedAt: new Date().toISOString(),
    });
  }

  dismissAutoOpen(): QuickSetupState {
    return this.commit({ ...this.current, autoOpenDismissedAt: new Date().toISOString() });
  }

  completeStep(stepId: QuickSetupStepId): QuickSetupState {
    return this.finishStep(stepId, "complete");
  }

  skipStep(stepId: QuickSetupStepId): QuickSetupState {
    return this.finishStep(stepId, "skip");
  }

  subscribe(listener: (state: QuickSetupState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private finishStep(stepId: QuickSetupStepId, outcome: "complete" | "skip"): QuickSetupState {
    const completedStepIds = outcome === "complete"
      ? [...new Set([...this.current.completedStepIds, stepId])]
      : this.current.completedStepIds.filter((id) => id !== stepId);
    const skippedStepIds = outcome === "skip"
      ? [...new Set([...this.current.skippedStepIds.filter((id) => id !== stepId), stepId])]
      : this.current.skippedStepIds.filter((id) => id !== stepId);
    const nextStepId = QUICK_SETUP_STEP_IDS.find((id) => !completedStepIds.includes(id) && !skippedStepIds.includes(id)) ?? null;
    const completed = nextStepId === null;
    return this.commit({
      ...this.current,
      status: completed ? "COMPLETED" : "IN_PROGRESS",
      currentStepId: nextStepId,
      completedStepIds,
      skippedStepIds,
      completedAt: completed ? new Date().toISOString() : null,
    });
  }

  private commit(value: QuickSetupState): QuickSetupState {
    this.current = { ...normalizeState(structuredClone(value)), revision: this.current.revision + 1 };
    this.storage.set(KEY, this.current);
    this.listeners.forEach((listener) => listener(this.getState()));
    return this.getState();
  }
}
