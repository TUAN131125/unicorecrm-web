import type { CRMActivity } from "@/shared/domain";
import type { MoneyDto } from "@/shared/money";
import type {
  CommunicationConsentChannel,
  CommunicationConsentDecision,
  CommunicationConsentLedgerEntry,
  CommunicationConsentProfile,
  RelationshipRef,
} from "@/platform/identity";
import type { LeadWorkState, QualificationOutcome } from "./leadLifecycle.canonical";


export type LeadConsentChannel = CommunicationConsentChannel;
export type LeadConsentDecision = CommunicationConsentDecision;
export type LeadConsentLedgerEntry = CommunicationConsentLedgerEntry;
export type LeadConsentProfile = CommunicationConsentProfile;

export interface LeadDuplicateResolution {
  status: "PENDING_REVIEW" | "CONFIRMED_DISTINCT" | "MERGED";
  candidateLeadIds: string[];
  matchedOn: Array<"EMAIL" | "PHONE">;
  reviewedAt?: string;
  reviewedBy?: string;
  reason?: string;
  survivorLeadId?: string;
}

export interface LeadInterestedProduct {
  id: string;
  productId: string;
  skuSnapshot?: string;
  productNameSnapshot: string;
  productTypeSnapshot?: string;
  interestLevel: "low" | "medium" | "high";
  estimatedQuantity?: number;
  /** Display-only numeric projection. */
  expectedBudget?: number;
  expectedBudgetMoney?: MoneyDto;
  note?: string;
  createdAt: string;
}

export interface LeadSourceLineageEntry {
  signalId: string;
  source: string;
  occurredAt: string;
  sourceRecordId?: string;
}

export interface Lead {
  id: string;
  name: string;
  title: string;
  companyName: string;
  companyPhone?: string;
  companyType?: string;
  representativeName?: string;
  city?: string;
  email: string;
  phone: string;
  zaloId?: string;
  address?: string;
  source: string;
  sourceLineage?: LeadSourceLineageEntry[];
  campaignId?: string;
  score: number;
  leadWorkState: LeadWorkState;
  qualificationOutcome?: QualificationOutcome;
  relationshipRef?: RelationshipRef;
  dealRef?: string;
  migrationReview?: {
    rule: "LEAD_OUTCOME_REQUIRES_EVIDENCE";
    legacyStatus: "QUALIFIED" | "CONVERTED";
  };
  ownerId: string;
  interestedProducts: LeadInterestedProduct[];
  nextFollowUpAt?: string;
  createdAt: string;
  companySize?: string;
  industry?: string;
  notes?: string;
  activities: CRMActivity[];

  preferredChannel?: string;
  channel?: string;
  utmSource?: string;
  referrer?: string;
  painPoint?: string;
  budgetRange?: string;
  decisionRole?: string;
  purchaseTimeline?: string;
  /** Display-only numeric projection derived from estimatedValue. */
  expectedValue?: number;
  estimatedValue?: MoneyDto;
  resourceVersion?: number;
  activitiesAuthority?: "LOCAL_COMPLETE" | "NOT_INCLUDED";
  qualificationNotes?: string;
  assignedTeam?: string;
  lastContactedAt?: string;
  priority?: "low" | "medium" | "high";
  tags?: string[];
  description?: string;
  internalNotes?: string;
  followUpNote?: string;
  disqualifiedAt?: string;
  disqualifiedBy?: string;
  disqualificationType?: "temporary" | "permanent";
  disqualificationReason?: string;
  disqualificationNote?: string;
  recontactAt?: string;
  recontactNote?: string;
  recontactStatus?: "scheduled" | "due" | "reopened" | "cancelled";
  lastInteractionAt?: string;
  salutation?: string;
  department?: string;
  workPhone?: string;
  otherPhone?: string;
  personalEmail?: string;
  facebook?: string;
  doNotCall?: boolean;
  doNotEmail?: boolean;
  doNotSms?: boolean;
  doNotZalo?: boolean;
  consent?: LeadConsentProfile;
  duplicateResolution?: LeadDuplicateResolution;
  distinctFromLeadIds?: string[];
  mergedLeadIds?: string[];
  mergedIntoLeadId?: string;
  businessType?: string;
  website?: string;
  taxCode?: string;
  companyAddress?: string;
  country?: string;
  province?: string;
  district?: string;
  ward?: string;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
  contactAddress?: string;
  customFields?: Record<string, string | number | boolean | string[]>;
  archivedAt?: string;
  archiveReason?: string;
  anonymizedAt?: string;
  anonymizationReason?: string;
}

export type LeadSource = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type LeadCampaign = {
  id: string;
  name: string;
  sourceId: string;
  budget?: number;
  status: "active" | "paused" | "completed";
  startDate?: string;
  endDate?: string;
  isActive: boolean;
};
