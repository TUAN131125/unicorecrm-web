import type { ModuleDataAuthorityKey } from "./moduleDataAuthority";

export interface ModuleQueryInvalidationEvent {
  moduleKeys: readonly ModuleDataAuthorityKey[];
  commandType: string;
  aggregateId: string;
  occurredAt: string;
}

type Listener = (event: ModuleQueryInvalidationEvent) => void | Promise<void>;

const listeners = new Map<ModuleDataAuthorityKey, Set<Listener>>();

export function subscribeModuleQueryInvalidation(
  moduleKey: ModuleDataAuthorityKey,
  listener: Listener,
): () => void {
  const current = listeners.get(moduleKey) ?? new Set<Listener>();
  current.add(listener);
  listeners.set(moduleKey, current);
  return () => {
    current.delete(listener);
    if (current.size === 0) listeners.delete(moduleKey);
  };
}

export async function invalidateModuleQueries(event: ModuleQueryInvalidationEvent): Promise<void> {
  const unique = [...new Set(event.moduleKeys)];
  await Promise.allSettled(unique.flatMap((moduleKey) => [...(listeners.get(moduleKey) ?? [])].map((listener) => listener({ ...event, moduleKeys: unique }))));
}
