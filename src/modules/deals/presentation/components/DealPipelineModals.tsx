import { getProductCatalogSnapshot, type SelectedPickerItem } from "@/modules/products";
import { useDealPipelineController } from "../hooks/useDealPipelineController";
import { DealFormModal, type DealFormDraft } from "./DealFormModal";

function toSelectedPickerItems(deal: {
  lineItems: Array<{
    productId: string;
    quantity: number;
    discountPercent: number;
    unitPriceSnapshot?: number;
    unitPrice?: number;
    billingCycleSnapshot?: string;
    taxModeSnapshot?: "exclusive" | "inclusive" | "none";
  }>;
}): SelectedPickerItem[] {
  const catalog = getProductCatalogSnapshot();
  return deal.lineItems.flatMap((line) => {
    const product = catalog.find((candidate) => candidate.id === line.productId);
    if (!product) return [];
    return [{
      product,
      quantity: line.quantity,
      discountPercent: line.discountPercent,
      customPrice: line.unitPriceSnapshot ?? line.unitPrice ?? product.listPrice,
      billingCycle: (line.billingCycleSnapshot || product.billingCycle || "one_time") as SelectedPickerItem["billingCycle"],
      taxMode: line.taxModeSnapshot || product.taxMode || "none",
      configuration: {},
    }];
  });
}

interface DealPipelineModalsProps {
  controller: ReturnType<typeof useDealPipelineController>;
}

export function DealPipelineModals({ controller }: DealPipelineModalsProps) {
  const {
    ownership,
    isAddModalOpen,
    setIsAddModalOpen,
    newDealName,
    newCustomerName,
    newAmount,
    newCloseDate,
    newOwnerId,
    newNextActionAt,
    newNextActionSummary,
    newForecastCategory,
    stageConfigs,
    newDealStage,
    newOpportunityScore,
    newNotes,
    isEditModalOpen,
    setIsEditModalOpen,
    editingDeal,
    setEditingDeal,
    handleAddDealSubmit,
    handleEditDealSubmit,
  } = controller;

  return (
    <>
      <DealFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        mode="create"
        initialValues={{
          name: newDealName,
          customerName: newCustomerName,
          amount: Number(newAmount) || 0,
          ownerId: newOwnerId,
          expectedCloseDate: newCloseDate,
          stage: newDealStage,
          probability: Number(newOpportunityScore) || 40,
          forecastCategory: newForecastCategory,
          nextActionAt: newNextActionAt,
          nextActionSummary: newNextActionSummary,
          notes: newNotes,
        }}
        owners={ownership?.assignableOwners || []}
        stages={stageConfigs}
        canAssign={ownership?.canAssign}
        onSubmit={(draft: DealFormDraft) => { void handleAddDealSubmit(draft); }}
      />

      <DealFormModal
        isOpen={isEditModalOpen && Boolean(editingDeal)}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingDeal(null);
        }}
        mode="edit"
        initialValues={editingDeal ? {
          name: editingDeal.name,
          customerName: editingDeal.customerName || editingDeal.organizationAccountName || editingDeal.contactName || "",
          amount: editingDeal.amount,
          ownerId: editingDeal.ownerId,
          expectedCloseDate: editingDeal.expectedCloseDate,
          stage: editingDeal.stage,
          probability: editingDeal.opportunityScore,
          forecastCategory: editingDeal.forecastCategory || "PIPELINE",
          nextActionAt: editingDeal.nextActionAt,
          nextActionSummary: editingDeal.nextActionSummary || "",
          notes: editingDeal.notes || "",
          lineItems: toSelectedPickerItems(editingDeal),
        } : undefined}
        owners={ownership?.assignableOwners || []}
        stages={stageConfigs}
        canAssign={ownership?.canAssign}
        customerNameLocked
        onSubmit={(draft: DealFormDraft) => { void handleEditDealSubmit(draft); }}
      />
    </>
  );
}
