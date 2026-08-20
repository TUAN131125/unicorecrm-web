import type { MutationResourceVersion } from "@/shared/application";
import {
  normalizeApplicationError,
  type ApplicationErrorCategory,
} from "@/shared/domain";
import { presentApplicationError, type ErrorRecoveryAction } from "./errorPresentation";

export type MutationState =
  | "IDLE"
  | "SUBMITTING"
  | "SUCCEEDED"
  | "VALIDATION_FAILED"
  | "BUSINESS_BLOCKED"
  | "CONFLICTED"
  | "NETWORK_FAILED"
  | "CANCELLED";

export interface MutationConflictDetails {
  expectedVersion?: MutationResourceVersion;
  actualVersion?: MutationResourceVersion;
  changedFields?: string[];
  serverUpdatedAt?: string;
  serverUpdatedBy?: string;
}

export interface MutationFailure {
  state: Exclude<MutationState, "IDLE" | "SUBMITTING" | "SUCCEEDED">;
  code: string;
  category: ApplicationErrorCategory;
  message: string;
  fieldErrors?: Record<string, string>;
  businessBlockers?: string[];
  conflict?: MutationConflictDetails;
  retryable: boolean;
  recoveryAction: ErrorRecoveryAction;
  correlationId?: string;
  requestId?: string;
}

export interface MutationSnapshot<T = unknown> {
  state: MutationState;
  result?: T;
  authoritativeEntity?: T;
  failure?: MutationFailure;
  submittedAt?: string;
  completedAt?: string;
}

export interface MutationCommandMetadata {
  idempotencyKey: string;
  expectedVersion?: MutationResourceVersion;
  correlationId: string;
  signal?: AbortSignal;
}

export function classifyMutationFailure(error: unknown): MutationFailure {
  const normalized = normalizeApplicationError(error);
  const presentation = presentApplicationError(normalized);
  const state = mutationStateForCategory(normalized.category);
  return {
    state,
    code: normalized.code,
    category: normalized.category,
    message: presentation.message,
    fieldErrors: flattenFieldErrors(normalized.fieldErrors),
    businessBlockers: normalized.blockers.length > 0 ? normalized.blockers : undefined,
    ...(state === "CONFLICTED" ? { conflict: extractConflictDetails(normalized.details) } : {}),
    retryable: normalized.retryable,
    recoveryAction: presentation.action,
    ...(normalized.correlationId === undefined ? {} : { correlationId: normalized.correlationId }),
    ...(normalized.requestId === undefined ? {} : { requestId: normalized.requestId }),
  };
}

function extractConflictDetails(details: unknown): MutationConflictDetails | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const record = details as Record<string, unknown>;
  const expectedVersion = readVersion(record.expectedVersion ?? record.clientVersion);
  const actualVersion = readVersion(record.actualVersion ?? record.currentVersion ?? record.serverVersion);
  const changedFields = Array.isArray(record.changedFields)
    ? record.changedFields.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const serverUpdatedAt = typeof record.serverUpdatedAt === "string"
    ? record.serverUpdatedAt
    : typeof record.updatedAt === "string" ? record.updatedAt : undefined;
  const serverUpdatedBy = typeof record.serverUpdatedBy === "string"
    ? record.serverUpdatedBy
    : typeof record.updatedBy === "string" ? record.updatedBy : undefined;
  if (expectedVersion === undefined && actualVersion === undefined && !changedFields?.length && !serverUpdatedAt && !serverUpdatedBy) return undefined;
  return {
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    ...(actualVersion === undefined ? {} : { actualVersion }),
    ...(changedFields?.length ? { changedFields } : {}),
    ...(serverUpdatedAt === undefined ? {} : { serverUpdatedAt }),
    ...(serverUpdatedBy === undefined ? {} : { serverUpdatedBy }),
  };
}

function readVersion(value: unknown): MutationResourceVersion | undefined {
  return typeof value === "number" || typeof value === "string" ? value : undefined;
}

function mutationStateForCategory(category: ApplicationErrorCategory): MutationFailure["state"] {
  switch (category) {
    case "VALIDATION": return "VALIDATION_FAILED";
    case "CONFLICT": return "CONFLICTED";
    case "AUTHENTICATION":
    case "AUTHORIZATION":
    case "NOT_FOUND":
    case "BUSINESS_RULE": return "BUSINESS_BLOCKED";
    case "CANCELLED": return "CANCELLED";
    case "RATE_LIMIT":
    case "TIMEOUT":
    case "NETWORK":
    case "INTEGRATION":
    case "INFRASTRUCTURE":
    case "UNKNOWN": return "NETWORK_FAILED";
  }
}

function flattenFieldErrors(fieldErrors?: Record<string, string[]>): Record<string, string> | undefined {
  if (!fieldErrors) return undefined;
  const result = Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, messages.join(" ")]),
  );
  return Object.keys(result).length ? result : undefined;
}
