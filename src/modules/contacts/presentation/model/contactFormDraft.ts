import type { Contact, ContactDecisionRole, PreferredContactChannel, ContactStatus } from "../../domain/model/contact.types";

type ContactPriority = NonNullable<Contact["priority"]>;
type InfluenceLevel = NonNullable<Contact["influenceLevel"]>;

export interface ContactFormDraft {
  name: string;
  contactCode: string;
  title: string;
  department: string;
  decisionRole: ContactDecisionRole | "";
  avatarColor: string;
  email: string;
  phone: string;
  zaloId: string;
  address: string;
  preferredChannel: PreferredContactChannel | "";
  communicationConsent: boolean;
  organizationName: string;
  relationshipType: string;
  isPrimaryContact: boolean;
  influenceLevel: InfluenceLevel;
  source: string;
  status: ContactStatus;
  priority: ContactPriority;
  ownerId: string;
  tagsString: string;
  lastContactedAt: string;
  nextFollowUpAt: string;
  notes: string;
  internalNotes: string;
}

