import React from "react";
import { formatApplicationError } from "@/shared/operations";
import { recordOperationalAudit } from "@/platform/operational-audit";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createPostalAddressFromLine } from "@/platform/identity";
import { createOrganizationViaApi, isOrganizationConnectedMode, type OrganizationAccount } from "../../public/api";
import { createOrganizationWithRepresentativeWorkflow } from "@/workflows/contact-organization-relationship";
import {
  OrganizationAccountFormModal,
  type OrganizationAccountFormDraft,
} from "../components/OrganizationAccountFormModal";

interface OrganizationCreateModalProps {
  isOpen: boolean;
  onClose(): void;
  actorId: string;
  onCreated(account: OrganizationAccount): void;
}

export const OrganizationCreateModal: React.FC<OrganizationCreateModalProps> = ({
  isOpen,
  onClose,
  actorId,
  onCreated,
}) => {
  const workspace = useWorkspaceContextSnapshot();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  const submit = async (draft: OrganizationAccountFormDraft) => {
    setError(null);
    try {
      if (isOrganizationConnectedMode()) {
        const organization = await createOrganizationViaApi({
          displayName: draft.displayName, legalName: draft.legalName.trim() || undefined,
          taxCode: draft.taxCode.trim() || undefined, industry: draft.industry.trim() || undefined,
          sizeBand: draft.sizeBand || undefined, website: draft.website.trim() || undefined,
          domain: draft.domain || undefined, phone: draft.phone.trim() || undefined,
          email: draft.email.trim() || undefined, address: draft.address.trim() || undefined,
          source: draft.source.trim() || "manual", relationshipLevel: draft.relationshipLevel,
          notes: draft.notes.trim() || undefined, status: draft.status === "archived" ? undefined : draft.status,
        });
        onCreated(organization);
        onClose();
        return;
      }
      const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const organizationId = `org_${suffix}`;
      const contactId = `contact_${suffix}`;
      const now = new Date().toISOString();
      const representativeRole = draft.representativeRole.trim() || "Người đại diện";

      const account: OrganizationAccount = {
        id: organizationId,
        workspaceId: workspace.workspaceId,
        displayName: draft.displayName,
        legalName: draft.legalName.trim() || draft.displayName,
        taxCode: draft.taxCode.trim() || undefined,
        industry: draft.industry.trim() || undefined,
        sizeBand: draft.sizeBand || undefined,
        website: draft.website.trim() || undefined,
        domain: draft.domain || undefined,
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        address: draft.address.trim() || undefined,
        addressDetails: createPostalAddressFromLine(draft.address),
        source: draft.source.trim() || "manual",
        ownerId: actorId,
        tags: ["B2B"],
        status: draft.status,
        relationshipLevel: draft.relationshipLevel,
        notes: draft.notes.trim() || undefined,
        primaryContactId: contactId,
        contactRefs: [{ type: "CONTACT", id: contactId }],
        createdAt: now,
        updatedAt: now,
      };

      const representative: Contact = {
        id: contactId,
        name: draft.representativeName.trim(),
        fullName: draft.representativeName.trim(),
        contactCode: `CN-${String(Date.now()).slice(-6)}`,
        roleTitle: representativeRole,
        title: representativeRole,
        roleAtCompany: representativeRole,
        department: draft.representativeDepartment.trim() || undefined,
        phone: draft.representativePhone.trim() || undefined,
        mobilePhone: draft.representativePhone.trim() || undefined,
        email: draft.representativeEmail.trim() || undefined,
        workEmail: draft.representativeEmail.trim() || undefined,
        organizationAccountId: organizationId,
        organizationName: draft.displayName,
        companyName: draft.displayName,
        ownerId: actorId,
        source: draft.source.trim() || "manual",
        tags: ["B2B representative"],
        isPrimaryContact: true,
        decisionRole: "decision_maker",
        relationshipLevel: "warm",
        status: "active",
        createdFrom: "manual",
        createdAt: now,
        updatedAt: now,
      };

      const created = createOrganizationWithRepresentativeWorkflow({
        organization: account,
        representative,
        relationship: {
          organizationAccountId: account.id,
          role: "decision_maker",
          roleTitle: representativeRole,
          department: draft.representativeDepartment.trim() || undefined,
          decisionRole: "decision_maker",
          isPrimaryRepresentative: true,
          effectiveFrom: now,
        },
        actorId,
        now,
      });
      recordOperationalAudit({
        moduleKey: "organizations",
        recordId: account.id,
        action: "OrganizationCreatedWithPrimaryRepresentative",
        actorId,
        actorName: "CRM Operator",
        after: { organization: created.organization, primaryContactId: created.contact.id },
      });
      onCreated(created.organization);
      onClose();
    } catch (caught) {
      setError(formatApplicationError(caught));
    }
  };

  return (
    <OrganizationAccountFormModal
      isOpen={isOpen}
      onClose={onClose}
      mode="create"
      onSubmit={submit}
      error={error}
    />
  );
};
