import type { StoragePort } from "@/platform/persistence";

export class WorkspaceScopedStorageAdapter implements StoragePort {
  constructor(
    private readonly base: StoragePort,
    private readonly workspaceId: string,
    private readonly namespace: string,
  ) {}

  private key(key: string): string { return `workspace:${this.workspaceId}:${this.namespace}:${key}`; }
  get<T>(key: string): T | null { return this.base.get<T>(this.key(key)); }
  set<T>(key: string, value: T): void { this.base.set(this.key(key), value); }
  remove(key: string): void { this.base.remove(this.key(key)); }
}
