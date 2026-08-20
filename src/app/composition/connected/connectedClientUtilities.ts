import type { PreferencePort } from "@/platform/preferences";

export function createConnectedPreferencePort(): PreferencePort {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T): T {
      return values.has(key) ? values.get(key) as T : fallback;
    },
    set<T>(key: string, value: T): void {
      values.set(key, value);
    },
    remove(key: string): void {
      values.delete(key);
    },
  };
}

export function downloadConnectedTextFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Client-side export requires a browser document.");
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
