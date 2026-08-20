import { DealStage, type Deal, type OpportunityStageConfig } from "../model/deal.types";

const BASE_DATE = "2026-07-07";

export const DEFAULT_DEAL_STAGES: OpportunityStageConfig[] = [
  stage("stage_discovery", DealStage.DISCOVERY, "Khám phá", "Discovery", 10, "blue", "open", 10),
  stage("stage_qualified", DealStage.QUALIFIED, "Đã xác nhận", "Qualified", 20, "teal", "open", 30),
  stage("stage_solution", DealStage.SOLUTION, "Giải pháp", "Solution", 30, "yellow", "open", 50),
  stage("stage_proposal", DealStage.PROPOSAL, "Đề xuất", "Proposal", 40, "orange", "open", 65),
  stage("stage_negotiation", DealStage.NEGOTIATION, "Đàm phán", "Negotiation", 50, "purple", "open", 80),
  stage("stage_won", DealStage.WON, "Thắng", "Closed Won", 60, "green", "won", 100),
  stage("stage_lost", DealStage.LOST, "Thua", "Closed Lost", 70, "red", "lost", 0),
];

const LEGACY_STAGE_ALIASES: Record<string, DealStage> = {
  NEW: DealStage.DISCOVERY,
  CONSULTING: DealStage.QUALIFIED,
  DISCOVERY: DealStage.DISCOVERY,
  QUALIFIED: DealStage.QUALIFIED,
  SOLUTION: DealStage.SOLUTION,
  PROPOSAL: DealStage.PROPOSAL,
  NEGOTIATION: DealStage.NEGOTIATION,
  WON: DealStage.WON,
  LOST: DealStage.LOST,
};

export function normalizeDealStageCode(stageCode: string): DealStage | string {
  return LEGACY_STAGE_ALIASES[String(stageCode).toUpperCase()] ?? stageCode;
}

/**
 * Normalizes persisted Studio configuration before it reaches the Deal UI.
 * Older browser snapshots can contain partial stages or a non-array value;
 * reads therefore fail closed to the canonical pipeline instead of crashing a route.
 */
export function normalizeDealStageConfigs(configs: unknown): OpportunityStageConfig[] {
  const candidates = Array.isArray(configs) ? configs : [];
  const normalized: OpportunityStageConfig[] = [];
  const seenCodes = new Set<string>();

  for (const [index, candidate] of candidates.entries()) {
    const stageConfig = normalizeStageCandidate(candidate, index);
    if (!stageConfig || seenCodes.has(stageConfig.code)) continue;
    seenCodes.add(stageConfig.code);
    normalized.push(stageConfig);
  }

  for (const required of DEFAULT_DEAL_STAGES) {
    if (!seenCodes.has(required.code)) normalized.push(structuredClone(required));
  }

  return normalized
    .sort((left, right) => left.order - right.order)
    .map((item, index) => ({ ...item, order: (index + 1) * 10 }));
}

export function getActiveDealStages(configs: readonly OpportunityStageConfig[]): OpportunityStageConfig[] {
  return normalizeDealStageConfigs(configs).filter((stage) => stage.isActive).sort((a, b) => a.order - b.order);
}

export function isWonStage(stageCode: string, configs: readonly OpportunityStageConfig[]): boolean {
  const normalizedCode = normalizeDealStageCode(stageCode);
  const config = normalizeDealStageConfigs(configs).find((stage) => stage.code === normalizedCode);
  return config ? config.category === "won" : normalizedCode === DealStage.WON;
}

export function isLostStage(stageCode: string, configs: readonly OpportunityStageConfig[]): boolean {
  const normalizedCode = normalizeDealStageCode(stageCode);
  const config = normalizeDealStageConfigs(configs).find((stage) => stage.code === normalizedCode);
  return config ? config.category === "lost" : normalizedCode === DealStage.LOST;
}

export function isOpenStage(stageCode: string, configs: readonly OpportunityStageConfig[]): boolean {
  return !isWonStage(stageCode, configs) && !isLostStage(stageCode, configs);
}

export function getStageLabel(stageCode: string, configs: readonly OpportunityStageConfig[], locale: string): string {
  const normalizedCode = normalizeDealStageCode(stageCode);
  const config = normalizeDealStageConfigs(configs).find((stage) => stage.code === normalizedCode);
  if (!config) return String(normalizedCode);

  // Canonical system stages always use the product-owned bilingual labels.
  // This prevents older persisted workspace snapshots from leaking English-only
  // or stale labels into the Vietnamese UI while still allowing custom stages
  // to use their administrator-defined Vietnamese and English names.
  const canonical = DEFAULT_DEAL_STAGES.find((stage) => stage.code === normalizedCode);
  if (canonical && config.isSystem !== false) {
    return locale === "vi" ? canonical.labelVi : canonical.labelEn;
  }

  const localizedLabel = locale === "vi" ? config.labelVi : config.labelEn;
  const fallbackLabel = locale === "vi" ? config.labelEn : config.labelVi;
  return localizedLabel?.trim() || fallbackLabel?.trim() || String(normalizedCode);
}

/** Terminal WON/LOST outcomes are explicit commands and are never an automatic "next" stage. */
export function getNextStage(stageCode: string, configs: readonly OpportunityStageConfig[]): string | null {
  const activeOpen = getActiveDealStages(configs).filter((stage) => stage.category === "open");
  const normalizedCode = normalizeDealStageCode(stageCode);
  const currentIndex = activeOpen.findIndex((stage) => stage.code === normalizedCode);
  if (currentIndex < 0 || currentIndex >= activeOpen.length - 1) return null;
  return activeOpen[currentIndex + 1].code;
}

export function validateDealInvariant(deal: Deal): string[] {
  const errors: string[] = [];
  const stageCode = normalizeDealStageCode(deal.stage);
  if (!deal.buyerRef?.id) errors.push("Deal requires a canonical buyerRef.");
  if (stageCode === DealStage.WON && !deal.winEvidence) {
    errors.push("WON Deal requires Quote Accepted or Order Confirmed evidence.");
  }
  if (stageCode === DealStage.LOST) {
    if (!deal.lostReason?.trim()) errors.push("LOST Deal requires loss reason.");
    if (!deal.recycleDecision) errors.push("LOST Deal requires recycle decision.");
    if (deal.recycleDecision && deal.recycleDecision !== "DO_NOT_RECYCLE" && !deal.revisitAt) {
      errors.push("Recyclable LOST Deal requires revisitAt.");
    }
  }
  return errors;
}

export function assertDealInvariant(deal: Deal): Deal {
  const errors = validateDealInvariant(deal);
  if (errors.length) throw new Error(errors.join(" "));
  return deal;
}

function normalizeStageCandidate(candidate: unknown, index: number): OpportunityStageConfig | null {
  if (!isRecord(candidate)) return null;

  const rawCode = readString(candidate.code);
  if (!rawCode) return null;
  const code = String(normalizeDealStageCode(rawCode)).trim();
  if (!code) return null;

  const canonical = DEFAULT_DEAL_STAGES.find((stageConfig) => stageConfig.code === code);
  const color = readStageColor(candidate.color) ?? canonical?.color ?? "blue";
  const category = readStageCategory(candidate.category) ?? canonical?.category ?? "open";
  const probability = readNumber(candidate.probability);
  const descriptionVi = readString(candidate.descriptionVi);
  const descriptionEn = readString(candidate.descriptionEn);

  return {
    id: readString(candidate.id) ?? canonical?.id ?? `stage-${toStableId(code, index)}`,
    code,
    labelVi: readString(candidate.labelVi) ?? canonical?.labelVi ?? code,
    labelEn: readString(candidate.labelEn) ?? canonical?.labelEn ?? code,
    ...(descriptionVi ? { descriptionVi } : {}),
    ...(descriptionEn ? { descriptionEn } : {}),
    order: readNumber(candidate.order) ?? canonical?.order ?? (index + 1) * 10,
    color,
    category,
    probabilityDefault: clampPercentage(readNumber(candidate.probabilityDefault) ?? canonical?.probabilityDefault ?? 0),
    ...(probability === undefined ? {} : { probability: clampPercentage(probability) }),
    isSystem: typeof candidate.isSystem === "boolean" ? candidate.isSystem : Boolean(canonical),
    isActive: typeof candidate.isActive === "boolean" ? candidate.isActive : canonical?.isActive ?? true,
    createdAt: readString(candidate.createdAt) ?? canonical?.createdAt ?? BASE_DATE,
    updatedAt: readString(candidate.updatedAt) ?? canonical?.updatedAt ?? BASE_DATE,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStageColor(value: unknown): OpportunityStageConfig["color"] | undefined {
  switch (value) {
    case "blue":
    case "yellow":
    case "orange":
    case "purple":
    case "green":
    case "red":
    case "slate":
    case "teal":
      return value;
    default:
      return undefined;
  }
}

function readStageCategory(value: unknown): OpportunityStageConfig["category"] | undefined {
  return value === "open" || value === "won" || value === "lost" ? value : undefined;
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function toStableId(code: string, index: number): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || String(index + 1);
}

function stage(
  id: string,
  code: DealStage,
  labelVi: string,
  labelEn: string,
  order: number,
  color: OpportunityStageConfig["color"],
  category: OpportunityStageConfig["category"],
  probabilityDefault: number,
): OpportunityStageConfig {
  return {
    id,
    code,
    labelVi,
    labelEn,
    order,
    color,
    category,
    probabilityDefault,
    isSystem: true,
    isActive: true,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  };
}
