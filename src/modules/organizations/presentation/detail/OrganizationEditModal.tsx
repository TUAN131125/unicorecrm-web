import React from "react";
import type { Contact } from "@/modules/contacts";
import { recordOperationalAudit } from "@/platform/operational-audit";
import {
  saveOrganizationAccountSnapshot,
  isOrganizationConnectedMode,
  updateOrganizationViaApi,
  type OrganizationAccount,
} from "../../public/api";
import {
  OrganizationAccountFormModal,
  type OrganizationAccountFormDraft,
} from "../components/OrganizationAccountFormModal";

interface OrganizationEditModalProps {
  isOpen: boolean;
  onClose(): void;
  account: OrganizationAccount;
  representatives: Contact[];
  actorId: string;
  onSaved(account: OrganizationAccount): void;
}

export const OrganizationEditModal: React.FC<OrganizationEditModalProps> = ({
  isOpen,
  onClose,
  account,
  representatives,
  actorId,
  onSaved,
}) => {
  const submit = async (draft: OrganizationAccountFormDraft, opening: OrganizationAccount | undefined, isCurrent: () => boolean, intentId: string) => {
    if (!opening) throw new Error("ORGANIZATION_TARGET_REQUIRED");
    const account = opening;
    try {
      if (isOrganizationConnectedMode()) {
        if (account.resourceVersion === undefined) throw new Error("ORGANIZATION_VERSION_REQUIRED");
        const updated = await updateOrganizationViaApi({ organizationId: account.id, expectedVersion: account.resourceVersion,
          displayName: draft.displayName, legalName: draft.legalName.trim(), taxCode: draft.taxCode.trim(),
          industry: draft.industry.trim(), sizeBand: draft.sizeBand.trim(),
          website: draft.website.trim(), domain: draft.domain, phone: draft.phone.trim(),
          email: draft.email.trim() || undefined, address: draft.address.trim(), source: draft.source.trim(),
          status: draft.status === "archived" ? undefined : draft.status, relationshipLevel: draft.relationshipLevel, notes: draft.notes.trim() }, { idempotencyKey: intentId });
        if (isCurrent()) { onSaved(updated); } return;
      }
      const next: OrganizationAccount = {
        ...account,
        displayName: draft.displayName,
        legalName: draft.legalName.trim() || undefined,
        taxCode: draft.taxCode.trim() || undefined,
        industry: draft.industry.trim() || undefined,
        sizeBand: draft.sizeBand.trim() || undefined,
        website: draft.website.trim() || undefined,
        domain: draft.domain || undefined,
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        address: draft.address.trim() || undefined,
        source: draft.source.trim() || undefined,
        status: draft.status,
        relationshipLevel: draft.relationshipLevel,
        primaryContactId: draft.primaryContactId || undefined,
        notes: draft.notes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      saveOrganizationAccountSnapshot(next);
      recordOperationalAudit({
        moduleKey: "organizations",
        recordId: account.id,
        action: "OrganizationUpdated",
        actorId,
        actorName: "CRM Operator",
        before: account,
        after: next,
      });
      if (isCurrent()) { onSaved(next); }
    } catch (caught) {
      throw caught;
    }
  };

  return (
    <OrganizationAccountFormModal
      isOpen={isOpen}
      onClose={onClose}
      mode="edit"
      connected={isOrganizationConnectedMode()}
      account={account}
      representatives={representatives}
      onSubmit={submit}
    />
  );
};
