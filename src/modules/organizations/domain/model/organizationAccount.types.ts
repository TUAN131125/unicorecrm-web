import type { ContactRelationshipRef, PostalAddress } from "@/platform/identity";

/**
 * Canonical CRM relationship record for an organization actively managed by
 * the workspace. It is not a Workspace and it is not a Customer aggregate.
 */
export type OrganizationAccountStatus = "prospect" | "active" | "strategic" | "inactive" | "archived";

export type OrganizationRelationshipLevel = "new" | "developing" | "strong" | "strategic";

export interface OrganizationAccount {
  id: string;
  workspaceId: string;
  displayName: string;
  legalName?: string;
  taxCode?: string;
  domain?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  addressDetails?: PostalAddress;
  industry?: string;
  sizeBand?: string;
  ownerId?: string;
  source?: string;
  tags?: string[];
  /** B2B account lifecycle used by Organization UI. */
  status?: OrganizationAccountStatus;
  relationshipLevel?: OrganizationRelationshipLevel;
  employeeCount?: number;
  annualRevenue?: number;
  notes?: string;
  /** Primary individual representative. The Contact remains the identity owner for the person. */
  primaryContactId?: string;
  contactRefs: ContactRelationshipRef[];

  /**
   * Temporary migration aliases. They preserve existing Customer deep links
   * while the Customer route is converted into a read-only system view.
   */
  legacyCustomerId?: string;
  legacyCustomerCode?: string;

  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
  archiveReason?: string;
  anonymizedAt?: string;
  anonymizationReason?: string;
  /** Authoritative optimistic-concurrency version from the backend projection. */
  resourceVersion?: number;
}
