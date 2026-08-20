import React from "react";
import type { Contact } from "../../domain/model/contact.types";
import { normalizeContactCanonicalProfile } from "../../domain/model/contactCanonicalProfile";
import type { CommunicationConsentChannel, CommunicationConsentProfile } from "@/platform/identity";
import { applyContactOrganizationRelationshipProjection, getContactOrganizationRelationships } from "../../domain/model/contactOrganizationRelationships";
import {
  ContactFormModal,
  type ContactFormDraft,
} from "../components/ContactFormModal";

interface ContactEditModalProps {
  isOpen: boolean;
  onClose(): void;
  contact: Contact;
  onSave(updated: Contact): void;
}


function buildManualConsentProfile(contact: Contact, granted: boolean, now: string): CommunicationConsentProfile {
  const decision = granted ? "GRANTED" as const : "UNKNOWN" as const;
  const channels: CommunicationConsentChannel[] = ["CALL", "EMAIL", "SMS", "ZALO"];
  const ledger = [...(contact.consent?.ledger ?? [])];
  for (const channel of channels) {
    if (contact.consent?.current[channel] === decision) continue;
    ledger.push({
      id: `consent_${crypto.randomUUID()}`,
      channel,
      decision,
      source: "CONTACT_EDIT",
      occurredAt: now,
    });
  }
  return {
    current: Object.fromEntries(channels.map((channel) => [channel, decision])),
    ledger,
    lawfulBasis: granted ? "MANUAL_CONTACT_EDIT" : contact.consent?.lawfulBasis,
    updatedAt: now,
  };
}

function toIso(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export const ContactEditModal: React.FC<ContactEditModalProps> = ({ isOpen, onClose, contact, onSave }) => {
  const submit = (draft: ContactFormDraft) => {
    const tags = draft.tagsString
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const now = new Date().toISOString();
    const updated: Contact = {
      ...contact,
      name: draft.name,
      fullName: draft.name,
      contactCode: draft.contactCode || undefined,
      title: draft.title || undefined,
      roleTitle: draft.title || undefined,
      department: draft.department || undefined,
      decisionRole: draft.decisionRole || undefined,
      avatarColor: draft.avatarColor || undefined,
      email: draft.email || undefined,
      workEmail: draft.email || undefined,
      phone: draft.phone || undefined,
      mobilePhone: draft.phone || undefined,
      zaloId: draft.zaloId || undefined,
      zalo: draft.zaloId || undefined,
      address: draft.address || undefined,
      preferredChannel: draft.preferredChannel || undefined,
      communicationConsent: draft.communicationConsent,
      consent: buildManualConsentProfile(contact, draft.communicationConsent, now),
      organizationName: draft.organizationName || undefined,
      companyName: draft.organizationName || undefined,
      relationshipType: draft.relationshipType || undefined,
      isPrimaryContact: draft.isPrimaryContact,
      influenceLevel: draft.influenceLevel,
      source: draft.source || undefined,
      status: draft.status,
      priority: draft.priority,
      ownerId: draft.ownerId || undefined,
      tags: tags.length > 0 ? tags : undefined,
      lastContactedAt: toIso(draft.lastContactedAt),
      nextFollowUpAt: toIso(draft.nextFollowUpAt),
      notes: draft.notes || undefined,
      internalNotes: draft.internalNotes || undefined,
      updatedAt: now,
    };
    onSave(normalizeContactCanonicalProfile(applyContactOrganizationRelationshipProjection(updated, getContactOrganizationRelationships(contact), updated.updatedAt)));
  };

  return <ContactFormModal isOpen={isOpen} onClose={onClose} mode="edit" contact={contact} onSubmit={submit} />;
};
