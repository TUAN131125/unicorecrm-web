import { projectAuthorizedRecord } from "@/platform/access-control/runtime/accessControlRuntime";
import { getAuthSessionSnapshot } from "@/platform/identity-auth/runtime/authRuntime";
import { getActiveWorkspaceId } from "@/platform/workspace-context";
import { subscribeToWorkspaceScope } from "./workspaceScopeRuntime";

interface ScopedRepositoryOptions<TRepository extends object> {
  resourceKey: string;
  createRepository: (workspaceId: string) => TRepository;
  authorizeReads?: boolean;
}

type AnyFn = (...args: any[]) => any;

function shouldEnforceRuntimeAuthorization(): boolean {
  return typeof window !== "undefined" && getAuthSessionSnapshot() !== null;
}

function projectValue(resourceKey: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((record) => projectAuthorizedRecord(resourceKey, record as Record<string, unknown>))
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const looksLikeCollection = entries.length > 0 && entries.every(([, item]) => Array.isArray(item));
    if (looksLikeCollection) {
      return Object.fromEntries(entries.map(([key, records]) => [key, projectValue(resourceKey, records)]));
    }
    return projectAuthorizedRecord(resourceKey, value as Record<string, unknown>);
  }
  return value;
}



export function createWorkspaceScopedRepository<TRepository extends object>(options: ScopedRepositoryOptions<TRepository>): TRepository {
  const instances = new Map<string, TRepository>();

  const currentOrUndefined = (): TRepository | undefined => {
    const workspaceId = getActiveWorkspaceId();
    if (!workspaceId) return undefined;
    let repository = instances.get(workspaceId);
    if (!repository) {
      repository = options.createRepository(workspaceId);
      instances.set(workspaceId, repository);
    }
    return repository;
  };

  const current = (): TRepository => {
    const repository = currentOrUndefined();
    if (!repository) {
      throw new Error("Workspace-scoped repository is unavailable until an active workspace is selected.");
    }
    return repository;
  };

  return new Proxy({} as TRepository, {
    has(_target, property) {
      return property in current();
    },
    get(_target, property) {
      const methodName = String(property);

      if (methodName === "subscribe") {
        // Workspace-scoped runtimes register subscriptions during module startup,
        // before an unauthenticated user has selected a workspace. Defer the
        // repository binding until a workspace is available, then rebind on READY.
        return ((listener: AnyFn) => {
          let unsubscribeRepository: (() => void) | undefined;
          const bind = () => {
            unsubscribeRepository?.();
            unsubscribeRepository = undefined;
            const activeRepository = currentOrUndefined() as Record<PropertyKey, unknown> | undefined;
            if (!activeRepository) return;
            const subscribe = activeRepository[property] as AnyFn;
            unsubscribeRepository = subscribe.call(activeRepository, (payload: unknown) => {
              listener(options.authorizeReads === false || !shouldEnforceRuntimeAuthorization()
                ? payload
                : projectValue(options.resourceKey, payload));
            });
          };

          bind();
          const unsubscribeScope = subscribeToWorkspaceScope((event) => {
            if (event.phase === "DISPOSING") {
              unsubscribeRepository?.();
              unsubscribeRepository = undefined;
            }
            if (event.phase === "READY") bind();
          });

          return () => {
            unsubscribeRepository?.();
            unsubscribeScope();
          };
        }) as unknown;
      }

      const repository = current() as Record<PropertyKey, unknown>;
      const value = repository[property];
      if (typeof value !== "function") return value;

      return ((...args: unknown[]) => {
        const activeRepository = current() as Record<PropertyKey, unknown>;
        const method = activeRepository[property] as AnyFn;
        const result = method.apply(activeRepository, args);
        return options.authorizeReads === false || !shouldEnforceRuntimeAuthorization()
          ? result
          : projectValue(options.resourceKey, result);
      }) as unknown;
    },
  });
}
