export * from "./contacts";

export { getContact, getContactStatusCounts, queryContacts } from "../application/queries/contactQueries";

export { changeContactStatus, appendActivityToContact, reassignContact } from "../application/commands/contactCommands";

export type { ContactRepository } from "../application/ports/ContactRepository";

export type {
  Contact,
  ContactStatus,
  ContactDecisionRole,
  ContactRelationshipLevel,
  PreferredContactChannel,
  ContactOrganizationRelationship,
  ContactOrganizationRelationshipRole,
} from "../domain/model/contact.types";

export { findContactsByOrganizationAccountId } from "../application/queries/contactQueries";

export {
  applyContactOrganizationRelationshipProjection,
  endContactOrganizationRelationship,
  findContactOrganizationRelationship,
  getActiveContactOrganizationRelationships,
  getContactOrganizationRelationships,
  getPrimaryContactOrganizationRelationship,
  isContactLinkedToOrganization,
  isContactOrganizationRelationshipActive,
  setContactOrganizationPrimaryFlag,
  upsertContactOrganizationRelationship,
  type ContactOrganizationRelationshipDraft,
} from "../domain/model/contactOrganizationRelationships";

export { normalizeContactCanonicalProfile } from "../domain/model/contactCanonicalProfile";

export { resolveOrganizationContacts, resolveOrganizationPrimaryContact } from "../application/queries/organizationContactQueries";
