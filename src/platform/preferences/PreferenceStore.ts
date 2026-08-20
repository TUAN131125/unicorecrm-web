import type { StoragePort } from "../persistence";

export class PreferenceStore {
  constructor(
    private readonly storage: StoragePort,
    private readonly namespace = "unicore.preference",
  ) {}

  get<T>(key: string, fallback: T): T {
    return this.storage.get<T>(this.toStorageKey(key)) ?? fallback;
  }

  set<T>(key: string, value: T): void {
    this.storage.set(this.toStorageKey(key), value);
  }

  remove(key: string): void {
    this.storage.remove(this.toStorageKey(key));
  }

  private toStorageKey(key: string): string {
    return this.namespace ? `${this.namespace}.${key}` : key;
  }
}
