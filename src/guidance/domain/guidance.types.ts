import type { CanonicalProductSpace } from "@/platform/navigation";

export type GuidanceLocale = "vi" | "en";

export type GuidanceLocaleText = {
  vi: string;
  en: string;
};

export type GuidanceTask = {
  id: string;
  text: GuidanceLocaleText;
  route?: string;
  productSpace?: CanonicalProductSpace;
  requiredCapabilities?: string[];
};

export type GuidanceStep = {
  id: string;
  targetId: string;
  title: GuidanceLocaleText;
  body: GuidanceLocaleText;
  placement?: "top" | "right" | "bottom" | "left" | "auto";
  expectedAction?: "view" | "click" | "input" | "select" | "navigate";
  route?: string;
  productSpace?: CanonicalProductSpace;
  optional?: boolean;
  requiredCapabilities?: string[];
};

export type ScreenGuidance = {
  id: string;
  routeKey: string;
  productSpace: CanonicalProductSpace;
  version: number;
  title: GuidanceLocaleText;
  purpose: GuidanceLocaleText;
  audience?: GuidanceLocaleText;
  prerequisites?: GuidanceLocaleText[];
  primaryTasks: GuidanceTask[];
  commonMistakes?: GuidanceLocaleText[];
  relatedWorkflowIds?: string[];
  steps?: GuidanceStep[];
  requiredCapabilities?: string[];
  keywords?: GuidanceLocaleText;
  owner: string;
  reviewedAt: string;
};

export type WorkflowGuidanceStep = {
  id: string;
  title: GuidanceLocaleText;
  body: GuidanceLocaleText;
  route?: string;
  productSpace?: CanonicalProductSpace;
  requiredCapabilities?: string[];
  requiredData?: GuidanceLocaleText[];
};

export type WorkflowGuidance = {
  id: string;
  title: GuidanceLocaleText;
  summary: GuidanceLocaleText;
  productSpaces: CanonicalProductSpace[];
  steps: WorkflowGuidanceStep[];
  keywords?: GuidanceLocaleText;
  owner: string;
  reviewedAt: string;
  version: number;
};

export type ChecklistItem = {
  id: string;
  title: GuidanceLocaleText;
  description: GuidanceLocaleText;
  route?: string;
  productSpace?: CanonicalProductSpace;
  requiredCapabilities?: string[];
};

export type GuidanceChecklist = {
  id: string;
  title: GuidanceLocaleText;
  description: GuidanceLocaleText;
  requiredAnyCapabilities?: string[];
  items: ChecklistItem[];
};

export type FieldGuidance = {
  helpKey: string;
  title: GuidanceLocaleText;
  purpose: GuidanceLocaleText;
  example?: GuidanceLocaleText;
  impact?: GuidanceLocaleText;
  requiredWhen?: GuidanceLocaleText;
  keywords?: GuidanceLocaleText;
};

export type GuidanceProgress = {
  schemaVersion: 1;
  completedWalkthroughs: Record<string, { version: number; completedAt: string }>;
  activeWalkthroughs: Record<string, { version: number; stepIndex: number; updatedAt: string }>;
  completedChecklistItems: Record<string, string[]>;
};

export type GuidanceSearchResult =
  | { kind: "screen"; id: string; title: GuidanceLocaleText; summary: GuidanceLocaleText; productSpace: CanonicalProductSpace; routeKey: string }
  | { kind: "workflow"; id: string; title: GuidanceLocaleText; summary: GuidanceLocaleText; productSpace?: CanonicalProductSpace }
  | { kind: "field"; id: string; title: GuidanceLocaleText; summary: GuidanceLocaleText };

export type CapabilityPredicate = (capability: string) => boolean;
