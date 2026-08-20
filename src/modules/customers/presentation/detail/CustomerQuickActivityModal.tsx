import React from "react";
import { RelationshipActivityCreateModal, type RelationshipActivityAction, type RelationshipActivityDraft } from "@/modules/tasks";

export type CustomerQuickAction = RelationshipActivityAction;
export type CustomerQuickActivityDraft = RelationshipActivityDraft;

interface CustomerQuickActivityModalProps {
  action: CustomerQuickAction | null;
  isVi: boolean;
  email?: string;
  phone?: string;
  recordLabel?: string;
  ownerName?: string;
  onClose(): void;
  onSave(draft: CustomerQuickActivityDraft): void;
}

export const CustomerQuickActivityModal: React.FC<CustomerQuickActivityModalProps> = ({ action, email, phone, recordLabel, ownerName, onClose, onSave }) => (
  <RelationshipActivityCreateModal action={action} email={email} phone={phone} recordLabel={recordLabel} ownerName={ownerName} onClose={onClose} onSave={onSave} />
);
