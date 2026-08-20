import React from "react";
import type { Contact } from "../../domain/model/contact.types";
import { CAPABILITIES } from "@/platform/access-control";
import { useRecordOwnershipContext } from "@/platform/record-ownership";
import { useI18n } from "@/i18n";
import { getProductCatalogSnapshot, type SelectedPickerItem } from "@/modules/products";
import { DealFormModal, getDealStagesSnapshot, type DealFormDraft } from "@/modules/deals";
import { getCustomerDisplayNameForContact } from "../model/contactCustomerLookup";

interface ContactOpportunityModalProps {
  contact: Contact | null;
  onClose(): void;
  onConfirm(opportunityData: {
    dealName: string;
    dealAmount: number;
    dealOwnerId: string;
    expectedCloseDate: string;
    selectedProductId: string;
    demandSummary: string;
    createFollowUpTask: boolean;
    followUpTaskTitle: string;
    followUpTaskDueAt: string;
    lineItems?: unknown[];
  }): void;
}

function initialLineItems(contact: Contact): SelectedPickerItem[] {
  const catalog = getProductCatalogSnapshot();
  return (contact.interestedProducts || []).flatMap((productId) => {
    const product = catalog.find((candidate) => candidate.id === productId);
    if (!product) return [];
    return [{
      product,
      quantity: 1,
      discountPercent: 0,
      customPrice: product.listPrice,
      billingCycle: product.billingCycle || "one_time",
      taxMode: product.taxMode || "none",
      configuration: {},
    }];
  });
}

export const ContactOpportunityModal: React.FC<ContactOpportunityModalProps> = ({ contact, onClose, onConfirm }) => {
  const { t } = useI18n();
  const ownership = useRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN);
  const stages = React.useMemo(() => getDealStagesSnapshot(), [contact?.id]);
  const owners = ownership?.assignableOwners || [];

  const initialValues = React.useMemo<Partial<DealFormDraft> | undefined>(() => {
    if (!contact) return undefined;
    const ownerId = contact.ownerId && owners.some((owner) => owner.memberId === contact.ownerId)
      ? contact.ownerId
      : (ownership?.memberId || owners[0]?.memberId || "");
    const label = getCustomerDisplayNameForContact(contact) || contact.organizationName || contact.companyName || contact.name;
    return {
      name: t("contactList.modal.opportunityNameDefaultWithParam", { name: contact.name }),
      customerName: label,
      ownerId,
      priority: contact.priority || "MEDIUM",
      source: contact.source || "Direct",
      demandSummary: contact.needSummary || contact.notes || "",
      painPoints: contact.painPoint || "",
      createFollowUpTask: false,
      lineItems: initialLineItems(contact),
    };
  }, [contact, owners, ownership?.memberId, t]);

  if (!contact || !initialValues) return null;
  return (
    <DealFormModal
      isOpen
      onClose={onClose}
      mode="create"
      initialValues={initialValues}
      owners={owners}
      stages={stages}
      canAssign={ownership?.canAssign}
      customerNameLocked
      onSubmit={(draft) => onConfirm({
        dealName: draft.name,
        dealAmount: draft.amount,
        dealOwnerId: draft.ownerId,
        expectedCloseDate: draft.expectedCloseDate,
        selectedProductId: draft.lineItems[0]?.product.id || "",
        demandSummary: draft.demandSummary,
        createFollowUpTask: draft.createFollowUpTask,
        followUpTaskTitle: draft.nextActionSummary,
        followUpTaskDueAt: draft.nextActionAt,
        lineItems: draft.lineItems,
      })}
    />
  );
};
