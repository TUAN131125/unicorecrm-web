const SECRET_KEY_PATTERN = /(password|secret|token|api[_-]?key|authorization|credential|private[_-]?key)/i;
const RAW_SECRET_PATTERN = /^(?:sk_|pk_|bearer\s|basic\s|eyJ|[A-Za-z0-9+/]{32,}={0,2}$)/i;
const REFERENCE_PATTERN = /^(?:vault|secret|kms):\/\/[a-z0-9][a-z0-9._/-]{4,}$/i;

export function isValidSecretReference(value?: string): boolean {
  return Boolean(value?.trim() && REFERENCE_PATTERN.test(value.trim()));
}

export function containsRawSecret(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim();
  return RAW_SECRET_PATTERN.test(normalized) && !isValidSecretReference(normalized);
}

export function redactSecretReference(value?: string): string {
  if (!value) return "—";
  const normalized = value.trim();
  if (!isValidSecretReference(normalized)) return "[invalid secret reference]";
  const schemeEnd = normalized.indexOf("://") + 3;
  const tail = normalized.slice(schemeEnd);
  const segments = tail.split("/");
  return `${normalized.slice(0, schemeEnd)}${segments[0]}/••••/${segments.at(-1)}`;
}

export function sanitizeSensitiveValue(value: unknown, keyHint = ""): unknown {
  if (SECRET_KEY_PATTERN.test(keyHint)) return "[REDACTED]";
  if (typeof value === "string") return containsRawSecret(value) ? "[REDACTED]" : value;
  if (Array.isArray(value)) return value.map((item) => sanitizeSensitiveValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizeSensitiveValue(item, key)]));
  }
  return value;
}
