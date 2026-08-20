/**
 * Canonical references for CRM relationship records.
 *
 * These are identity references only. They do not own Contact or Organization
 * Account business data and they intentionally contain no presentation fields.
 */
export type RelationshipEntityType = "CONTACT" | "ORGANIZATION_ACCOUNT";

export interface ContactRelationshipRef {
  type: "CONTACT";
  id: string;
}

export interface OrganizationAccountRelationshipRef {
  type: "ORGANIZATION_ACCOUNT";
  id: string;
}

export type RelationshipRef =
  | ContactRelationshipRef
  | OrganizationAccountRelationshipRef;

/** A buyer is always a canonical CRM relationship record, never a Lead. */
export type BuyerRef = RelationshipRef;

export function isContactRelationshipRef(
  ref: RelationshipRef,
): ref is ContactRelationshipRef {
  return ref.type === "CONTACT";
}

export function isOrganizationAccountRelationshipRef(
  ref: RelationshipRef,
): ref is OrganizationAccountRelationshipRef {
  return ref.type === "ORGANIZATION_ACCOUNT";
}

export function relationshipRefKey(ref: RelationshipRef): string {
  return `${ref.type}:${ref.id}`;
}
