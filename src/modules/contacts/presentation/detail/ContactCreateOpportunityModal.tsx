import React from "react";
import type { Contact } from "../../domain/model/contact.types";
import { CAPABILITIES } from "@/platform/access-control";
import { useRecordOwnershipContext } from "@/platform/record-ownership";
import { useI18n } from "@/i18n";
import { getProductCatalogSnapshot, type SelectedPickerItem } from "@/modules/products";
import { DealFormModal, getDealStagesSnapshot, type DealFormDraft } from "@/modules/deals";
import { getCustomerDisplayNameForContact } from "../model/contactCustomerLookup";

interface ContactCreateOpportunityModalProps {
  isOpen: boolean;
  onClose(): void;
  contact: Contact;
  onSave(dealData: {
    name: string;
    amount: number;
    productId: string;
    ownerId: string;
    source: string;
    pipeline: string;
    stage: string;
    currency: string;
    probability: number;
    expectedCloseDate: string;
    priority: string;
    opportunityType: string;
    demandSummary: string;
    painPoints: string;
    decisionRole: string;
    buyingReadiness: string;
    expectedBudget: number;
    nextAction: string;
    nextFollowUpDate: string;
    createFollowUpTask: boolean;
    note: string;
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

export const ContactCreateOpportunityModal: React.FC<ContactCreateOpportunityModalProps> = ({ isOpen, onClose, contact, onSave }) => {
  const { tx } = useI18n();
  const ownership = useRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN);
  const owners = ownership?.assignableOwners || [];
  const stages = React.useMemo(() => getDealStagesSnapshot(), [contact.id]);
  const initialValues = React.useMemo<Partial<DealFormDraft>>(() => {
    const ownerId = contact.ownerId && owners.some((owner) => owner.memberId === contact.ownerId)
      ? contact.ownerId
      : (ownership?.memberId || owners[0]?.memberId || "");
    const label = getCustomerDisplayNameForContact(contact) || contact.organizationName || contact.companyName || contact.name;
    return {
      name: tx("contactDetail.forms.oppDefaultName", `Cơ hội - ${contact.fullName || contact.name}`),
      customerName: label,
      ownerId,
      source: contact.source || "Direct",
      priority: contact.priority || "MEDIUM",
      demandSummary: contact.needSummary || contact.notes || "",
      painPoints: contact.painPoint || "",
      createFollowUpTask: false,
      lineItems: initialLineItems(contact),
    };
  }, [contact, owners, ownership?.memberId, tx]);

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
      onSubmit={(draft) => onSave({
        name: draft.name,
        amount: draft.amount,
        productId: draft.lineItems[0]?.product.id || "",
        ownerId: draft.ownerId,
        source: draft.source,
        pipeline: draft.pipeline,
        stage: draft.stage,
        currency: draft.currency,
        probability: draft.probability,
        expectedCloseDate: draft.expectedCloseDate,
        priority: draft.priority,
        opportunityType: draft.opportunityType,
        demandSummary: draft.demandSummary,
        painPoints: draft.painPoints,
        decisionRole: contact.decisionRole || "influencer",
        buyingReadiness: contact.relationshipLevel === "strong" || contact.relationshipLevel === "vip" ? "hot" : "warm",
        expectedBudget: draft.expectedBudget || draft.amount,
        nextAction: draft.nextActionSummary,
        nextFollowUpDate: draft.nextActionAt,
        createFollowUpTask: draft.createFollowUpTask,
        note: draft.notes,
        lineItems: draft.lineItems,
      })}
    />
  );
};
