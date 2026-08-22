import React from "react";
import { CAPABILITIES } from "@/platform/access-control";
import { useRecordOwnershipContext } from "@/platform/record-ownership";
import { useI18n } from "@/i18n";
import {
  createDealCommand,
  DealFormModal,
  getDealStagesSnapshot,
  mapSelectedPickerItemsToDealLineItems,
  type Deal,
  type DealFormDraft,
} from "@/modules/deals";
import { createDurableId } from "@/shared/ids";
import { formatApplicationError } from "@/shared/operations";
import { notifyProduct } from "@/components/feedback/ProductDialogService";
import { ensureDealNextActionTask, getDealNextActionTaskId } from "@/workflows/work-activation";
import type { Contact } from "@/modules/contacts";
import type { OrganizationAccount } from "../../public/api";

interface OrganizationCreateOpportunityModalProps {
  isOpen: boolean;
  account: OrganizationAccount;
  primaryContact?: Contact;
  linkedCustomerId?: string;
  actorName: string;
  onClose(): void;
  onCreated(deal: Deal): void;
}

export function OrganizationCreateOpportunityModal({
  isOpen,
  account,
  primaryContact,
  linkedCustomerId,
  actorName,
  onClose,
  onCreated,
}: OrganizationCreateOpportunityModalProps) {
  const { locale } = useI18n();
  const ownership = useRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN);
  const owners = ownership?.assignableOwners ?? [];
  const stages = React.useMemo(() => getDealStagesSnapshot(), [account.id]);
  const initialValues = React.useMemo<Partial<DealFormDraft>>(() => ({
    name: locale === "vi" ? `Cơ hội - ${account.displayName}` : `Opportunity - ${account.displayName}`,
    customerName: account.displayName,
    ownerId: account.ownerId && owners.some((owner) => owner.memberId === account.ownerId)
      ? account.ownerId
      : (ownership?.memberId || owners[0]?.memberId || ""),
    source: account.source || "Organization Detail",
    demandSummary: account.notes || "",
  }), [account, locale, owners, ownership?.memberId]);

  const submit = async (draft: DealFormDraft) => {
    const now = new Date().toISOString();
    const dealId = createDurableId("deal");
    const lineItems = mapSelectedPickerItemsToDealLineItems(draft.lineItems);
    const nextActionAt = draft.createFollowUpTask && draft.nextActionAt
      ? new Date(draft.nextActionAt).toISOString()
      : undefined;
    const nextActionTaskId = nextActionAt ? getDealNextActionTaskId(dealId, nextActionAt) : undefined;
    const deal = (await createDealCommand({
      id: dealId,
      name: draft.name,
      buyerRef: { type: "ORGANIZATION_ACCOUNT", id: account.id },
      customerId: linkedCustomerId,
      customerName: account.displayName,
      organizationAccountId: account.id,
      organizationAccountName: account.displayName,
      contactId: primaryContact?.id,
      contactName: primaryContact?.fullName || primaryContact?.name,
      contactTitle: primaryContact?.roleTitle || primaryContact?.title,
      contactEmail: primaryContact?.workEmail || primaryContact?.email || primaryContact?.personalEmail || account.email,
      contactPhone: primaryContact?.mobilePhone || primaryContact?.phone || primaryContact?.workPhone || account.phone,
      stage: draft.stage,
      amount: draft.amount,
      currency: draft.currency,
      opportunityScore: draft.probability,
      ownerId: draft.ownerId,
      expectedCloseDate: draft.expectedCloseDate,
      forecastCategory: draft.forecastCategory,
      stageEnteredAt: now,
      createdAt: now,
      updatedAt: now,
      interestedProducts: draft.lineItems.map((item) => item.product.id),
      lineItems,
      ...(nextActionAt && nextActionTaskId ? {
        nextActionAt,
        nextActionSummary: draft.nextActionSummary,
        nextActionRef: { type: "TASK" as const, id: nextActionTaskId },
      } : {}),
      notes: [draft.demandSummary, draft.painPoints, draft.notes].filter(Boolean).join(" · ") || undefined,
      address: account.address,
      activities: [{
        id: createDurableId("deal_activity"),
        type: "system",
        title: locale === "vi" ? "Tạo cơ hội từ tổ chức" : "Opportunity created from organization",
        description: account.displayName,
        createdAt: now,
        author: actorName,
      }],
    })).data;
    // Separate authoritative command; WF-21 has no atomic Deal+Task workflow. The Deal
    // is already committed, so a Task failure is a partial outcome, not total failure.
    if (nextActionAt) {
      try {
        await ensureDealNextActionTask(deal);
      } catch (error) {
        notifyProduct(locale === "vi"
          ? `Đã tạo cơ hội "${deal.name}". Chưa tạo được công việc kế tiếp: ${formatApplicationError(error, { locale })}`
          : `Opportunity "${deal.name}" was created. Its next-action Task was not created: ${formatApplicationError(error, { locale })}`, "danger");
        onCreated(deal);
        return;
      }
    }
    onCreated(deal);
  };

  return (
    <DealFormModal
      isOpen={isOpen}
      onClose={onClose}
      mode="create"
      initialValues={initialValues}
      owners={owners}
      stages={stages}
      canAssign={ownership?.canAssign}
      customerNameLocked
      onSubmit={submit}
    />
  );
}
