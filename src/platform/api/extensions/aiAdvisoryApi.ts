import type { HttpClient } from "../client/HttpClient";
import { ApiClientError } from "../errors/ApiClientError";

export interface AiAdvisoryContextReferences {
  leadId?: string;
  dealId?: string;
  taskId?: string;
}

export interface AiAdvisoryRequest {
  question: string;
  locale: "en" | "vi";
  contextReferences: AiAdvisoryContextReferences;
}

export interface AiAdvisoryProviderView {
  name: string;
  model: string;
}

export interface AiAdvisoryResponse {
  executionId: string;
  summary: string;
  suggestedNextAction?: string;
  attentionPoints: string[];
  advisory: true;
  contextReferences: AiAdvisoryContextReferences;
  provider: AiAdvisoryProviderView;
}

/** Typed boundary for the one admitted backend AI project extension. */
export class AiAdvisoryApiClient {
  constructor(private readonly http: HttpClient) {}

  async requestAdvisory(body: AiAdvisoryRequest, signal?: AbortSignal): Promise<AiAdvisoryResponse> {
    const payload = await this.http.request<unknown, AiAdvisoryRequest>({
      operationId: "requestAiAdvisory",
      method: "POST",
      path: "/ai/advisories",
      body,
      ...(signal === undefined ? {} : { signal }),
      retry: "never",
      credentials: "include",
      contractAuthority: "semantic-extension",
    });
    return validateAiAdvisoryResponse(payload);
  }
}

function validateAiAdvisoryResponse(value: unknown): AiAdvisoryResponse {
  if (!isRecord(value)
    || !isNonEmptyString(value.executionId)
    || !isNonEmptyString(value.summary)
    || value.advisory !== true
    || !isStringArray(value.attentionPoints)
    || !isContextReferences(value.contextReferences)
    || !isProvider(value.provider)
    || !(value.suggestedNextAction === undefined || typeof value.suggestedNextAction === "string")) {
    throw new ApiClientError({
      code: "AI_PROVIDER_RESPONSE_INVALID",
      message: "The AI advisory response did not match the admitted backend contract.",
      status: 502,
      retryable: true,
    });
  }
  return {
    executionId: value.executionId,
    summary: value.summary,
    ...(value.suggestedNextAction === undefined ? {} : { suggestedNextAction: value.suggestedNextAction }),
    attentionPoints: [...value.attentionPoints],
    advisory: true,
    contextReferences: { ...value.contextReferences },
    provider: { name: value.provider.name, model: value.provider.model },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isContextReferences(value: unknown): value is AiAdvisoryContextReferences {
  if (!isRecord(value)) return false;
  const allowed = new Set(["leadId", "dealId", "taskId"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  return Object.values(value).every((item) => item === undefined || typeof item === "string");
}

function isProvider(value: unknown): value is AiAdvisoryProviderView {
  return isRecord(value) && isNonEmptyString(value.name) && isNonEmptyString(value.model);
}
