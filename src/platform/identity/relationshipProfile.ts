export type CommunicationConsentChannel = "CALL" | "EMAIL" | "SMS" | "ZALO";
export type CommunicationConsentDecision = "GRANTED" | "DENIED" | "WITHDRAWN" | "UNKNOWN";

export interface CommunicationConsentLedgerEntry {
  id: string;
  channel: CommunicationConsentChannel;
  decision: CommunicationConsentDecision;
  source: string;
  occurredAt: string;
  actorId?: string;
  evidence?: string;
  expiresAt?: string;
}

export interface CommunicationConsentProfile {
  current: Partial<Record<CommunicationConsentChannel, CommunicationConsentDecision>>;
  ledger: CommunicationConsentLedgerEntry[];
  lawfulBasis?: string;
  updatedAt: string;
}

export interface PostalAddress {
  line1: string;
  line2?: string;
  ward?: string;
  district?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  formatted?: string;
}

export function mergeCommunicationConsentProfiles(
  current: CommunicationConsentProfile | undefined,
  incoming: CommunicationConsentProfile | undefined,
  now = new Date().toISOString(),
): CommunicationConsentProfile | undefined {
  if (!current && !incoming) return undefined;
  const ledgerById = new Map<string, CommunicationConsentLedgerEntry>();
  for (const entry of current?.ledger ?? []) ledgerById.set(entry.id, structuredClone(entry));
  for (const entry of incoming?.ledger ?? []) ledgerById.set(entry.id, structuredClone(entry));
  const ledger = [...ledgerById.values()].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const latestByChannel = new Map<CommunicationConsentChannel, CommunicationConsentLedgerEntry>();
  for (const entry of ledger) {
    const existing = latestByChannel.get(entry.channel);
    if (!existing || existing.occurredAt <= entry.occurredAt) latestByChannel.set(entry.channel, entry);
  }
  const currentDecision: CommunicationConsentProfile["current"] = {
    ...(current?.current ?? {}),
    ...(incoming?.current ?? {}),
  };
  for (const [channel, entry] of latestByChannel) currentDecision[channel] = entry.decision;
  return {
    current: currentDecision,
    ledger,
    lawfulBasis: incoming?.lawfulBasis ?? current?.lawfulBasis,
    updatedAt: incoming?.updatedAt ?? current?.updatedAt ?? now,
  };
}

export function consentAllowsChannel(
  profile: CommunicationConsentProfile | undefined,
  channel: CommunicationConsentChannel,
): boolean | undefined {
  const decision = profile?.current[channel];
  if (!decision || decision === "UNKNOWN") return undefined;
  return decision === "GRANTED";
}

export function createPostalAddressFromLine(value?: string): PostalAddress | undefined {
  const normalized = value?.trim();
  return normalized ? { line1: normalized, formatted: normalized } : undefined;
}

export function formatPostalAddress(address?: PostalAddress): string | undefined {
  if (!address) return undefined;
  return address.formatted?.trim() || [
    address.line1,
    address.line2,
    address.ward,
    address.district,
    address.province,
    address.country,
    address.postalCode,
  ].filter(Boolean).join(", ") || undefined;
}
