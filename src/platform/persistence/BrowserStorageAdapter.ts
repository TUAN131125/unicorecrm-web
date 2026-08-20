import type { StoragePort } from "./StoragePort";

export class BrowserStorageAdapter implements StoragePort {
  constructor(private readonly storage: Storage | null = typeof window !== "undefined" ? window.localStorage : null) {}

  get<T>(key: string): T | null {
    if (!this.storage) return null;

    const raw = this.storage.getItem(key);
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      // Legacy preferences were sometimes stored as plain strings.
      return raw as T;
    }
  }

  set<T>(key: string, value: T): void {
    if (!this.storage) return;

    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[storage] Failed to write key "${key}".`, error);
    }
  }

  remove(key: string): void {
    if (!this.storage) return;

    try {
      this.storage.removeItem(key);
    } catch (error) {
      console.warn(`[storage] Failed to remove key "${key}".`, error);
    }
  }
}
