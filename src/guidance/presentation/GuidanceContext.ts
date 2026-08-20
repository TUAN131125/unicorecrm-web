import { createContext, useContext } from "react";
import type { CanonicalProductSpace } from "@/platform/navigation";
import type { FieldGuidance, GuidanceProgress, ScreenGuidance, WorkflowGuidance } from "@/guidance/domain/guidance.types";

export type GuidanceSelection =
  | { kind: "screen"; item: ScreenGuidance }
  | { kind: "workflow"; item: WorkflowGuidance }
  | { kind: "field"; item: FieldGuidance }
  | null;

export interface GuidanceContextValue {
  isPanelOpen: boolean;
  openPanel(): void;
  closePanel(): void;
  selection: GuidanceSelection;
  setSelection(selection: GuidanceSelection): void;
  currentGuidance?: ScreenGuidance;
  productSpace: CanonicalProductSpace;
  locale: "vi" | "en";
  can(capability: string): boolean;
  navigateTo(route: string, productSpace?: CanonicalProductSpace): void;
  openScreen(guidanceId: string): void;
  openWorkflow(workflowId: string): void;
  openFieldHelp(helpKey: string): void;
  startWalkthrough(guidance?: ScreenGuidance): void;
  walkthrough?: { guidance: ScreenGuidance; steps: NonNullable<ScreenGuidance["steps"]>; stepIndex: number };
  nextStep(): void;
  previousStep(): void;
  skipWalkthrough(): void;
  progress: GuidanceProgress;
  toggleChecklistItem(checklistId: string, itemId: string): void;
}

export const GuidanceContext = createContext<GuidanceContextValue | null>(null);

export function useGuidance(): GuidanceContextValue {
  const context = useContext(GuidanceContext);
  if (!context) throw new Error("useGuidance must be used inside GuidanceProvider");
  return context;
}
