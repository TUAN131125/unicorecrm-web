import type { AppEventBus } from "@/platform/events";
import type { PreferenceStore } from "@/platform/preferences";
import type { DealStageRepository } from "../application/ports/DealStageRepository";
import type { DealPipelineDefinition, OpportunityStageConfig } from "../domain/model/deal.types";
import { DEFAULT_DEAL_STAGES, normalizeDealStageConfigs } from "../domain/rules/dealStages";

export const DEAL_STAGES_CHANGED_EVENT = "unicore.deal-stages.changed";
const PIPELINE_CONFIG_KEY = "unicore_deal_pipelines";

export class BrowserDealStageRepository implements DealStageRepository {
  constructor(
    private readonly preferences: PreferenceStore,
    private readonly events: AppEventBus,
  ) {}

  list(): OpportunityStageConfig[] {
    const pipelines = this.listPipelines();
    return pipelines.find((pipeline) => pipeline.isDefault)?.stages
      ?? pipelines[0]?.stages
      ?? structuredClone(DEFAULT_DEAL_STAGES);
  }

  replace(stages: OpportunityStageConfig[]): void {
    const next = structuredClone(normalizeDealStageConfigs(stages));
    const pipelines = this.listPipelines();
    const defaultId = pipelines.find((pipeline) => pipeline.isDefault)?.id ?? pipelines[0]?.id;
    this.preferences.set(PIPELINE_CONFIG_KEY, pipelines.map((pipeline) => pipeline.id === defaultId
      ? { ...pipeline, stages: next, version: Math.max(1, pipeline.version) + 1 }
      : pipeline));
    this.events.publish<OpportunityStageConfig[]>(DEAL_STAGES_CHANGED_EVENT, structuredClone(next));
  }

  reset(): OpportunityStageConfig[] {
    this.preferences.remove(PIPELINE_CONFIG_KEY);
    const next = structuredClone(DEFAULT_DEAL_STAGES);
    this.events.publish<OpportunityStageConfig[]>(DEAL_STAGES_CHANGED_EVENT, structuredClone(next));
    return next;
  }

  subscribe(listener: (stages: OpportunityStageConfig[]) => void): () => void {
    return this.events.subscribe<OpportunityStageConfig[]>(DEAL_STAGES_CHANGED_EVENT, listener);
  }

  listPipelines(): DealPipelineDefinition[] {
    const stored = this.preferences.get<unknown>(PIPELINE_CONFIG_KEY, createFallbackPipelines());
    return structuredClone(normalizePipelineDefinitions(stored));
  }

  replacePipelines(pipelines: DealPipelineDefinition[]): DealPipelineDefinition[] {
    const next = normalizePipelineDefinitions(pipelines);
    this.preferences.set(PIPELINE_CONFIG_KEY, next);
    this.events.publish<OpportunityStageConfig[]>(
      DEAL_STAGES_CHANGED_EVENT,
      structuredClone(next.find((pipeline) => pipeline.isDefault)?.stages ?? DEFAULT_DEAL_STAGES),
    );
    return structuredClone(next);
  }
}

function normalizePipelineDefinitions(value: unknown): DealPipelineDefinition[] {
  const candidates = Array.isArray(value) ? value : [];
  const normalized: DealPipelineDefinition[] = [];
  const seenIds = new Set<string>();

  for (const [index, candidate] of candidates.entries()) {
    if (!isRecord(candidate)) continue;
    const baseId = readString(candidate.id) ?? `deal-pipeline-${index + 1}`;
    const id = createUniqueId(baseId, seenIds);
    seenIds.add(id);

    normalized.push({
      id,
      objectKey: "deal",
      name: readLocalizedText(candidate.name, {
        vi: index === 0 ? "Pipeline bán hàng" : `Pipeline ${index + 1}`,
        en: index === 0 ? "Sales pipeline" : `Pipeline ${index + 1}`,
      }),
      description: readLocalizedText(candidate.description, {
        vi: "Pipeline cấu hình cho Cơ hội.",
        en: "Configured pipeline for Deals.",
      }),
      isDefault: candidate.isDefault === true,
      active: typeof candidate.active === "boolean" ? candidate.active : true,
      stages: normalizeDealStageConfigs(candidate.stages),
      version: normalizeVersion(candidate.version),
    });
  }

  if (!normalized.length) return createFallbackPipelines();

  if (!normalized.some((pipeline) => pipeline.active)) {
    normalized[0] = { ...normalized[0], active: true };
  }
  const defaultId = normalized.find((pipeline) => pipeline.active && pipeline.isDefault)?.id
    ?? normalized.find((pipeline) => pipeline.active)?.id
    ?? normalized[0].id;

  return normalized.map((pipeline) => ({
    ...pipeline,
    isDefault: pipeline.id === defaultId,
  }));
}

function createFallbackPipelines(): DealPipelineDefinition[] {
  return [{
    id: "deal-pipeline-default",
    objectKey: "deal",
    name: { vi: "Pipeline bán hàng", en: "Sales pipeline" },
    description: { vi: "Pipeline mặc định cho Cơ hội.", en: "Default pipeline for Deals." },
    isDefault: true,
    active: true,
    stages: structuredClone(DEFAULT_DEAL_STAGES),
    version: 1,
  }];
}

function readLocalizedText(
  value: unknown,
  fallback: { vi: string; en: string },
): { vi: string; en: string } {
  if (!isRecord(value)) return fallback;
  return {
    vi: readString(value.vi) ?? fallback.vi,
    en: readString(value.en) ?? fallback.en,
  };
}

function createUniqueId(baseId: string, seenIds: ReadonlySet<string>): string {
  if (!seenIds.has(baseId)) return baseId;
  let suffix = 2;
  while (seenIds.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

function normalizeVersion(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}
