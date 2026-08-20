import { BrowserStorageAdapter } from "@/platform/persistence";
import type {
  PilotAcceptanceResult,
  PilotAcceptanceWorkspaceState,
  PilotManualEvidence,
  PilotMetricObservation,
} from "../domain/pilotAcceptance.types";

const storage = new BrowserStorageAdapter();
const KEY_PREFIX = "unicore_pilot_acceptance_v1";
const listeners = new Set<() => void>();

function key(workspaceId: string): string {
  return `${KEY_PREFIX}:${workspaceId}`;
}

function emptyState(workspaceId: string): PilotAcceptanceWorkspaceState {
  return { version: 1, workspaceId, manualEvidence: [], metricObservations: [] };
}

function persist(state: PilotAcceptanceWorkspaceState): PilotAcceptanceWorkspaceState {
  storage.set(key(state.workspaceId), state);
  listeners.forEach((listener) => listener());
  return structuredClone(state);
}

export function getPilotAcceptanceState(workspaceId: string): PilotAcceptanceWorkspaceState {
  const stored = storage.get<PilotAcceptanceWorkspaceState>(key(workspaceId));
  if (!stored || stored.version !== 1 || stored.workspaceId !== workspaceId) return emptyState(workspaceId);
  return structuredClone(stored);
}

export function savePilotManualEvidence(workspaceId: string, evidence: PilotManualEvidence): PilotAcceptanceWorkspaceState {
  const current = getPilotAcceptanceState(workspaceId);
  const manualEvidence = current.manualEvidence.filter((item) => !(item.stepId === evidence.stepId && item.actorRole === evidence.actorRole));
  manualEvidence.push(evidence);
  return persist({ ...current, manualEvidence });
}

export function savePilotMetricObservation(workspaceId: string, observation: PilotMetricObservation): PilotAcceptanceWorkspaceState {
  const current = getPilotAcceptanceState(workspaceId);
  return persist({ ...current, metricObservations: [...current.metricObservations, observation].slice(-1000) });
}

export function savePilotAcceptanceResult(workspaceId: string, result: PilotAcceptanceResult): PilotAcceptanceWorkspaceState {
  const current = getPilotAcceptanceState(workspaceId);
  return persist({ ...current, lastRun: result });
}

export function clearPilotAcceptanceState(workspaceId: string): void {
  storage.remove(key(workspaceId));
  listeners.forEach((listener) => listener());
}

export function subscribeToPilotAcceptance(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
