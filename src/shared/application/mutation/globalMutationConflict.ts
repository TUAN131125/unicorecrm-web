import { normalizeApplicationError, type ApplicationError } from "@/shared/domain";
import type { BackendMutationCommand } from "./mutationAuthority";

export interface GlobalMutationConflictSnapshot {
  commandType: string;
  aggregateType: string;
  aggregateId: string;
  error: ApplicationError;
  occurredAt: string;
}

let snapshot: GlobalMutationConflictSnapshot | undefined;
const listeners = new Set<() => void>();

export function publishGlobalMutationConflict(
  command: BackendMutationCommand,
  error: unknown,
): void {
  const normalized = normalizeApplicationError(error);
  if (normalized.category !== "CONFLICT") return;
  snapshot = {
    commandType: command.commandType,
    aggregateType: command.aggregateType,
    aggregateId: command.aggregateId,
    error: normalized,
    occurredAt: new Date().toISOString(),
  };
  for (const listener of listeners) listener();
}

export function getGlobalMutationConflictSnapshot(): GlobalMutationConflictSnapshot | undefined {
  return snapshot;
}

export function subscribeGlobalMutationConflict(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearGlobalMutationConflict(): void {
  if (!snapshot) return;
  snapshot = undefined;
  for (const listener of listeners) listener();
}
