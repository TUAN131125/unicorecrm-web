import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button, Select } from "@/shared/components/ui";
import { DealDetailField } from "./DealDetailField";
import { formatDate } from "@/shared/lib/format/date";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailSidebarActions({ controller: c }: { controller: DealDetailController }) {
  const vi = c.locale === "vi";
  return <section data-deal-detail-actions="balanced" data-guidance-id="deals.detail.management" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><SlidersHorizontal size={16} className="text-violet-600" />{vi ? "Quản lý cơ hội" : "Opportunity management"}</h2>
    {c.isTerminal ? <div className={`space-y-2 rounded-xl p-4 text-sm ${c.deal.stage === "WON" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
      <p className="font-semibold">{c.getDealStageLabel(c.deal.stage)}</p>
      <DealDetailField field="lostReason">{c.deal.lostReason && <p>{c.getLostReasonLabel(c.deal.lostReason)}</p>}</DealDetailField>
      <DealDetailField field="lostReasonNote">{c.deal.lostReasonNote && <p>{c.deal.lostReasonNote}</p>}</DealDetailField>
      <DealDetailField field="revisitAt">{c.deal.revisitAt && <p>{vi ? "Xem xét lại:" : "Revisit:"} {formatDate(c.deal.revisitAt, c.locale)}</p>}</DealDetailField>
      <p className="text-xs">{vi ? "Cơ hội đã kết thúc. Xem lịch sử và chứng từ liên quan trong các tab." : "This opportunity is closed. Review history and related documents in the tabs."}</p>
    </div> : <>
      <DealDetailField field="stageCode"><p className="text-xs text-slate-500">{vi ? "Hiện tại:" : "Current:"} <strong className="text-violet-700">{c.getDealStageLabel(c.deal.stage)}</strong></p></DealDetailField>
      {c.canChangeStage && <div className="space-y-3">
        <Select id="deal-stage-select" searchable={false} label={vi ? "Chọn giai đoạn" : "Choose stage"} value={c.selectedStage} disabled={c.interactionPending} onChange={event => c.setSelectedStage(event.target.value)}>
          <option value="">{vi ? "Chọn giai đoạn mới" : "Choose a new stage"}</option>{c.stageChoices.map(stage => <option key={stage.code} value={stage.code}>{vi ? stage.labelVi : stage.labelEn}</option>)}
        </Select>
        <Button fullWidth size="sm" actionIntent="confirm" disabled={!c.stageChoices.some(stage => stage.code === c.selectedStage)} loading={c.interactionPending} onClick={() => void c.handleChangeStage()}>{vi ? "Cập nhật giai đoạn" : "Update stage"}</Button>
      </div>}
      {c.stageError && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800"><p>{c.stageError}</p><Button size="xs" variant="ghost" onClick={() => void c.handleChangeStage()} disabled={c.interactionPending}>{vi ? "Thử lại" : "Retry"}</Button></div>}
      {(c.canCloseWon || c.canCloseLost) && <div className="space-y-2 border-t border-slate-100 pt-3">
        {c.canCloseWon && <Button fullWidth size="sm" actionIntent="confirm" variant="success" disabled={c.interactionPending} onClick={() => c.setIsWonModalOpen(true)}>{vi ? "Đánh dấu thắng" : "Mark won"}</Button>}
        {c.canCloseLost && <Button fullWidth size="sm" actionIntent="destructive" disabled={c.interactionPending} onClick={() => c.setIsLostModalOpen(true)}>{vi ? "Đánh dấu thua" : "Mark lost"}</Button>}
      </div>}
    </>}
    {c.hasLinkedOrder && c.latestLinkedOrder && <Button size="sm" fullWidth onClick={() => c.navigate(`/orders/${c.latestLinkedOrder?.id}`)}>{vi ? "Xem đơn hàng liên kết" : "View linked order"}</Button>}
    {!c.connected && c.isTerminal && c.deal.stage === "WON" && !c.hasLinkedOrder && <Button size="sm" fullWidth onClick={() => c.navigate(c.acceptedQuote ? `/orders/new?quoteId=${c.acceptedQuote.id}` : `/orders/new?dealId=${c.deal.id}`)}>{vi ? "Tạo đơn hàng" : "Create order"}</Button>}
  </section>;
}
