import { useMemo } from "react";
import type { BuyerRef } from "@/platform/identity";
import { useRecordOwnershipContext } from "@/platform/record-ownership";
import { CAPABILITIES } from "@/platform/access-control";
import { invalidateModuleQueries } from "@/shared/application";
import { createDealCommand, getDealStagesSnapshot, isDealConnectedMode } from "../../public/deals";
import { DealFormModal, type DealFormDraft } from "./DealFormModal";

/** A single Deal command, independent of WF-01/WF-04's multi-owner mutations. */
export function BuyerDealForm({ buyer, label, open, onClose, onCreated }: {
  buyer: BuyerRef; label: string; open: boolean; onClose(): void; onCreated(id: string): void;
}) {
  const ownership = useRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN);
  const initial = useMemo<Partial<DealFormDraft>>(() => ({ buyerRef: buyer, customerName: label,
    ownerId: ownership?.memberId || "", createFollowUpTask: false, interestedProductIds: [], lineItems: [] }), [buyer.type, buyer.id, label, ownership?.memberId]);
  return <DealFormModal isOpen={open} onClose={onClose} mode="create" sourceKey={`${buyer.type}:${buyer.id}`}
    initialValues={initial} owners={ownership?.assignableOwners || []} stages={getDealStagesSnapshot()}
    canAssign={ownership?.canAssign} customerNameLocked allowFollowUpTask={false}
    onSubmit={async (draft, _opening, intent, source) => {
      if (source !== `${buyer.type}:${buyer.id}` || draft.buyerRef?.type !== buyer.type || draft.buyerRef.id !== buyer.id || draft.createFollowUpTask) return false;
      const now = new Date().toISOString();
      const result = await createDealCommand({ id: `${intent}:deal`, name: draft.name, buyerRef: buyer,
        stage: draft.stage, ...(isDealConnectedMode() ? {} : { pipelineId: draft.pipeline }),
        amount: draft.amount, amountDecimal: draft.amountDecimal, currency: draft.currency,
        ownerId: draft.ownerId, opportunityScore: draft.probability, expectedCloseDate: draft.expectedCloseDate,
        forecastCategory: draft.forecastCategory, interestedProducts: [...draft.interestedProductIds], lineItems: [],
        notes: [draft.demandSummary, draft.painPoints, draft.notes].filter(Boolean).join(" · "), createdAt: now, updatedAt: now },
        { idempotencyKey: `${intent}:create` });
      await invalidateModuleQueries({ moduleKeys: ["deals"], commandType: "deal.create", aggregateId: result.data.id, occurredAt: result.occurredAt }); onCreated(result.data.id); return true;
    }}/>
}
