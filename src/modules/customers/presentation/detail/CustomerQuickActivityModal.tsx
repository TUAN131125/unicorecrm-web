import React from "react";
import { RelationshipActivityCreateModal, type RelationshipActivityAction, type RelationshipActivityDraft } from "@/modules/tasks";

export type CustomerQuickAction = RelationshipActivityAction;
export type CustomerQuickActivityDraft = RelationshipActivityDraft;

interface CustomerQuickActivityModalProps {
  targetId?: string;
  action: CustomerQuickAction | null;
  isVi: boolean;
  email?: string;
  phone?: string;
  recordLabel?: string;
  ownerName?: string;
  onClose(): void;
  onSave(draft: CustomerQuickActivityDraft): Promise<boolean>;
}

export const CustomerQuickActivityModal: React.FC<CustomerQuickActivityModalProps> = ({ action, targetId, email, phone, recordLabel, ownerName, onClose, onSave }) => (
  <RelationshipActivityCreateModal targetId={targetId} formId="customers-activity" action={action} email={email} phone={phone} recordLabel={recordLabel} ownerName={ownerName} onClose={onClose} onSave={onSave} />
);
