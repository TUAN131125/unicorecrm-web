import type {
  Contact,
  ContactOrganizationRelationship,
  ContactOrganizationRelationshipRole,
} from "./contact.types";

export interface ContactOrganizationRelationshipDraft {
  organizationAccountId: string;
  role: ContactOrganizationRelationshipRole;
  roleTitle?: string;
  department?: string;
  decisionRole?: Contact["decisionRole"];
  isPrimaryRepresentative?: boolean;
  effectiveFrom?: string;
}

export function getContactOrganizationRelationships(
  contact: Contact,
): ContactOrganizationRelationship[] {
  if (contact.organizationRelationships?.length) {
    return contact.organizationRelationships
      .map((relationship) => structuredClone(relationship))
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
  }
  if (!contact.organizationAccountId) return [];
  const createdAt = contact.createdAt || contact.updatedAt || new Date(0).toISOString();
  return [{
    id: projectedRelationshipId(contact.id, contact.organizationAccountId),
    organizationAccountId: contact.organizationAccountId,
    role: inferCompatibilityRole(contact),
    roleTitle: contact.roleAtCompany || contact.roleTitle,
    department: contact.department,
    decisionRole: contact.decisionRole,
    isPrimaryRepresentative: Boolean(contact.isPrimaryContact),
    effectiveFrom: createdAt,
    createdAt,
    createdBy: contact.createdBy,
    updatedAt: contact.updatedAt,
    updatedBy: contact.updatedBy,
  }];
}

export function getActiveContactOrganizationRelationships(
  contact: Contact,
  at = new Date().toISOString(),
): ContactOrganizationRelationship[] {
  return getContactOrganizationRelationships(contact).filter(
    (relationship) => isContactOrganizationRelationshipActive(relationship, at),
  );
}

export function isContactOrganizationRelationshipActive(
  relationship: ContactOrganizationRelationship,
  at = new Date().toISOString(),
): boolean {
  return relationship.effectiveFrom <= at && (!relationship.effectiveTo || relationship.effectiveTo > at);
}

export function findContactOrganizationRelationship(
  contact: Contact,
  organizationAccountId: string,
  options: { activeOnly?: boolean; at?: string } = {},
): ContactOrganizationRelationship | undefined {
  const relationships = options.activeOnly === false
    ? getContactOrganizationRelationships(contact)
    : getActiveContactOrganizationRelationships(contact, options.at);
  return relationships.find((relationship) => relationship.organizationAccountId === organizationAccountId);
}

export function isContactLinkedToOrganization(
  contact: Contact,
  organizationAccountId: string,
  at?: string,
): boolean {
  return Boolean(findContactOrganizationRelationship(contact, organizationAccountId, { at }));
}

export function getPrimaryContactOrganizationRelationship(
  contact: Contact,
  at?: string,
): ContactOrganizationRelationship | undefined {
  const active = getActiveContactOrganizationRelationships(contact, at);
  return active.find((relationship) => relationship.isPrimaryRepresentative)
    ?? active.find((relationship) => relationship.organizationAccountId === contact.organizationAccountId)
    ?? active[0];
}

export function upsertContactOrganizationRelationship(
  contact: Contact,
  draft: ContactOrganizationRelationshipDraft,
  context: { actorId: string; now?: string },
): Contact {
  const now = context.now ?? new Date().toISOString();
  const effectiveFrom = draft.effectiveFrom ?? now;
  if (!draft.organizationAccountId.trim()) throw new Error("ORGANIZATION_RELATIONSHIP_ORGANIZATION_REQUIRED");
  if (effectiveFrom > now) throw new Error("ORGANIZATION_RELATIONSHIP_FUTURE_EFFECTIVE_DATE");
  const relationships = getContactOrganizationRelationships(contact);
  const existingIndex = relationships.findIndex(
    (relationship) => relationship.organizationAccountId === draft.organizationAccountId && !relationship.effectiveTo,
  );
  const nextRelationship: ContactOrganizationRelationship = existingIndex >= 0
    ? {
        ...relationships[existingIndex],
        role: draft.role,
        roleTitle: clean(draft.roleTitle),
        department: clean(draft.department),
        decisionRole: draft.decisionRole,
        isPrimaryRepresentative: Boolean(draft.isPrimaryRepresentative),
        updatedAt: now,
        updatedBy: context.actorId,
      }
    : {
        id: `contact-org-${crypto.randomUUID()}`,
        organizationAccountId: draft.organizationAccountId,
        role: draft.role,
        roleTitle: clean(draft.roleTitle),
        department: clean(draft.department),
        decisionRole: draft.decisionRole,
        isPrimaryRepresentative: Boolean(draft.isPrimaryRepresentative),
        effectiveFrom,
        createdAt: now,
        createdBy: context.actorId,
      };
  const nextRelationships = existingIndex >= 0
    ? relationships.map((relationship, index) => index === existingIndex ? nextRelationship : relationship)
    : [...relationships, nextRelationship];
  return applyContactOrganizationRelationshipProjection(contact, nextRelationships, now, context.actorId);
}

export function endContactOrganizationRelationship(
  contact: Contact,
  organizationAccountId: string,
  input: { actorId: string; reason: string; effectiveTo?: string },
): Contact {
  const now = input.effectiveTo ?? new Date().toISOString();
  if (!input.reason.trim()) throw new Error("ORGANIZATION_RELATIONSHIP_END_REASON_REQUIRED");
  let matched = false;
  const relationships = getContactOrganizationRelationships(contact).map((relationship) => {
    if (relationship.organizationAccountId !== organizationAccountId || relationship.effectiveTo) return relationship;
    if (now < relationship.effectiveFrom) throw new Error("ORGANIZATION_RELATIONSHIP_INVALID_EFFECTIVE_RANGE");
    matched = true;
    return {
      ...relationship,
      isPrimaryRepresentative: false,
      effectiveTo: now,
      endedReason: input.reason.trim(),
      updatedAt: now,
      updatedBy: input.actorId,
    };
  });
  if (!matched) throw new Error("ORGANIZATION_RELATIONSHIP_ACTIVE_LINK_NOT_FOUND");
  return applyContactOrganizationRelationshipProjection(contact, relationships, now, input.actorId);
}

export function setContactOrganizationPrimaryFlag(
  contact: Contact,
  organizationAccountId: string,
  isPrimaryRepresentative: boolean,
  context: { actorId: string; now?: string },
): Contact {
  const now = context.now ?? new Date().toISOString();
  let matched = false;
  const relationships = getContactOrganizationRelationships(contact).map((relationship) => {
    if (relationship.organizationAccountId !== organizationAccountId || !isContactOrganizationRelationshipActive(relationship, now)) return relationship;
    matched = true;
    return {
      ...relationship,
      isPrimaryRepresentative,
      updatedAt: now,
      updatedBy: context.actorId,
    };
  });
  if (!matched) throw new Error("ORGANIZATION_RELATIONSHIP_ACTIVE_LINK_NOT_FOUND");
  return applyContactOrganizationRelationshipProjection(contact, relationships, now, context.actorId);
}

export function applyContactOrganizationRelationshipProjection(
  contact: Contact,
  relationships: readonly ContactOrganizationRelationship[],
  now = new Date().toISOString(),
  actorId?: string,
): Contact {
  const normalized = relationships.map((relationship) => structuredClone(relationship));
  const active = normalized.filter((relationship) => isContactOrganizationRelationshipActive(relationship, now));
  const primary = active.find((relationship) => relationship.isPrimaryRepresentative)
    ?? active.find((relationship) => relationship.organizationAccountId === contact.organizationAccountId)
    ?? active[0];
  return {
    ...contact,
    organizationRelationships: normalized,
    organizationAccountId: primary?.organizationAccountId,
    roleAtCompany: primary?.roleTitle ?? contact.roleAtCompany,
    department: primary?.department ?? contact.department,
    decisionRole: primary?.decisionRole ?? contact.decisionRole,
    isPrimaryContact: Boolean(primary?.isPrimaryRepresentative),
    updatedAt: now,
    updatedBy: actorId ?? contact.updatedBy,
  };
}

function inferCompatibilityRole(contact: Contact): ContactOrganizationRelationshipRole {
  if (contact.decisionRole === "decision_maker") return "decision_maker";
  if (contact.decisionRole === "buyer") return "buyer";
  if (contact.decisionRole === "finance") return "finance";
  if (contact.decisionRole === "technical") return "technical";
  return "employee";
}

function projectedRelationshipId(contactId: string, organizationAccountId: string): string {
  return `projected:${contactId}:${organizationAccountId}`;
}

function clean(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
