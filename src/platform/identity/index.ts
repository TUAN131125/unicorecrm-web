export {
  isContactRelationshipRef,
  isOrganizationAccountRelationshipRef,
  relationshipRefKey,
} from "./relationshipReferences";
export type {
  BuyerRef,
  ContactRelationshipRef,
  OrganizationAccountRelationshipRef,
  RelationshipEntityType,
  RelationshipRef,
} from "./relationshipReferences";

export {
  findBestContactIdentityMatch,
  findBestOrganizationIdentityMatch,
  normalizeDomain,
  normalizeEmail,
  identityTextSimilarity,
  normalizeIdentityText,
  normalizePhone,
  normalizeTaxCode,
} from "./relationshipMatching";
export type {
  ContactIdentityCandidate,
  ContactIdentityInput,
  IdentityMatch,
  OrganizationIdentityCandidate,
  OrganizationIdentityInput,
} from "./relationshipMatching";

export {
  consentAllowsChannel,
  createPostalAddressFromLine,
  formatPostalAddress,
  mergeCommunicationConsentProfiles,
} from "./relationshipProfile";
export type {
  CommunicationConsentChannel,
  CommunicationConsentDecision,
  CommunicationConsentLedgerEntry,
  CommunicationConsentProfile,
  PostalAddress,
} from "./relationshipProfile";
