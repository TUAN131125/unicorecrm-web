export interface UnsavedWorkEntry {
  id: string;
  title: string;
  isDirty: boolean;
  save(): Promise<boolean>;
  discard(): void;
}

const entries = new Map<string, UnsavedWorkEntry>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function registerUnsavedWork(entry: UnsavedWorkEntry): () => void {
  entries.set(entry.id, entry);
  emit();
  return () => {
    if (entries.get(entry.id) === entry) {
      entries.delete(entry.id);
      emit();
    }
  };
}

export function subscribeUnsavedWork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDirtyUnsavedWork(): UnsavedWorkEntry[] {
  return Array.from(entries.values()).filter((entry) => entry.isDirty);
}

export function getUnsavedWorkVersion(): string {
  return Array.from(entries.values())
    .map((entry) => `${entry.id}:${entry.isDirty ? 1 : 0}`)
    .sort()
    .join("|");
}

export async function saveDirtyUnsavedWork(): Promise<boolean> {
  for (const entry of getDirtyUnsavedWork()) {
    if (!(await entry.save())) return false;
  }
  return true;
}

export function discardDirtyUnsavedWork(): void {
  getDirtyUnsavedWork().forEach((entry) => entry.discard());
}
