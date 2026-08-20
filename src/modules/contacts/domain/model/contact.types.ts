import type { CRMActivity } from "@/shared/domain";
import type { CommunicationConsentProfile, PostalAddress } from "@/platform/identity";

export type ContactStatus =
  | "active"
  | "needs_follow_up"
  | "in_consulting"
  | "has_open_opportunity"
  | "inactive"
  | "do_not_contact"
  | "archived";

export type ContactDecisionRole =
  | "decision_maker"
  | "influencer"
  | "user"
  | "buyer"
  | "technical"
  | "finance"
  | "other";

export type ContactRelationshipLevel =
  | "cold"
  | "warm"
  | "good"
  | "strong"
  | "vip";


export type ContactOrganizationRelationshipRole =
  | "employee"
  | "executive"
  | "decision_maker"
  | "buyer"
  | "finance"
  | "technical"
  | "advisor"
  | "partner"
  | "other";

export interface ContactOrganizationRelationship {
  id: string;
  organizationAccountId: string;
  role: ContactOrganizationRelationshipRole;
  roleTitle?: string;
  department?: string;
  decisionRole?: ContactDecisionRole;
  isPrimaryRepresentative: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  endedReason?: string;
}



export type PreferredContactChannel =
  | "phone"
  | "email"
  | "zalo"
  | "facebook"
  | "sms";

export interface Contact {
  id: string;
  /** Canonical tenant owner; legacy snapshots are hydrated on repository save/read. */
  workspaceId?: string;
  name: string; // for backward compatibility
  title?: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  zaloId?: string;
  address?: string;
  addressDetails?: PostalAddress;
  avatarUrl?: string;

  contactCode?: string;
  fullName: string;
  /** Compatibility projection of the primary active organization relationship. */
  organizationAccountId?: string;
  /** Canonical many-to-many organization memberships. */
  organizationRelationships?: ContactOrganizationRelationship[];
  department?: string;
  source?: string;
  ownerId?: string;
  tags?: string[];
  activities?: CRMActivity[];
  createdAt: string;
  
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  leadId?: string;
  notes?: string;

  // New detailed relationship, sales & communication fields
  decisionRole?: ContactDecisionRole;
  avatarColor?: string;
  preferredChannel?: string;
  communicationConsent?: boolean;
  /** Canonical per-channel consent history. */
  consent?: CommunicationConsentProfile;
  relationshipType?: string;
  isPrimaryContact?: boolean;
  influenceLevel?: "low" | "medium" | "high";
  internalNotes?: string;

  // Normalized business model fields
  code?: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;

  // Contact channels
  mobilePhone?: string;
  workPhone?: string;
  otherPhone?: string;
  workEmail?: string;
  personalEmail?: string;
  zalo?: string;
  facebook?: string;
  preferredContactChannel?: PreferredContactChannel;

  // Contact restrictions
  doNotCall?: boolean;
  doNotEmail?: boolean;
  doNotSms?: boolean;
  doNotZalo?: boolean;
  doNotContact?: boolean;
  doNotContactReason?: string;

  // Linked organization/customer
  companyName?: string;
  organizationName?: string;
  roleAtCompany?: string;
  relationshipLevel?: ContactRelationshipLevel;

  // Sales nurturing
  status: ContactStatus;
  teamId?: string;
  campaignId?: string;
  interestedProducts?: string[];
  painPoint?: string;
  needSummary?: string;
  consultingNote?: string;
  lastInteractionAt?: string;
  followUpNote?: string;

  // Opportunity/customer transition
  relatedOpportunityIds?: string[];
  openOpportunityCount?: number;
  wonOpportunityId?: string;

  // Lead source
  convertedFromLeadId?: string;
  createdFrom?: "manual" | "lead_conversion" | "lead_qualification" | "import" | "customer" | "campaign";

  // System info
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  archivedAt?: string;
  archiveReason?: string;
  anonymizedAt?: string;
  anonymizationReason?: string;
  /** Authoritative optimistic-concurrency version from the backend projection. */
  resourceVersion?: number;
}

