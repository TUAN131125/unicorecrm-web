import {
  getActiveContactOrganizationRelationships,
  getContactsSnapshot,
  normalizeContactCanonicalProfile,
  type Contact,
} from "@/modules/contacts";
import { getOrganizationAccountsSnapshot, type OrganizationAccount } from "@/modules/organizations";
import {
  identityTextSimilarity,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  normalizeTaxCode,
} from "@/platform/identity";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type { Customer } from "../../domain/model/customer.types";

export type RelationshipDataQualitySeverity = "ERROR" | "WARNING" | "INFO";
export type RelationshipDataQualityIssueType =
  | "CUSTOMER_SOURCE_MISSING"
  | "CUSTOMER_RELATIONSHIP_DUPLICATE"
  | "CUSTOMER_ONBOARDING_PENDING"
  | "CONTACT_WORKSPACE_MISSING"
  | "CONTACT_ALIAS_DRIFT"
  | "CONTACT_DUPLICATE_CANDIDATE"
  | "ORGANIZATION_DUPLICATE_CANDIDATE"
  | "ORGANIZATION_RELATIONSHIP_ONE_SIDED"
  | "ORGANIZATION_PRIMARY_MISMATCH";

export interface RelationshipDataQualityIssue {
  id: string;
  type: RelationshipDataQualityIssueType;
  severity: RelationshipDataQualitySeverity;
  recordType: "CUSTOMER" | "CONTACT" | "ORGANIZATION" | "RELATIONSHIP";
  recordId: string;
  relatedRecordIds?: string[];
  message: string;
}

export interface CustomerRelationshipDataQualitySummary {
  checkedAt: string;
  total: number;
  errors: number;
  warnings: number;
  info: number;
  issues: RelationshipDataQualityIssue[];
}

export function auditCustomerRelationshipDataQuality(input: {
  customers: readonly Customer[];
  contacts?: readonly Contact[];
  organizations?: readonly OrganizationAccount[];
  now?: string;
}): CustomerRelationshipDataQualitySummary {
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  const customers = [...input.customers];
  const contacts = [...(input.contacts ?? getContactsSnapshot())];
  const organizations = [...(input.organizations ?? getOrganizationAccountsSnapshot())];
  const issues: RelationshipDataQualityIssue[] = [];
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));

  const customerRelationshipOwners = new Map<string, Customer[]>();
  for (const customer of customers) {
    const key = `${customer.relationshipRef.type}:${customer.relationshipRef.id}`;
    customerRelationshipOwners.set(key, [...(customerRelationshipOwners.get(key) ?? []), customer]);
    const sourceExists = customer.relationshipRef.type === "CONTACT"
      ? contactById.has(customer.relationshipRef.id)
      : organizationById.has(customer.relationshipRef.id);
    if (!sourceExists) issues.push(issue("CUSTOMER_SOURCE_MISSING", "ERROR", "CUSTOMER", customer.id, `Customer ${customer.customerCode} points to a missing ${customer.relationshipRef.type}.`, [customer.relationshipRef.id]));
    if (customer.onboardingStatus !== "COMPLETED") issues.push(issue("CUSTOMER_ONBOARDING_PENDING", "INFO", "CUSTOMER", customer.id, `Customer ${customer.customerCode} has not completed onboarding.`));
  }
  for (const [key, records] of customerRelationshipOwners) {
    if (records.length > 1) issues.push(issue("CUSTOMER_RELATIONSHIP_DUPLICATE", "ERROR", "CUSTOMER", records[0].id, `Multiple Customer records share ${key}.`, records.slice(1).map((record) => record.id)));
  }

  for (const contact of contacts) {
    if (!contact.workspaceId) issues.push(issue("CONTACT_WORKSPACE_MISSING", "WARNING", "CONTACT", contact.id, `Contact ${contact.fullName || contact.name} is missing canonical workspaceId.`));
    else if (contact.workspaceId !== workspaceId) issues.push(issue("CONTACT_WORKSPACE_MISSING", "ERROR", "CONTACT", contact.id, `Contact belongs to workspace ${contact.workspaceId}, not ${workspaceId}.`));
    const normalized = normalizeContactCanonicalProfile(contact, { workspaceId });
    if (contact.name !== normalized.name || contact.fullName !== normalized.fullName || contact.email !== normalized.email || contact.phone !== normalized.phone || contact.zaloId !== normalized.zaloId) {
      issues.push(issue("CONTACT_ALIAS_DRIFT", "WARNING", "CONTACT", contact.id, `Contact ${contact.fullName || contact.name} has compatibility aliases that do not match canonical values.`));
    }
    for (const relationship of getActiveContactOrganizationRelationships(contact)) {
      const organization = organizationById.get(relationship.organizationAccountId);
      if (!organization || !organization.contactRefs.some((ref) => ref.id === contact.id)) {
        issues.push(issue("ORGANIZATION_RELATIONSHIP_ONE_SIDED", "ERROR", "RELATIONSHIP", `${contact.id}:${relationship.organizationAccountId}`, `Contact relationship is not projected to the Organization.`, [contact.id, relationship.organizationAccountId]));
      }
      if (relationship.isPrimaryRepresentative && organization?.primaryContactId !== contact.id) {
        issues.push(issue("ORGANIZATION_PRIMARY_MISMATCH", "ERROR", "RELATIONSHIP", `${contact.id}:${relationship.organizationAccountId}`, `Primary representative flags disagree between Contact and Organization.`, [contact.id, relationship.organizationAccountId]));
      }
    }
  }

  for (const organization of organizations) {
    for (const ref of organization.contactRefs) {
      const contact = contactById.get(ref.id);
      const linked = contact && getActiveContactOrganizationRelationships(contact).some((relationship) => relationship.organizationAccountId === organization.id);
      if (!linked) issues.push(issue("ORGANIZATION_RELATIONSHIP_ONE_SIDED", "ERROR", "RELATIONSHIP", `${organization.id}:${ref.id}`, `Organization contact reference is not backed by an active Contact relationship.`, [organization.id, ref.id]));
    }
    if (organization.primaryContactId && !organization.contactRefs.some((ref) => ref.id === organization.primaryContactId)) {
      issues.push(issue("ORGANIZATION_PRIMARY_MISMATCH", "ERROR", "ORGANIZATION", organization.id, `Organization primaryContactId is not present in contactRefs.`, [organization.primaryContactId]));
    }
  }

  for (let leftIndex = 0; leftIndex < contacts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < contacts.length; rightIndex += 1) {
      const left = contacts[leftIndex]; const right = contacts[rightIndex];
      const emailMatch = Boolean(normalizeEmail(left.email || left.workEmail || left.personalEmail) && normalizeEmail(left.email || left.workEmail || left.personalEmail) === normalizeEmail(right.email || right.workEmail || right.personalEmail));
      const phoneMatch = Boolean(normalizePhone(left.phone || left.mobilePhone || left.workPhone) && normalizePhone(left.phone || left.mobilePhone || left.workPhone) === normalizePhone(right.phone || right.mobilePhone || right.workPhone));
      const nameSimilarity = identityTextSimilarity(left.fullName || left.name, right.fullName || right.name);
      if (emailMatch || phoneMatch || nameSimilarity >= 0.94) issues.push(issue("CONTACT_DUPLICATE_CANDIDATE", emailMatch || phoneMatch ? "ERROR" : "WARNING", "CONTACT", left.id, `Possible duplicate Contact: ${left.fullName || left.name} / ${right.fullName || right.name}.`, [right.id]));
    }
  }

  for (let leftIndex = 0; leftIndex < organizations.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < organizations.length; rightIndex += 1) {
      const left = organizations[leftIndex]; const right = organizations[rightIndex];
      const taxMatch = Boolean(normalizeTaxCode(left.taxCode) && normalizeTaxCode(left.taxCode) === normalizeTaxCode(right.taxCode));
      const domainMatch = Boolean(normalizeDomain(left.domain || left.website) && normalizeDomain(left.domain || left.website) === normalizeDomain(right.domain || right.website));
      const nameSimilarity = identityTextSimilarity(left.legalName || left.displayName, right.legalName || right.displayName);
      if (taxMatch || domainMatch || nameSimilarity >= 0.92) issues.push(issue("ORGANIZATION_DUPLICATE_CANDIDATE", taxMatch || domainMatch ? "ERROR" : "WARNING", "ORGANIZATION", left.id, `Possible duplicate Organization: ${left.displayName} / ${right.displayName}.`, [right.id]));
    }
  }

  return {
    checkedAt: input.now ?? new Date().toISOString(),
    total: issues.length,
    errors: issues.filter((item) => item.severity === "ERROR").length,
    warnings: issues.filter((item) => item.severity === "WARNING").length,
    info: issues.filter((item) => item.severity === "INFO").length,
    issues,
  };
}

function issue(type: RelationshipDataQualityIssueType, severity: RelationshipDataQualitySeverity, recordType: RelationshipDataQualityIssue["recordType"], recordId: string, message: string, relatedRecordIds?: string[]): RelationshipDataQualityIssue {
  return { id: `${type}:${recordId}`, type, severity, recordType, recordId, relatedRecordIds, message };
}
