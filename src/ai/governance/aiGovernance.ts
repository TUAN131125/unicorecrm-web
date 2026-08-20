export type AiGovernanceLevel = "L0_READ" | "L1_RECOMMEND" | "L2_INTERNAL_ACT" | "L3_CONTROLLED_EXTERNAL";
export type AiDataClass = "PUBLIC" | "INTERNAL" | "CUSTOMER_PII" | "FINANCIAL" | "RESTRICTED";
export type AiActionKind = "READ" | "RECOMMEND" | "DRAFT" | "INTERNAL_UPDATE" | "EXTERNAL_SEND" | "DELETE";

export interface AiGovernancePolicy {
  autonomyLevel: AiGovernanceLevel;
  killSwitch: boolean;
  allowedDataClasses: AiDataClass[];
  blockedFieldKeys: string[];
  requireApprovalFor: AiActionKind[];
  evidenceRequired: boolean;
  permissionEnforced: boolean;
  retentionDays: number;
}

export interface AiActionRequest {
  requestId: string;
  actorId: string;
  action: AiActionKind;
  dataClasses: AiDataClass[];
  fieldKeys?: string[];
  capabilityGranted: boolean;
  evidenceRefs?: string[];
  approved?: boolean;
  occurredAt?: string;
}

export interface AiGovernanceDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reasons: string[];
}

export interface AiGovernanceLogEntry {
  logId: string;
  request: AiActionRequest;
  decision: AiGovernanceDecision;
  occurredAt: string;
}

export const DEFAULT_AI_GOVERNANCE_POLICY: AiGovernancePolicy = {
  autonomyLevel: "L1_RECOMMEND",
  killSwitch: false,
  allowedDataClasses: ["PUBLIC", "INTERNAL", "CUSTOMER_PII"],
  blockedFieldKeys: ["password", "credentialReference", "accessToken", "refreshToken"],
  requireApprovalFor: ["EXTERNAL_SEND", "DELETE"],
  evidenceRequired: true,
  permissionEnforced: true,
  retentionDays: 90,
};

const levelActions: Record<AiGovernanceLevel, readonly AiActionKind[]> = {
  L0_READ: ["READ"],
  L1_RECOMMEND: ["READ", "RECOMMEND", "DRAFT"],
  L2_INTERNAL_ACT: ["READ", "RECOMMEND", "DRAFT", "INTERNAL_UPDATE"],
  L3_CONTROLLED_EXTERNAL: ["READ", "RECOMMEND", "DRAFT", "INTERNAL_UPDATE", "EXTERNAL_SEND", "DELETE"],
};
const keyFor = (workspaceId: string) => `unicore_ai_governance_log_v1:${workspaceId}`;

export function normalizeAiGovernancePolicy(policy: Partial<AiGovernancePolicy> & Pick<AiGovernancePolicy, "autonomyLevel">): AiGovernancePolicy {
  return {
    autonomyLevel: policy.autonomyLevel,
    killSwitch: policy.killSwitch ?? false,
    allowedDataClasses: policy.allowedDataClasses ?? ["PUBLIC", "INTERNAL", "CUSTOMER_PII"],
    blockedFieldKeys: [...new Set(policy.blockedFieldKeys ?? ["password", "credentialReference", "accessToken", "refreshToken"])],
    requireApprovalFor: [...new Set<AiActionKind>(policy.requireApprovalFor ?? ["EXTERNAL_SEND", "DELETE"])],
    evidenceRequired: policy.evidenceRequired ?? true,
    permissionEnforced: policy.permissionEnforced ?? true,
    retentionDays: Math.max(1, Math.min(365, policy.retentionDays ?? 90)),
  };
}

export function evaluateAiAction(policyInput: AiGovernancePolicy, request: AiActionRequest): AiGovernanceDecision {
  const policy = normalizeAiGovernancePolicy(policyInput);
  const reasons: string[] = [];
  if (policy.killSwitch) reasons.push("AI kill switch is enabled.");
  if (!levelActions[policy.autonomyLevel].includes(request.action)) reasons.push(`Action ${request.action} exceeds autonomy level ${policy.autonomyLevel}.`);
  if (policy.permissionEnforced && !request.capabilityGranted) reasons.push("The actor does not have the required capability.");
  const forbiddenClasses = request.dataClasses.filter((item) => !policy.allowedDataClasses.includes(item));
  if (forbiddenClasses.length) reasons.push(`Data classes are not allowed: ${forbiddenClasses.join(", ")}.`);
  const forbiddenFields = (request.fieldKeys ?? []).filter((field) => policy.blockedFieldKeys.some((blocked) => field.toLowerCase().includes(blocked.toLowerCase())));
  if (forbiddenFields.length) reasons.push(`Blocked fields requested: ${forbiddenFields.join(", ")}.`);
  if (policy.evidenceRequired && !(request.evidenceRefs?.length)) reasons.push("Evidence is required for AI decisions.");
  const requiresApproval = policy.requireApprovalFor.includes(request.action);
  if (requiresApproval && !request.approved) reasons.push("Human approval is required.");
  return { allowed: reasons.length === 0, requiresApproval, reasons };
}

export function recordAiGovernanceDecision(workspaceId: string, policy: AiGovernancePolicy, request: AiActionRequest): AiGovernanceLogEntry {
  const decision = evaluateAiAction(policy, request);
  const occurredAt = request.occurredAt ?? new Date().toISOString();
  const entry = { logId: `ai_governance_${Date.now()}`, request: { ...request, occurredAt }, decision, occurredAt };
  if (typeof window !== "undefined") {
    const existing = getAiGovernanceLog(workspaceId);
    window.localStorage.setItem(keyFor(workspaceId), JSON.stringify([entry, ...existing].slice(0, 200)));
  }
  return entry;
}

export function getAiGovernanceLog(workspaceId: string): AiGovernanceLogEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(keyFor(workspaceId)) ?? "[]") as AiGovernanceLogEntry[]; } catch { return []; }
}

export function purgeExpiredAiGovernanceLog(workspaceId: string, policy: AiGovernancePolicy, now = new Date()): AiGovernanceLogEntry[] {
  const cutoff = now.getTime() - normalizeAiGovernancePolicy(policy).retentionDays * 86400000;
  const retained = getAiGovernanceLog(workspaceId).filter((entry) => new Date(entry.occurredAt).getTime() >= cutoff);
  if (typeof window !== "undefined") window.localStorage.setItem(keyFor(workspaceId), JSON.stringify(retained));
  return retained;
}
