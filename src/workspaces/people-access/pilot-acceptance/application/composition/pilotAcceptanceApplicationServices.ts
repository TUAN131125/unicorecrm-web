import { createApplicationServiceBinding } from "@/shared/application";
import type {
  PilotAcceptanceDataset,
  PilotAcceptanceResult,
  PilotAcceptanceWorkspaceState,
  PilotManualEvidence,
  PilotMetricObservation,
} from "../../domain/pilotAcceptance.types";

export interface PilotAcceptanceApplicationServices {
  collectCurrentDataset(workspaceId: string, metricObservations?: PilotMetricObservation[]): PilotAcceptanceDataset;
  evaluate(dataset: PilotAcceptanceDataset, manualEvidence?: readonly PilotManualEvidence[], now?: Date): PilotAcceptanceResult;
  createPassingFixture(input?: { externalProvider?: boolean; manualEvidence?: boolean }): {
    dataset: PilotAcceptanceDataset;
    manualEvidence: PilotManualEvidence[];
  };
  clearState(workspaceId: string): void;
  getState(workspaceId: string): PilotAcceptanceWorkspaceState;
  saveResult(workspaceId: string, result: PilotAcceptanceResult): PilotAcceptanceWorkspaceState;
  saveManualEvidence(workspaceId: string, evidence: PilotManualEvidence): PilotAcceptanceWorkspaceState;
  saveMetricObservation(workspaceId: string, observation: PilotMetricObservation): PilotAcceptanceWorkspaceState;
  subscribe(listener: () => void): () => void;
}

const binding = createApplicationServiceBinding<PilotAcceptanceApplicationServices>("People Access pilot acceptance");

export const configurePilotAcceptanceApplication = binding.configure;
export const getPilotAcceptanceApplicationServices = binding.get;
export const resetPilotAcceptanceApplication = binding.reset;
