import type { HttpClient } from "../client/HttpClient";
import { ApiClientError } from "../errors/ApiClientError";
import { AiApiClient, type AiAdvisoryRequest, type AiAdvisoryResponse as GeneratedAiAdvisoryResponse, type AiContextReference, type AiConversationMessage, type AiGroundingEvidence, type AiAdvisoryProviderView } from "../generated/aiApi";

export type { AiAdvisoryRequest, AiContextReference, AiConversationMessage, AiGroundingEvidence, AiAdvisoryProviderView };
export type AiContextType = AiContextReference["type"];
export type AiAdvisoryResponse = Omit<GeneratedAiAdvisoryResponse, "suggestedNextAction" | "advisory"> & { suggestedNextAction?: string; advisory: true };

/** Application-facing adapter over the canonical generated OpenAPI client. */
export class AiAdvisoryApiClient {
  private readonly generated: AiApiClient;
  constructor(http: HttpClient) { this.generated = new AiApiClient(http); }
  async requestAdvisory(body: AiAdvisoryRequest, signal?: AbortSignal): Promise<AiAdvisoryResponse> {
    const payload = await this.generated.requestAiAdvisory<unknown>(body, { ...(signal === undefined ? {} : { signal }), retry: "never" });
    return validate(payload);
  }
}

function validate(value: unknown): AiAdvisoryResponse {
  if (!isRecord(value) || !nonEmpty(value.executionId) || !nonEmpty(value.summary) || value.advisory !== true || !strings(value.attentionPoints) || !refs(value.contextReferences) || !grounding(value.evidence) || !provider(value.provider) || !(value.suggestedNextAction === undefined || typeof value.suggestedNextAction === "string")) {
    throw new ApiClientError({ code: "AI_PROVIDER_RESPONSE_INVALID", message: "The AI advisory response did not match the admitted backend contract.", status: 502, retryable: true });
  }
  return value as unknown as AiAdvisoryResponse;
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function refs(value: unknown): boolean { return Array.isArray(value) && value.length > 0 && value.every((item) => isRecord(item) && ["lead", "contact", "organization", "customer", "deal", "task"].includes(String(item.type)) && nonEmpty(item.id)); }
function grounding(value: unknown): boolean { return Array.isArray(value) && value.every((item) => isRecord(item) && nonEmpty(item.entityType) && nonEmpty(item.entityId) && nonEmpty(item.contextType) && (item.displayLabel === undefined || typeof item.displayLabel === "string") && (item.version === undefined || typeof item.version === "number")); }
function provider(value: unknown): boolean { return isRecord(value) && nonEmpty(value.name) && nonEmpty(value.model); }
