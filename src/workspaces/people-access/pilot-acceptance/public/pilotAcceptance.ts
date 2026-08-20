import { getPilotAcceptanceApplicationServices } from "../application/composition/pilotAcceptanceApplicationServices";
import type {
  PilotAcceptanceDataset,
  PilotAcceptanceResult,
  PilotManualEvidence,
  PilotMetricObservation,
} from "../domain/pilotAcceptance.types";

export const collectCurrentPilotDataset = (workspaceId: string, metricObservations?: PilotMetricObservation[]): PilotAcceptanceDataset =>
  getPilotAcceptanceApplicationServices().collectCurrentDataset(workspaceId, metricObservations);

export const evaluatePilotAcceptance = (
  dataset: PilotAcceptanceDataset,
  manualEvidence?: readonly PilotManualEvidence[],
  now?: Date,
): PilotAcceptanceResult => getPilotAcceptanceApplicationServices().evaluate(dataset, manualEvidence, now);

export const createPassingPilotAcceptanceFixture = (input?: { externalProvider?: boolean; manualEvidence?: boolean }) =>
  getPilotAcceptanceApplicationServices().createPassingFixture(input);

export const clearPilotAcceptanceState = (workspaceId: string): void =>
  getPilotAcceptanceApplicationServices().clearState(workspaceId);

export const getPilotAcceptanceState = (workspaceId: string) =>
  getPilotAcceptanceApplicationServices().getState(workspaceId);

export const savePilotAcceptanceResult = (workspaceId: string, result: PilotAcceptanceResult) =>
  getPilotAcceptanceApplicationServices().saveResult(workspaceId, result);

export const savePilotManualEvidence = (workspaceId: string, evidence: PilotManualEvidence) =>
  getPilotAcceptanceApplicationServices().saveManualEvidence(workspaceId, evidence);

export const savePilotMetricObservation = (workspaceId: string, observation: PilotMetricObservation) =>
  getPilotAcceptanceApplicationServices().saveMetricObservation(workspaceId, observation);

export const subscribeToPilotAcceptance = (listener: () => void): (() => void) =>
  getPilotAcceptanceApplicationServices().subscribe(listener);
