import React from "react";
import { RelationshipActivityCreateModal, type RelationshipActivityAction, type RelationshipActivityDraft } from "@/modules/tasks";

export type OrganizationQuickAction = RelationshipActivityAction;
export type OrganizationQuickActivityDraft = RelationshipActivityDraft;

interface OrganizationQuickActivityModalProps {
  targetId?: string;
  action: OrganizationQuickAction | null;
  email?: string;
  phone?: string;
  recordLabel?: string;
  ownerName?: string;
  onClose(): void;
  onSave(draft: OrganizationQuickActivityDraft): Promise<boolean>;
}

export const OrganizationQuickActivityModal: React.FC<OrganizationQuickActivityModalProps> = ({ action, targetId, email, phone, recordLabel, ownerName, onClose, onSave }) => (
  <RelationshipActivityCreateModal targetId={targetId} formId="organizations-activity" action={action} email={email} phone={phone} recordLabel={recordLabel} ownerName={ownerName} onClose={onClose} onSave={onSave} />
);
