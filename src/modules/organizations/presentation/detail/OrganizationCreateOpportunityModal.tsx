import React from "react";
import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getDirtyUnsavedWork } from "@/platform/unsaved-work";
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
import { ensureDealNextActionTask, isWorkActivationUnavailable } from "@/workflows/work-activation";
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
  const workspace = useWorkspaceContextSnapshot();
  const opening = React.useRef({ workspaceId: workspace.workspaceId, account: structuredClone(account), primaryContact: primaryContact ? structuredClone(primaryContact) : undefined, linkedCustomerId });
  const wasOpen = React.useRef(false);
  const cycle = React.useRef(0);
  React.useEffect(() => {
    if (isOpen && !wasOpen.current) { cycle.current += 1; opening.current = { workspaceId: workspace.workspaceId, account: structuredClone(account), primaryContact: primaryContact ? structuredClone(primaryContact) : undefined, linkedCustomerId }; }
    if (!isOpen && wasOpen.current) cycle.current += 1;
    wasOpen.current = isOpen;
  }, [isOpen, account, primaryContact, linkedCustomerId, workspace.workspaceId]);
  const { locale } = useI18n();
  React.useEffect(() => {
    if (isOpen && (account.id !== opening.current.account.id || workspace.workspaceId !== opening.current.workspaceId) && !getDirtyUnsavedWork().some(entry => entry.id.startsWith("deal-form:"))) onClose();
  }, [isOpen, account.id, onClose, workspace.workspaceId]);
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

  const submit = async (draft: DealFormDraft, _openingDeal: Deal | null, intentId: string) => {
    if (opening.current.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false;
    const commandWorkspace = opening.current.workspaceId;
    const activeCycle = cycle.current;
    const { account, primaryContact, linkedCustomerId } = opening.current;
    const now = new Date().toISOString();
    const dealId = createDurableId("deal");
    const lineItems = mapSelectedPickerItemsToDealLineItems(draft.lineItems);
    const nextActionAt = draft.createFollowUpTask && draft.nextActionAt
      ? new Date(draft.nextActionAt).toISOString()
      : undefined;
    // WF-21 work-activation is BLOCKED with `connectedFrontendCoordinatorAllowed: false`.
    // Refuse the combined intent before the Deal command rather than committing the Deal
    // and then reporting that the requested follow-up work could not be activated.
    if (nextActionAt && isWorkActivationUnavailable()) {
      notifyProduct(
        locale === "vi"
          ? "Chưa thể tạo cơ hội kèm công việc kế tiếp: máy chủ chưa hỗ trợ kích hoạt công việc. Hãy bỏ chọn công việc theo dõi để chỉ tạo cơ hội."
          : "An opportunity with a follow-up task cannot be created yet: work activation is not supported by the server. Clear the follow-up task to create the opportunity only.",
        "warning",
      );
      return false;
    }
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
      // No Task reference is available before the Deal commits: Task ids are
      // server-assigned and `ensureDealNextActionTask` runs after this command.
      ...(nextActionAt ? {
        nextActionAt,
        nextActionSummary: draft.nextActionSummary,
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
    }, { idempotencyKey: intentId })).data;
    // Separate authoritative command; WF-21 has no atomic Deal+Task workflow. The Deal
    // is already committed, so a Task failure is a partial outcome, not total failure.
    if (nextActionAt) {
      try {
        await ensureDealNextActionTask(deal);
      } catch (error) {
        notifyProduct(locale === "vi"
          ? `Đã tạo cơ hội "${deal.name}". Chưa tạo được công việc kế tiếp: ${formatApplicationError(error, { locale })}`
          : `Opportunity "${deal.name}" was created. Its next-action Task was not created: ${formatApplicationError(error, { locale })}`, "danger");
        if (wasOpen.current && cycle.current === activeCycle && commandWorkspace === getWorkspaceContextSnapshot().workspaceId) onCreated(deal);
        return true;
      }
    }
    if (wasOpen.current && cycle.current === activeCycle && commandWorkspace === getWorkspaceContextSnapshot().workspaceId) onCreated(deal);
    return true;
  };

  return (
    <DealFormModal
      isOpen={isOpen}
      onClose={onClose}
      mode="create"
      sourceKey={isOpen && !wasOpen.current ? account.id : opening.current.account.id}
      initialValues={initialValues}
      owners={owners}
      stages={stages}
      canAssign={ownership?.canAssign}
      customerNameLocked
      onSubmit={submit}
    />
  );
}
