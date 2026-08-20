import type { RelationshipRef } from "@/platform/identity";

export type RelationshipResolutionKind = "CONTACT" | "ORGANIZATION_ACCOUNT";
export type RelationshipResolutionMode = "NEW" | "EXISTING";

export interface LeadRelationshipInput {
  kind: RelationshipResolutionKind;
  mode: RelationshipResolutionMode;
  selectedId?: string;
  contact: {
    name: string;
    email?: string;
    phone?: string;
    title?: string;
  };
  organization?: {
    displayName: string;
    legalName?: string;
    taxCode?: string;
    domain?: string;
    phone?: string;
    email?: string;
    address?: string;
    industry?: string;
  };
}

export interface ResolvedLeadRelationship {
  relationshipRef: RelationshipRef;
  displayName: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactTitle?: string;
  contactAddress?: string;
  organizationAccountId?: string;
  organizationName?: string;
  organizationAddress?: string;
}

export interface ExecuteLeadNurtureCommand {
  leadId: string;
  relationship: LeadRelationshipInput;
  revisitAt: string;
  reason: string;
  note?: string;
  ownerId?: string;
  now?: Date;
  idSeed?: string;
}

export interface ExecuteLeadOpportunityCommand {
  leadId: string;
  relationship: LeadRelationshipInput;
  deal: {
    name: string;
    needSummary?: string;
    ownerId: string;
    expectedCloseDate?: string;
    interestedProductIds: string[];
    estimatedValue?: number;
    decisionProcess?: string;
    buyingWindow?: string;
    followUpTask?: {
      title: string;
      dueAt: string;
      description?: string;
    };
  };
  dealsEnabled: boolean;
  currency: string;
  now?: Date;
  idSeed?: string;
}

export interface DirectSaleLineItemInput {
  productId: string;
  name: string;
  sku?: string;
  productType?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxMode?: "exclusive" | "inclusive" | "none";
  billingCycle?: string;
}

export interface ExecuteLeadDirectSaleCommand {
  leadId: string;
  relationship: LeadRelationshipInput;
  path: "QUOTE" | "ORDER";
  lineItems: DirectSaleLineItemInput[];
  quoteEnabled: boolean;
  orderEnabled: boolean;
  actorCanSellNow: boolean;
  currency: string;
  title?: string;
  ownerId?: string;
  now?: Date;
  idSeed?: string;
}

export interface LeadQualificationResult {
  leadId: string;
  relationshipRef: RelationshipRef;
  contactId?: string;
  organizationAccountId?: string;
  taskId?: string;
  dealId?: string;
  quoteId?: string;
  orderId?: string;
}
