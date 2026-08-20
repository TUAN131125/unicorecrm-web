import {
  getContactSnapshot,
  getContactsSnapshot,
  normalizeContactCanonicalProfile,
  resolveOrganizationPrimaryContact,
  saveContactSnapshot,
  type Contact,
} from "@/modules/contacts";
import { assertCustomerRelationshipContextSnapshot } from "@/modules/customers";
import { createPostalAddressFromLine, mergeCommunicationConsentProfiles, type CommunicationConsentChannel, type CommunicationConsentProfile } from "@/platform/identity";
import { getOrganizationAccountSnapshot, saveOrganizationAccountSnapshot, type OrganizationAccount } from "@/modules/organizations";

export interface CustomerIdentityPatch {
  displayName?: string;
  email?: string;
  phone?: string;
  address?: string;
  source?: string;

  salutation?: string;
  title?: string;
  department?: string;
  roleAtCompany?: string;
  workEmail?: string;
  personalEmail?: string;
  mobilePhone?: string;
  workPhone?: string;
  otherPhone?: string;
  zalo?: string;
  facebook?: string;
  preferredContactChannel?: string;
  communicationConsent?: boolean;
  doNotCall?: boolean;
  doNotEmail?: boolean;
  doNotSms?: boolean;
  doNotZalo?: boolean;
  doNotContact?: boolean;
  doNotContactReason?: string;
  decisionRole?: string;
  relationshipLevel?: string;
  painPoint?: string;
  needSummary?: string;
  consultingNote?: string;
  followUpNote?: string;
  contactNotes?: string;

  legalName?: string;
  taxCode?: string;
  domain?: string;
  website?: string;
  industry?: string;
  sizeBand?: string;
  employeeCount?: number;
  annualRevenue?: number;
  organizationStatus?: string;
  organizationRelationshipLevel?: string;
  organizationNotes?: string;
  actorId?: string;
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function updateConsentProfile(
  contact: Contact,
  patch: CustomerIdentityPatch,
  now: string,
): CommunicationConsentProfile | undefined {
  const channelRestrictions: Array<[CommunicationConsentChannel, boolean | undefined]> = [
    ["CALL", patch.doNotCall],
    ["EMAIL", patch.doNotEmail],
    ["SMS", patch.doNotSms],
    ["ZALO", patch.doNotZalo],
  ];
  const changed = patch.communicationConsent !== undefined || channelRestrictions.some(([, value]) => value !== undefined);
  if (!changed) return contact.consent;

  const current: CommunicationConsentProfile["current"] = { ...(contact.consent?.current ?? {}) };
  const ledger = [...(contact.consent?.ledger ?? [])];
  for (const [channel, restricted] of channelRestrictions) {
    const decision = restricted === true
      ? "DENIED" as const
      : patch.communicationConsent === true
        ? "GRANTED" as const
        : restricted === false
          ? "UNKNOWN" as const
          : undefined;
    if (!decision || current[channel] === decision) continue;
    current[channel] = decision;
    ledger.push({
      id: `consent_${crypto.randomUUID()}`,
      channel,
      decision,
      source: "CUSTOMER_360_EDIT",
      occurredAt: now,
      actorId: patch.actorId,
    });
  }
  return mergeCommunicationConsentProfiles(contact.consent, {
    current,
    ledger,
    lawfulBasis: patch.communicationConsent ? "CUSTOMER_360_CONFIRMED" : contact.consent?.lawfulBasis,
    updatedAt: now,
  }, now);
}

export function updateCustomerIdentityFrom360(customerId: string, patch: CustomerIdentityPatch) {
  const { customer } = assertCustomerRelationshipContextSnapshot(customerId);
  const now = new Date().toISOString();

  if (customer.relationshipRef.type === "CONTACT") {
    const contact = getContactSnapshot(customer.relationshipRef.id);
    if (!contact) throw new Error("Customer source Contact was not found.");
    const displayName = optional(patch.displayName) || contact.fullName || contact.name;
    const saved: Contact = normalizeContactCanonicalProfile({
      ...contact,
      name: displayName,
      fullName: displayName,
      email: optional(patch.email),
      phone: optional(patch.phone),
      address: optional(patch.address),
      addressDetails: createPostalAddressFromLine(patch.address) ?? contact.addressDetails,
      source: optional(patch.source),
      salutation: optional(patch.salutation),
      title: optional(patch.title),
      roleTitle: optional(patch.title),
      department: optional(patch.department),
      roleAtCompany: optional(patch.roleAtCompany),
      workEmail: optional(patch.workEmail),
      personalEmail: optional(patch.personalEmail) || optional(patch.email),
      mobilePhone: optional(patch.mobilePhone) || optional(patch.phone),
      workPhone: optional(patch.workPhone),
      otherPhone: optional(patch.otherPhone),
      zalo: optional(patch.zalo),
      zaloId: optional(patch.zalo),
      facebook: optional(patch.facebook),
      preferredContactChannel: optional(patch.preferredContactChannel) as Contact["preferredContactChannel"],
      preferredChannel: optional(patch.preferredContactChannel),
      communicationConsent: patch.communicationConsent,
      consent: updateConsentProfile(contact, patch, now),
      doNotCall: patch.doNotCall,
      doNotEmail: patch.doNotEmail,
      doNotSms: patch.doNotSms,
      doNotZalo: patch.doNotZalo,
      doNotContact: patch.doNotContact,
      doNotContactReason: optional(patch.doNotContactReason),
      decisionRole: optional(patch.decisionRole) as Contact["decisionRole"],
      relationshipLevel: optional(patch.relationshipLevel) as Contact["relationshipLevel"],
      painPoint: optional(patch.painPoint),
      needSummary: optional(patch.needSummary),
      consultingNote: optional(patch.consultingNote),
      followUpNote: optional(patch.followUpNote),
      notes: optional(patch.contactNotes),
      updatedAt: now,
    }, { now });
    return saveContactSnapshot(saved);
  }

  const organization = getOrganizationAccountSnapshot(customer.relationshipRef.id);
  if (!organization) throw new Error("Customer source Organization was not found.");
  const savedOrganization: OrganizationAccount = {
    ...organization,
    displayName: optional(patch.displayName) || organization.displayName,
    email: optional(patch.email),
    phone: optional(patch.phone),
    address: optional(patch.address),
    addressDetails: createPostalAddressFromLine(patch.address) ?? organization.addressDetails,
    source: optional(patch.source),
    legalName: optional(patch.legalName),
    taxCode: optional(patch.taxCode),
    domain: optional(patch.domain),
    website: optional(patch.website),
    industry: optional(patch.industry),
    sizeBand: optional(patch.sizeBand),
    employeeCount: patch.employeeCount,
    annualRevenue: patch.annualRevenue,
    status: optional(patch.organizationStatus) as OrganizationAccount["status"],
    relationshipLevel: optional(patch.organizationRelationshipLevel) as OrganizationAccount["relationshipLevel"],
    notes: optional(patch.organizationNotes),
    updatedAt: now,
  };
  const organizationResult = saveOrganizationAccountSnapshot(savedOrganization);

  const primaryContact = resolveOrganizationPrimaryContact(
    organization.id,
    getContactsSnapshot(),
    organizationResult,
  );
  if (!primaryContact) return { organization: organizationResult, primaryContact: undefined };

  const contactDisplayName = primaryContact.fullName || primaryContact.name;
  const savedContact = saveContactSnapshot(normalizeContactCanonicalProfile({
    ...primaryContact,
    name: contactDisplayName,
    fullName: contactDisplayName,
    salutation: optional(patch.salutation) ?? primaryContact.salutation,
    title: optional(patch.title) ?? primaryContact.title,
    roleTitle: optional(patch.title) ?? primaryContact.roleTitle,
    department: optional(patch.department) ?? primaryContact.department,
    roleAtCompany: optional(patch.roleAtCompany) ?? primaryContact.roleAtCompany,
    workEmail: optional(patch.workEmail) ?? primaryContact.workEmail,
    personalEmail: optional(patch.personalEmail) ?? primaryContact.personalEmail,
    mobilePhone: optional(patch.mobilePhone) ?? primaryContact.mobilePhone,
    workPhone: optional(patch.workPhone) ?? primaryContact.workPhone,
    otherPhone: optional(patch.otherPhone) ?? primaryContact.otherPhone,
    zalo: optional(patch.zalo) ?? primaryContact.zalo,
    zaloId: optional(patch.zalo) ?? primaryContact.zaloId,
    facebook: optional(patch.facebook) ?? primaryContact.facebook,
    preferredContactChannel: optional(patch.preferredContactChannel) as Contact["preferredContactChannel"] ?? primaryContact.preferredContactChannel,
    preferredChannel: optional(patch.preferredContactChannel) ?? primaryContact.preferredChannel,
    communicationConsent: patch.communicationConsent ?? primaryContact.communicationConsent,
    consent: updateConsentProfile(primaryContact, patch, now),
    doNotCall: patch.doNotCall ?? primaryContact.doNotCall,
    doNotEmail: patch.doNotEmail ?? primaryContact.doNotEmail,
    doNotSms: patch.doNotSms ?? primaryContact.doNotSms,
    doNotZalo: patch.doNotZalo ?? primaryContact.doNotZalo,
    doNotContact: patch.doNotContact ?? primaryContact.doNotContact,
    doNotContactReason: optional(patch.doNotContactReason) ?? primaryContact.doNotContactReason,
    decisionRole: optional(patch.decisionRole) as Contact["decisionRole"] ?? primaryContact.decisionRole,
    relationshipLevel: optional(patch.relationshipLevel) as Contact["relationshipLevel"] ?? primaryContact.relationshipLevel,
    painPoint: optional(patch.painPoint) ?? primaryContact.painPoint,
    needSummary: optional(patch.needSummary) ?? primaryContact.needSummary,
    consultingNote: optional(patch.consultingNote) ?? primaryContact.consultingNote,
    followUpNote: optional(patch.followUpNote) ?? primaryContact.followUpNote,
    notes: optional(patch.contactNotes) ?? primaryContact.notes,
    updatedAt: now,
  }, { now }));

  return { organization: organizationResult, primaryContact: savedContact };
}
