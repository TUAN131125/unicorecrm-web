/**
 * AI data classification boundary.
 *
 * A connected AI request must not carry the CRM state of the browser session.
 * This module projects the in-browser context onto aggregate counts, the focused
 * record identifier and the requested scope, filtered by the effective policy's
 * data classes and blocked field keys. The backend remains responsible for
 * building the authoritative CRM context behind its own access checks.
 */
import type { AiContextWrapper } from "../aiContextBuilder";
import {
  normalizeAiGovernancePolicy,
  type AiGovernancePolicy,
} from "../governance";
import type {
  AiContextScopeKey,
  AiFocusedEntityRef,
  AiFocusedEntityType,
  AiSanitizedRequestContext,
} from "./ports/aiRuntime.types";

const FOCUSED_ENTITY_TYPES: readonly AiFocusedEntityType[] = [
  "lead",
  "customer",
  "contact",
  "organization",
  "deal",
  "quote",
  "order",
  "case",
  "task",
  "report",
];

export function resolveAiFocusedEntityRef(
  context: Pick<AiContextWrapper, "focusedItem">,
): AiFocusedEntityRef | undefined {
  const focused = context.focusedItem;
  if (!focused) return undefined;
  const entityType = FOCUSED_ENTITY_TYPES.find((item) => item === focused.entityType);
  if (!entityType) return undefined;
  const record = focused.data as { id?: unknown } | null | undefined;
  const entityId = record && typeof record === "object" && typeof record.id === "string" ? record.id : undefined;
  return { entityType, ...(entityId ? { entityId } : {}) };
}

export function defaultAiContextScope(
  focusedEntity: AiFocusedEntityRef | undefined,
): AiContextScopeKey[] {
  return focusedEntity ? ["GLOBAL_SUMMARY", "FOCUSED_RECORD"] : ["GLOBAL_SUMMARY", "WORK_PRIORITY"];
}

export interface BuildSanitizedAiRequestContextInput {
  context: AiContextWrapper;
  policy: AiGovernancePolicy;
  scopeKeys?: AiContextScopeKey[];
  focusedEntity?: AiFocusedEntityRef;
}

/**
 * Produces the only CRM-derived payload a connected request may transmit.
 * Record collections are dropped entirely; commercial values are included only
 * when the policy allows the FINANCIAL data class.
 */
export function buildSanitizedAiRequestContext(
  input: BuildSanitizedAiRequestContextInput,
): AiSanitizedRequestContext {
  const policy = normalizeAiGovernancePolicy(input.policy);
  const focusedEntity = input.focusedEntity ?? resolveAiFocusedEntityRef(input.context);
  const scopeKeys = input.scopeKeys ?? defaultAiContextScope(focusedEntity);
  const global = input.context.globalContext;
  const allowsFinancial = policy.allowedDataClasses.includes("FINANCIAL");

  return {
    scopeKeys,
    allowedDataClasses: [...policy.allowedDataClasses],
    redactedFieldKeys: [...policy.blockedFieldKeys],
    counts: {
      leads: global.leadsCount,
      customers: global.customersCount,
      contacts: global.contactsCount,
      deals: global.dealsCount,
      quotes: global.quotesCount,
      orders: global.ordersCount,
      cases: global.casesCount,
      products: global.productsCount,
      tasks: global.tasksCount,
      openTasks: global.openTasksCount,
      overdueTasks: global.overdueTasksCount,
    },
    ...(focusedEntity ? { focusedEntity } : {}),
    ...(allowsFinancial
      ? {
          commercial: {
            totalPipelineValue: global.totalPipelineValue,
            totalExpectedRevenue: global.totalExpectedRevenue,
            totalOrdersValue: global.totalOrdersValue,
          },
        }
      : {}),
  };
}

/** Defensive check used by the connected payload builder before transmission. */
export function containsBlockedFieldKey(value: unknown, blockedFieldKeys: readonly string[]): boolean {
  if (!value || typeof value !== "object") return false;
  const blocked = blockedFieldKeys.map((item) => item.toLowerCase());
  const seen = new Set<unknown>();
  const visit = (candidate: unknown): boolean => {
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) return false;
    seen.add(candidate);
    if (Array.isArray(candidate)) return candidate.some(visit);
    return Object.entries(candidate as Record<string, unknown>).some(([key, nested]) => {
      if (blocked.some((token) => key.toLowerCase().includes(token))) return true;
      return visit(nested);
    });
  };
  return visit(value);
}
