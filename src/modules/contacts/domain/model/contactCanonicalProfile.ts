import {
  consentAllowsChannel,
  createPostalAddressFromLine,
  formatPostalAddress,
  type CommunicationConsentProfile,
} from "@/platform/identity";
import type { Contact, PreferredContactChannel } from "./contact.types";

const CHANNEL_MAP: Record<string, PreferredContactChannel | undefined> = {
  PHONE: "phone",
  CALL: "phone",
  EMAIL: "email",
  ZALO: "zalo",
  SMS: "sms",
  FACEBOOK: "facebook",
  MEETING: undefined,
};

export function normalizeContactCanonicalProfile(
  contact: Contact,
  context: { workspaceId?: string; now?: string } = {},
): Contact {
  const now = context.now ?? contact.updatedAt ?? contact.createdAt ?? new Date().toISOString();
  const fullName = clean(contact.fullName) ?? clean(contact.name) ?? "Unnamed contact";
  const jobTitle = clean(contact.roleTitle) ?? clean(contact.title) ?? clean(contact.roleAtCompany);
  const mobilePhone = clean(contact.mobilePhone) ?? clean(contact.phone);
  const workEmail = clean(contact.workEmail) ?? clean(contact.email);
  const zaloId = clean(contact.zaloId) ?? clean(contact.zalo);
  const preferred = normalizePreferredChannel(contact.preferredContactChannel ?? contact.preferredChannel);
  const addressDetails = contact.addressDetails ?? createPostalAddressFromLine(contact.address);
  const address = formatPostalAddress(addressDetails) ?? clean(contact.address);
  const consent = normalizeConsent(contact.consent, contact.communicationConsent, now);
  const callAllowed = consentAllowsChannel(consent, "CALL");
  const emailAllowed = consentAllowsChannel(consent, "EMAIL");
  const smsAllowed = consentAllowsChannel(consent, "SMS");
  const zaloAllowed = consentAllowsChannel(consent, "ZALO");

  return {
    ...contact,
    workspaceId: contact.workspaceId ?? context.workspaceId,
    name: fullName,
    fullName,
    title: jobTitle,
    roleTitle: jobTitle,
    roleAtCompany: clean(contact.roleAtCompany) ?? jobTitle,
    phone: mobilePhone,
    mobilePhone,
    email: workEmail ?? clean(contact.personalEmail),
    workEmail,
    zaloId,
    zalo: zaloId,
    preferredContactChannel: preferred,
    preferredChannel: preferred,
    address,
    addressDetails,
    consent,
    communicationConsent: contact.communicationConsent ?? Object.values(consent?.current ?? {}).some((decision) => decision === "GRANTED"),
    doNotCall: contact.doNotCall ?? (callAllowed === false),
    doNotEmail: contact.doNotEmail ?? (emailAllowed === false),
    doNotSms: contact.doNotSms ?? (smsAllowed === false),
    doNotZalo: contact.doNotZalo ?? (zaloAllowed === false),
    updatedAt: contact.updatedAt ?? now,
  };
}

function normalizeConsent(
  profile: CommunicationConsentProfile | undefined,
  legacyConsent: boolean | undefined,
  now: string,
): CommunicationConsentProfile | undefined {
  if (profile) return profile;
  if (legacyConsent === undefined) return undefined;
  const decision = legacyConsent ? "GRANTED" as const : "UNKNOWN" as const;
  return {
    current: { CALL: decision, EMAIL: decision, SMS: decision, ZALO: decision },
    ledger: [],
    lawfulBasis: legacyConsent ? "LEGACY_GENERAL_CONSENT" : undefined,
    updatedAt: now,
  };
}

function normalizePreferredChannel(value?: string): PreferredContactChannel | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (["phone", "email", "zalo", "facebook", "sms"].includes(normalized)) return normalized as PreferredContactChannel;
  return CHANNEL_MAP[normalized.toUpperCase()];
}

function clean(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
