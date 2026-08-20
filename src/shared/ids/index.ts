const secureUuid = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) throw new Error("Secure UUID generation is unavailable in this runtime.");
  return uuid;
};

/**
 * Collision-resistant client request identifier. It is suitable for idempotency,
 * optimistic UI and local demo aggregates, but it is not a regulated document number.
 */
export function createDurableId(prefix: string): string {
  return `${prefix}_${secureUuid()}`;
}

/**
 * Temporary aggregate target used before a create command returns the authoritative
 * server identity. Connected backends must replace this target in the command result.
 */
export function createCreateCommandTarget(prefix: string): string {
  return `pending_${prefix}_${secureUuid()}`;
}

/**
 * Human-readable provisional number for local demo and optimistic UI only. The
 * DRAFT prefix makes it impossible to confuse this value with server numbering.
 */
export function createProvisionalDocumentNumber(prefix: string): string {
  return `DRAFT-${prefix}-${secureUuid().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

export function isProvisionalIdentity(value: string | undefined): boolean {
  return Boolean(value && (value.startsWith("pending_") || value.startsWith("DRAFT-")));
}
