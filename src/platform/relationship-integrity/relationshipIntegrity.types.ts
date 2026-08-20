import type { RelationshipRef } from "@/platform/identity";

export type RelationshipIntegrityIssueCode =
  | "ORPHAN_RELATIONSHIP"
  | "CUSTOMER_RELATIONSHIP_MISMATCH"
  | "DUPLICATE_CONTACT_IDENTITY"
  | "DUPLICATE_ORGANIZATION_IDENTITY"
  | "CROSS_WORKSPACE_REFERENCE"
  | "BROKEN_SOURCE_CHAIN";

export type RelationshipIntegritySeverity = "ERROR" | "WARNING";

export interface RelationshipIntegrityIssue {
  code: RelationshipIntegrityIssueCode;
  severity: RelationshipIntegritySeverity;
  recordType: string;
  recordId: string;
  message: string;
  relationshipRef?: RelationshipRef;
  relatedRecordIds?: string[];
}

export interface RelationshipIntegritySummary {
  checkedRelationshipCount: number;
  checkedRecordCount: number;
  errorCount: number;
  warningCount: number;
  issueCount: number;
  issues: RelationshipIntegrityIssue[];
}

export interface RelationshipContactRecord {
  id: string;
  name?: string;
  fullName?: string;
  email?: string;
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  mobilePhone?: string;
  workPhone?: string;
  organizationAccountId?: string;
}

export interface RelationshipOrganizationRecord {
  id: string;
  workspaceId: string;
  displayName?: string;
  legalName?: string;
  taxCode?: string;
  domain?: string;
  website?: string;
  email?: string;
  phone?: string;
  contactRefs?: Array<{ id: string }>;
  primaryContactId?: string;
}

export interface RelationshipCustomerRecord {
  id: string;
  workspaceId: string;
  customerCode: string;
  relationshipRef: RelationshipRef;
  legacyAliases?: string[];
}

export interface RelationshipCommercialRecord {
  id: string;
  buyerRef: RelationshipRef;
  customerId?: string;
  sourceDealId?: string;
  sourceQuoteId?: string;
}

export interface RelationshipSupportRecord {
  id: string;
  customerId?: string;
  relationshipRef?: RelationshipRef;
  contactId?: string;
  relatedOrderId?: string;
}

export interface RelationshipWorkRecord {
  id: string;
  customerId?: string;
  relationshipRef?: RelationshipRef;
  recordRef?: { recordId: string };
}

export interface RelationshipOrderChildRecord {
  id: string;
  orderId: string;
}

export interface RelationshipShippingRecord {
  id: string;
  workspaceId?: string;
  sourceType: "ORDER" | "RETURN";
  sourceId: string;
}

export interface RelationshipReturnRecord {
  id: string;
  workspaceId?: string;
  orderId: string;
  buyerRef: RelationshipRef;
}

export interface RelationshipIntegritySnapshot {
  workspaceId: string;
  contacts: readonly RelationshipContactRecord[];
  organizations: readonly RelationshipOrganizationRecord[];
  customers: readonly RelationshipCustomerRecord[];
  deals: readonly RelationshipCommercialRecord[];
  quotes: readonly RelationshipCommercialRecord[];
  orders: readonly RelationshipCommercialRecord[];
  paymentObligations: readonly RelationshipOrderChildRecord[];
  paymentTransactions: readonly RelationshipOrderChildRecord[];
  shippingBookings: readonly RelationshipShippingRecord[];
  returns: readonly RelationshipReturnRecord[];
  supportCases: readonly RelationshipSupportRecord[];
  tasks: readonly RelationshipWorkRecord[];
  activities: readonly RelationshipWorkRecord[];
}
