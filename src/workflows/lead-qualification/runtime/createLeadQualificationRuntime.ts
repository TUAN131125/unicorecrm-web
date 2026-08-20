import { createTaskSnapshot } from "@/modules/tasks";
import {
  getContactsSnapshot,
  normalizeContactCanonicalProfile,
  saveContactSnapshot,
  type Contact,
} from "@/modules/contacts";
import { createDealSnapshot } from "@/modules/deals";
import { closeLeadSnapshot, getLeadSnapshot } from "@/modules/leads";
import {
  getOrganizationAccountSnapshot,
  getOrganizationAccountsSnapshot,
  saveOrganizationAccountSnapshot,
  type OrganizationAccount,
} from "@/modules/organizations";
import { updateOrders } from "@/modules/orders";
import { updateQuotes } from "@/modules/quotes";
import {
  createPostalAddressFromLine,
  findBestContactIdentityMatch,
  findBestOrganizationIdentityMatch,
  mergeCommunicationConsentProfiles,
} from "@/platform/identity";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { upsertContactOrganizationRelationshipWorkflow } from "@/workflows/contact-organization-relationship";
import type { LeadQualificationPorts } from "../application/ports/LeadQualificationPorts";
import type { LeadRelationshipInput, ResolvedLeadRelationship } from "../domain/leadQualification.types";
import type { Lead } from "@/modules/leads";

function createContactFromLead(
  lead: Lead,
  input: LeadRelationshipInput,
  context: { nowIso: string; seed: string },
): Contact {
  const name = input.contact.name.trim() || lead.representativeName?.trim() || lead.name;
  const email = input.contact.email?.trim() || lead.email || lead.personalEmail || undefined;
  const phone = input.contact.phone?.trim() || lead.phone || lead.workPhone || undefined;
  const title = input.contact.title?.trim() || lead.title || undefined;
  const address = lead.contactAddress || lead.address || undefined;
  return normalizeContactCanonicalProfile({
    id: `contact_${context.seed}`,
    workspaceId: getWorkspaceContextSnapshot().workspaceId,
    name,
    fullName: name,
    title,
    roleTitle: title,
    roleAtCompany: title,
    department: lead.department,
    decisionRole: normalizeDecisionRole(lead.decisionRole),
    email,
    workEmail: email,
    personalEmail: lead.personalEmail,
    phone,
    mobilePhone: phone,
    workPhone: lead.workPhone,
    otherPhone: lead.otherPhone,
    zaloId: lead.zaloId || undefined,
    zalo: lead.zaloId || undefined,
    facebook: lead.facebook,
    address,
    addressDetails: createPostalAddressFromLine(address),
    createdAt: context.nowIso,
    updatedAt: context.nowIso,
    createdBy: lead.ownerId,
    updatedBy: lead.ownerId,
    ownerId: lead.ownerId || "unassigned",
    source: lead.source,
    campaignId: lead.campaignId,
    teamId: lead.assignedTeam,
    status: "needs_follow_up",
    priority: lead.priority === "high" ? "HIGH" : lead.priority === "low" ? "LOW" : "MEDIUM",
    preferredChannel: lead.preferredChannel,
    communicationConsent: hasGrantedConsent(lead),
    consent: lead.consent,
    doNotCall: lead.doNotCall,
    doNotEmail: lead.doNotEmail,
    doNotSms: lead.doNotSms,
    doNotZalo: lead.doNotZalo,
    tags: [...(lead.tags ?? [])],
    interestedProducts: lead.interestedProducts.map((item) => item.productId),
    painPoint: lead.painPoint,
    needSummary: lead.qualificationNotes || lead.description,
    notes: lead.notes,
    internalNotes: lead.internalNotes,
    followUpNote: lead.followUpNote,
    nextFollowUpAt: lead.nextFollowUpAt,
    lastContactedAt: lead.lastContactedAt,
    lastInteractionAt: lead.lastInteractionAt,
    activities: [...(lead.activities || [])],
    convertedFromLeadId: lead.id,
    createdFrom: "lead_qualification",
  }, { workspaceId: getWorkspaceContextSnapshot().workspaceId, now: context.nowIso });
}

function mergeLeadIntoContact(
  contact: Contact,
  lead: Lead,
  input: LeadRelationshipInput,
  context: { nowIso: string },
): Contact {
  const activityById = new Map((contact.activities || []).map((activity) => [activity.id, activity]));
  for (const activity of lead.activities || []) activityById.set(activity.id, activity);
  const preferredName = input.contact.name.trim() || lead.representativeName?.trim() || lead.name;
  const address = contact.address || lead.contactAddress || lead.address || undefined;

  return normalizeContactCanonicalProfile({
    ...contact,
    workspaceId: contact.workspaceId ?? getWorkspaceContextSnapshot().workspaceId,
    name: contact.name || preferredName,
    fullName: contact.fullName || contact.name || preferredName,
    title: contact.title || input.contact.title?.trim() || lead.title || undefined,
    roleTitle: contact.roleTitle || input.contact.title?.trim() || lead.title || undefined,
    department: contact.department || lead.department,
    decisionRole: contact.decisionRole || normalizeDecisionRole(lead.decisionRole),
    email: contact.email || input.contact.email?.trim() || lead.email || lead.personalEmail || undefined,
    workEmail: contact.workEmail || input.contact.email?.trim() || lead.email || undefined,
    personalEmail: contact.personalEmail || lead.personalEmail,
    phone: contact.phone || input.contact.phone?.trim() || lead.phone || lead.workPhone || undefined,
    mobilePhone: contact.mobilePhone || input.contact.phone?.trim() || lead.phone || undefined,
    workPhone: contact.workPhone || lead.workPhone,
    otherPhone: contact.otherPhone || lead.otherPhone,
    zaloId: contact.zaloId || lead.zaloId || undefined,
    zalo: contact.zalo || lead.zaloId || undefined,
    facebook: contact.facebook || lead.facebook,
    address,
    addressDetails: contact.addressDetails ?? createPostalAddressFromLine(address),
    ownerId: contact.ownerId || lead.ownerId || "unassigned",
    source: contact.source || lead.source,
    campaignId: contact.campaignId || lead.campaignId,
    teamId: contact.teamId || lead.assignedTeam,
    preferredChannel: contact.preferredChannel || lead.preferredChannel,
    consent: mergeCommunicationConsentProfiles(contact.consent, lead.consent, context.nowIso),
    communicationConsent: contact.communicationConsent ?? hasGrantedConsent(lead),
    doNotCall: contact.doNotCall ?? lead.doNotCall,
    doNotEmail: contact.doNotEmail ?? lead.doNotEmail,
    doNotSms: contact.doNotSms ?? lead.doNotSms,
    doNotZalo: contact.doNotZalo ?? lead.doNotZalo,
    tags: [...new Set([...(contact.tags ?? []), ...(lead.tags ?? [])])],
    interestedProducts: [...new Set([...(contact.interestedProducts ?? []), ...lead.interestedProducts.map((item) => item.productId)])],
    painPoint: contact.painPoint || lead.painPoint,
    needSummary: contact.needSummary || lead.qualificationNotes || lead.description,
    notes: contact.notes || lead.notes,
    internalNotes: contact.internalNotes || lead.internalNotes,
    followUpNote: contact.followUpNote || lead.followUpNote,
    nextFollowUpAt: contact.nextFollowUpAt || lead.nextFollowUpAt,
    lastContactedAt: maxDate(contact.lastContactedAt, lead.lastContactedAt),
    lastInteractionAt: maxDate(contact.lastInteractionAt, lead.lastInteractionAt),
    activities: [...activityById.values()],
    convertedFromLeadId: contact.convertedFromLeadId || lead.id,
    updatedAt: context.nowIso,
  }, { workspaceId: getWorkspaceContextSnapshot().workspaceId, now: context.nowIso });
}

function resolveOrCreateLeadContact(
  lead: Lead,
  input: LeadRelationshipInput,
  context: { nowIso: string; seed: string },
): Contact {
  const currentContacts = getContactsSnapshot();
  const match = findBestContactIdentityMatch(currentContacts, {
    name: input.contact.name.trim() || lead.representativeName || lead.name,
    email: input.contact.email?.trim() || lead.email || lead.personalEmail,
    phone: input.contact.phone?.trim() || lead.phone || lead.workPhone,
  });
  if (match) return saveContactSnapshot(mergeLeadIntoContact(match.record, lead, input, context));
  return saveContactSnapshot(createContactFromLead(lead, input, context));
}

function linkRepresentativeToOrganization(
  account: OrganizationAccount,
  contact: Contact,
  lead: Lead,
  context: { nowIso: string },
): { account: OrganizationAccount; contact: Contact } {
  const result = upsertContactOrganizationRelationshipWorkflow({
    contactId: contact.id,
    relationship: {
      organizationAccountId: account.id,
      role: contact.decisionRole === "decision_maker" ? "decision_maker"
        : contact.decisionRole === "buyer" ? "buyer"
        : contact.decisionRole === "finance" ? "finance"
        : contact.decisionRole === "technical" ? "technical"
        : "employee",
      roleTitle: contact.roleTitle || contact.title,
      department: contact.department,
      decisionRole: contact.decisionRole,
      isPrimaryRepresentative: !account.primaryContactId || account.primaryContactId === contact.id,
      effectiveFrom: context.nowIso,
    },
    actorId: lead.ownerId || "system",
    now: context.nowIso,
  });
  return { account: result.organization, contact: result.contact };
}

function resolvedRelationship(account: OrganizationAccount, contact: Contact): ResolvedLeadRelationship {
  return {
    relationshipRef: { type: "ORGANIZATION_ACCOUNT", id: account.id },
    displayName: account.displayName,
    contactId: contact.id,
    contactName: contact.fullName || contact.name,
    contactEmail: contact.email,
    contactPhone: contact.phone,
    contactTitle: contact.title,
    contactAddress: contact.address,
    organizationAccountId: account.id,
    organizationName: account.displayName,
    organizationAddress: account.address,
  };
}

function resolveExistingOrganization(
  lead: Lead,
  input: LeadRelationshipInput,
  context: { nowIso: string; seed: string },
  account: OrganizationAccount,
): ResolvedLeadRelationship {
  const contact = resolveOrCreateLeadContact(lead, input, context);
  const linked = linkRepresentativeToOrganization(account, contact, lead, context);
  return resolvedRelationship(linked.account, linked.contact);
}

function resolveRelationship(
  lead: Lead,
  input: LeadRelationshipInput,
  context: { nowIso: string; seed: string },
): ResolvedLeadRelationship {
  if (input.kind === "CONTACT") {
    if (input.mode === "EXISTING") {
      const contact = getContactsSnapshot().find((item) => item.id === input.selectedId);
      if (!contact) throw new Error("Selected Contact relationship was not found.");
      const merged = saveContactSnapshot(mergeLeadIntoContact(contact, lead, input, context));
      return {
        relationshipRef: { type: "CONTACT", id: merged.id },
        displayName: merged.fullName || merged.name,
        contactId: merged.id,
        contactName: merged.fullName || merged.name,
        contactEmail: merged.email,
        contactPhone: merged.phone,
        contactTitle: merged.title,
        contactAddress: merged.address,
      };
    }
    const contact = resolveOrCreateLeadContact(lead, input, context);
    return {
      relationshipRef: { type: "CONTACT", id: contact.id },
      displayName: contact.fullName || contact.name,
      contactId: contact.id,
      contactName: contact.fullName || contact.name,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      contactTitle: contact.title,
      contactAddress: contact.address,
    };
  }

  if (input.mode === "EXISTING") {
    const account = input.selectedId ? getOrganizationAccountSnapshot(input.selectedId) : undefined;
    if (!account) throw new Error("Selected Organization Account was not found.");
    return resolveExistingOrganization(lead, input, context, account);
  }

  const organization = input.organization;
  if (!organization?.displayName.trim()) throw new Error("Organization Account requires a display name.");
  const accountMatch = findBestOrganizationIdentityMatch(getOrganizationAccountsSnapshot(), {
    displayName: organization.displayName,
    legalName: organization.legalName,
    taxCode: organization.taxCode || lead.taxCode,
    domain: organization.domain || lead.website,
    email: organization.email,
    phone: organization.phone || lead.companyPhone,
  });
  if (accountMatch) return resolveExistingOrganization(lead, input, context, accountMatch.record);

  const accountId = `org_${context.seed}`;
  const account: OrganizationAccount = {
    id: accountId,
    workspaceId: getWorkspaceContextSnapshot().workspaceId,
    displayName: organization.displayName.trim(),
    legalName: organization.legalName?.trim() || lead.companyName?.trim() || undefined,
    taxCode: organization.taxCode?.trim() || lead.taxCode?.trim() || undefined,
    domain: organization.domain?.trim() || lead.website?.trim() || undefined,
    website: lead.website?.trim() || organization.domain?.trim() || undefined,
    phone: organization.phone?.trim() || lead.companyPhone || undefined,
    email: organization.email?.trim() || undefined,
    address: organization.address?.trim() || lead.companyAddress || undefined,
    addressDetails: createPostalAddressFromLine(organization.address?.trim() || lead.companyAddress),
    industry: organization.industry?.trim() || lead.industry || undefined,
    sizeBand: lead.companySize || undefined,
    ownerId: lead.ownerId || "unassigned",
    source: lead.source,
    tags: [...(lead.tags || [])],
    status: "prospect",
    relationshipLevel: "new",
    contactRefs: [],
    createdAt: context.nowIso,
    updatedAt: context.nowIso,
  };
  saveOrganizationAccountSnapshot(account);
  const contact = resolveOrCreateLeadContact(lead, input, context);
  const linked = linkRepresentativeToOrganization(account, contact, lead, context);
  return resolvedRelationship(linked.account, linked.contact);
}

export function createLeadQualificationRuntime(): LeadQualificationPorts {
  return {
    leads: {
      getById: getLeadSnapshot,
      close: (leadId, input) => closeLeadSnapshot(leadId, input),
    },
    relationships: { resolve: resolveRelationship },
    tasks: { create: (input) => createTaskSnapshot({
      id: input.id,
      title: input.title,
      description: input.description,
      assigneeId: input.assigneeId,
      dueAt: input.dueAt,
      relationshipRef: input.relationshipRef,
      recordRef: input.recordRef,
      sourceRef: input.sourceRef,
      dedupeKey: input.dedupeKey,
      actorId: input.actorId,
      now: input.now,
    }) },
    deals: { create: (deal) => createDealSnapshot(deal) },
    quotes: {
      create: (quote) => {
        updateQuotes((current) => [quote, ...current]);
        return quote;
      },
    },
    orders: {
      create: (order, relationshipKey) => {
        updateOrders((current) => ({ ...current, [relationshipKey]: [order, ...(current[relationshipKey] || [])] }));
        return order;
      },
    },
  };
}

function normalizeDecisionRole(value?: string): Contact["decisionRole"] {
  const normalized = value?.trim().toLowerCase();
  if (["decision_maker", "influencer", "user", "buyer", "technical", "finance", "other"].includes(normalized ?? "")) {
    return normalized as Contact["decisionRole"];
  }
  return undefined;
}

function hasGrantedConsent(lead: Lead): boolean | undefined {
  if (!lead.consent) return undefined;
  return Object.values(lead.consent.current).some((decision) => decision === "GRANTED");
}

function maxDate(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}
