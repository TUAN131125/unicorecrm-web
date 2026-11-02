import React from "react";
import { Copy, FileText, TrendingUp } from "lucide-react";
import { Badge, Button } from "@/shared/components/ui";
import { RecordDetailHeader, recordDetailHeaderActionButtonClassName } from "@/components/crm/detail-archetype";
import { RecordHeaderActionMenu } from "@/components/crm/RecordHeaderActionMenu";
import { formatCurrency } from "@/shared/lib/format/currency";
import { DealDetailField } from "./DealDetailField";
import { dealWeightedForecast, dealDisplayDate, dealCloseDateOverdue } from "./dealDetailPresentation";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailHeaderSection({ controller: c }: { controller: DealDetailController }) {
  const { deal, locale, t, buyerLabel } = c;
  const vi = locale === "vi";
  const weighted = dealWeightedForecast(deal);
  const overdue = !c.isTerminal && dealCloseDateOverdue(deal.expectedCloseDate, c.timeZone);
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-deal-detail-summary="balanced">
    {c.toast && <div role={c.toast.type === "error" ? "alert" : "status"} className={`border-b px-5 py-3 text-sm ${c.toast.type === "error" ? "border-rose-100 bg-rose-50 text-rose-800" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}>{c.toast.text}</div>}
    <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none [&>div>div>div:last-child]:justify-end">
      <RecordDetailHeader id="deal-detail-header" backLabel={t("deals.detail.backToPipeline")} onBack={() => c.navigate(c.returnTo)}
        identityIcon={<TrendingUp size={20} />} identityToneClassName="border-violet-200 bg-violet-50 text-violet-700"
        title={<DealDetailField field="name">{deal.name}</DealDetailField>} titleOverflow="wrap-mobile"
        status={<DealDetailField field="stageCode"><Badge variant={c.isTerminal ? deal.stage === "WON" ? "success" : "danger" : "info"}>{c.getDealStageLabel(deal.stage)}</Badge></DealDetailField>}
        metadata={<DealDetailField field="buyerRef"><span data-deal-buyer-name data-state={buyerLabel.status} data-i18n-skip="true" className="font-medium text-slate-500">
          {"name" in buyerLabel && buyerLabel.name ? buyerLabel.name : buyerLabel.status === "LOADING" ? (vi ? "Đang tải tên người mua…" : "Loading buyer name…")
            : buyerLabel.status === "RESTRICTED" ? (vi ? "—" : "—")
            : (vi ? "Chưa có thông tin tên người mua" : "Buyer name is unavailable")}
        </span></DealDetailField>}
        actions={<>
          {c.canCreateQuote && <Button size="sm" icon={<FileText size={14} />} className={recordDetailHeaderActionButtonClassName} onClick={() => c.navigate(`/quotes/new?dealId=${deal.id}`)}>{t("deals.actions.createQuote")}</Button>}
          <RecordHeaderActionMenu label={vi ? "Thao tác khác" : "More actions"} sections={[{ id: "metadata", title: vi ? "THÔNG TIN HỒ SƠ" : "RECORD INFORMATION", items: [
            ...(c.linkedOrders.length > 1 ? [{ id: "linked-orders", label: vi ? "Xem tất cả đơn hàng liên quan" : "View all linked orders", icon: <FileText size={14} />, onClick: () => c.navigate(`/orders?dealId=${deal.id}`) }] : []),
            { id: "copy-id", label: vi ? "Sao chép ID cơ hội" : "Copy opportunity ID", icon: <Copy size={14} />, onClick: () => {
              void navigator.clipboard.writeText(deal.id).then(() => c.triggerToast("success", vi ? "Đã sao chép ID." : "ID copied."))
                .catch(() => c.triggerToast("error", vi ? "Không thể sao chép. Vui lòng thử lại." : "Could not copy. Please try again."));
            } },
            { id: "draft-next-step", label: vi ? "Sao chép nháp bước tiếp theo" : "Copy next-step draft", icon: <FileText size={14} />, onClick: () => {
              const draft = vi ? `Trao đổi về cơ hội “${deal.name}”. Vui lòng xác nhận yêu cầu và thời gian trao đổi tiếp theo.` : `Following up on “${deal.name}”. Please confirm your requirements and a time for our next discussion.`;
              void navigator.clipboard.writeText(draft).then(() => c.triggerToast("success", vi ? "Đã sao chép bản nháp." : "Draft copied."))
                .catch(() => c.triggerToast("error", vi ? "Không thể sao chép bản nháp." : "Could not copy draft."));
            }, disabled: !c.recordAccess || !["READ_WRITE", "READ_ONLY"].includes(c.recordAccess.fieldAccess.name ?? "") },
          ] }]} audit={{ resourceKey: "deals", recordId: deal.id, title: vi ? "Kiểm toán Cơ hội" : "Opportunity audit", label: vi ? "Xem lịch sử kiểm toán" : "View audit history", closeLabel: vi ? "Đóng" : "Close" }} />
        </>} />
    </div>
    <dl className="grid grid-cols-2 gap-y-5 border-t border-slate-100 bg-slate-50/40 px-5 py-5 sm:grid-cols-3 xl:grid-cols-5" data-deal-summary>
      <Summary field="amount" label={vi ? "Giá trị cơ hội" : "Deal amount"}><span data-i18n-skip="true" className="text-lg text-violet-700">{deal.currency ? formatCurrency(deal.amount, deal.currency, locale) : "—"}</span></Summary>
      <Summary field="opportunityScore" label={vi ? "Điểm cơ hội" : "Opportunity score"}>{Number.isFinite(deal.opportunityScore) ? `${deal.opportunityScore}%` : "—"}</Summary>
      <Summary field="expectedCloseDate" label={t("deals.columns.expectedClose")}><span className={overdue ? "text-rose-600" : ""}>{dealDisplayDate(deal.expectedCloseDate, locale, c.timeZone)}</span>{overdue && <small className="mt-1 block text-[10px] font-medium text-rose-600">{vi ? "Quá hạn dự kiến chốt" : "Expected close overdue"}</small>}</Summary>
      <DealDetailField field="amount" className="min-w-0"><Summary field="opportunityScore" label={vi ? "Dự báo có trọng số" : "Weighted forecast"}>{weighted ? formatCurrency(Number(weighted.amount), weighted.currency, locale) : "—"}</Summary></DealDetailField>
      <Summary field="stageCode" label={vi ? "Giai đoạn hiện tại" : "Current stage"}>{c.getDealStageLabel(deal.stage)}</Summary>
    </dl>
    <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-500">{vi ? "Dự báo theo công thức: Giá trị cơ hội × Điểm cơ hội / 100." : "Formula forecast: Deal amount × Opportunity score / 100."}</p>
  </section>;
}

function Summary({ field, label, children }: { field: string; label: string; children: React.ReactNode }) {
  return <DealDetailField field={field} className="min-w-0 px-2 first:pl-0 sm:border-r sm:border-slate-200 last:border-0"><dt className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt><dd className="break-words text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">{children}</dd></DealDetailField>;
}
