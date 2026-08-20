import type { GuidanceProgress } from "@/guidance/domain/guidance.types";

const EMPTY_PROGRESS: GuidanceProgress = {
  schemaVersion: 1,
  completedWalkthroughs: {},
  activeWalkthroughs: {},
  completedChecklistItems: {},
};

export function guidanceProgressStorageKey(workspaceId: string, userId: string): string {
  return `unicore_guidance_progress_v1:${workspaceId}:${userId}`;
}

export function readGuidanceProgress(workspaceId: string, userId: string): GuidanceProgress {
  if (typeof window === "undefined") return structuredClone(EMPTY_PROGRESS);
  try {
    const raw = window.localStorage.getItem(guidanceProgressStorageKey(workspaceId, userId));
    if (!raw) return structuredClone(EMPTY_PROGRESS);
    const parsed = JSON.parse(raw) as Partial<GuidanceProgress>;
    if (parsed.schemaVersion !== 1) return structuredClone(EMPTY_PROGRESS);
    return {
      schemaVersion: 1,
      completedWalkthroughs: parsed.completedWalkthroughs || {},
      activeWalkthroughs: parsed.activeWalkthroughs || {},
      completedChecklistItems: parsed.completedChecklistItems || {},
    };
  } catch {
    return structuredClone(EMPTY_PROGRESS);
  }
}

export function writeGuidanceProgress(workspaceId: string, userId: string, progress: GuidanceProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(guidanceProgressStorageKey(workspaceId, userId), JSON.stringify(progress));
  } catch {
    // Guidance must never block the product when browser storage is unavailable.
  }
}
