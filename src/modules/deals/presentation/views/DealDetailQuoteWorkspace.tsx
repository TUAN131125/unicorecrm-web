import React from "react";
import { FileText } from "lucide-react";
import { Badge, Button, getQuoteStatusBadgeVariant } from "@/shared/components/ui";
import { formatCurrency } from "@/shared/lib/format/currency";
import { dealDisplayDate } from "./dealDetailPresentation";
import { QuoteStatus } from "@/modules/quotes";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailQuoteWorkspace({ controller: c, compact = false }: { controller: DealDetailController; compact?: boolean }) {
  const vi = c.locale === "vi";
  const quotes = compact ? c.relatedQuotes.slice(0, 1) : c.relatedQuotes;
  return <section className="space-y-4" data-deal-quote-workspace="responsive-cards">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><FileText size={17} className="text-violet-600" />{vi ? "Báo giá liên kết" : "Related quotes"}</h2><p className="mt-1 text-xs text-slate-500">{vi ? "Chứng từ, phản hồi và thời hạn hiệu lực" : "Documents, responses and validity"}</p></div>
      {compact ? <Button size="xs" variant="ghost" onClick={() => c.setActiveTab("quotes")}>{vi ? "Xem toàn bộ" : "View all"}</Button>
        : c.canCreateQuote && <Button size="sm" actionIntent="create" onClick={() => c.navigate(`/quotes/new?dealId=${c.deal.id}`)}>{vi ? "Tạo báo giá" : "Create quote"}</Button>}
    </div>
    {!c.isQuoteEnabled ? <p className="text-sm text-slate-500">{vi ? "Báo giá chưa được bật trong không gian làm việc này." : "Quotes are not enabled in this workspace."}</p>
      : !c.quoteQuery.permitted ? <p className="text-sm text-slate-500">{vi ? "Bạn không có quyền xem báo giá liên quan." : "You cannot view related quotes."}</p>
      : c.quoteQuery.loading ? <p role="status" className="py-4 text-sm text-slate-500">{vi ? "Đang tải báo giá…" : "Loading quotes…"}</p>
      : c.quoteQuery.error ? <div role="alert" className="space-y-2 rounded-xl border border-rose-100 bg-rose-50 p-4"><p>{c.quoteQuery.error}</p><Button size="sm" actionIntent="retry" onClick={c.quoteQuery.reload}>{vi ? "Thử lại" : "Retry"}</Button></div>
      : quotes.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center"><FileText size={24} className="mx-auto mb-3 text-slate-300" /><h3 className="text-sm font-semibold text-slate-700">{vi ? "Chưa có báo giá liên kết" : "No linked quotes"}</h3><p className="mt-2 text-xs text-slate-500">{vi ? "Báo giá sẽ xuất hiện khi có chứng từ được liên kết với cơ hội này." : "Quotes appear when documents are linked to this opportunity."}</p></div>
      : quotes.map(quote => <article key={quote.id} data-related-quote={quote.id} data-quote-status={quote.status} className="overflow-hidden rounded-xl border border-violet-100">
        <div className="flex flex-wrap items-start justify-between gap-2 p-4"><div className="min-w-0"><button className="text-sm font-semibold text-violet-700 hover:underline" onClick={() => c.navigate(`/quotes/${quote.id}`)}>{quote.quoteNumber || (vi ? "Xem báo giá" : "View quote")}</button><p className="mt-1 break-words text-xs text-slate-500">{quote.title}</p></div>
          <Badge variant={getQuoteStatusBadgeVariant(quote.status)}>{c.t(`quote.status.${quote.status.toLowerCase()}`)}</Badge></div>
        <dl className="grid grid-cols-2 gap-4 border-t border-slate-100 bg-slate-50/40 p-4 sm:grid-cols-3">
          <QuoteMeta label={vi ? "Giá trị báo giá" : "Quote amount"} value={quote.currency ? formatCurrency(quote.grandTotal, quote.currency, c.locale) : "—"} />
          <QuoteMeta label={vi ? "Ngày lập" : "Created"} value={dealDisplayDate(quote.createdAt, c.locale, c.timeZone)} />
          <QuoteMeta label={vi ? "Hiệu lực đến" : "Valid until"} value={dealDisplayDate(quote.validUntil ?? quote.expiryDate, c.locale, c.timeZone)} />
        </dl>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
          <Button size="xs" actionIntent="navigate" variant="secondary" onClick={() => c.navigate(`/quotes/${quote.id}`)}>{vi ? "Xem chi tiết báo giá" : "View quote details"}</Button>
          {c.canUpdateQuote && !c.isTerminal && <>
            {quote.status === QuoteStatus.DRAFT && <Button size="xs" onClick={() => c.navigate(`/quotes/${quote.id}/edit?dealId=${c.deal.id}`)}>{vi ? "Tiếp tục bản nháp" : "Continue draft"}</Button>}
            {!c.connected && (quote.status === QuoteStatus.DRAFT || quote.status === QuoteStatus.REVIEW) && (              <><Button size="xs" onClick={() => c.navigate(`/quotes/${quote.id}/edit?action=gmail`)}>{vi ? "Gửi Gmail" : "Send Gmail"}</Button><Button size="xs" onClick={() => c.navigate(`/quotes/${quote.id}/edit?action=confirm`)}>{vi ? "Xác nhận đã gửi" : "Confirm sent"}</Button><Button size="xs" onClick={() => c.navigate(`/quotes/${quote.id}/edit?action=pdf`)}>PDF</Button></>)}
            {!c.connected && quote.status === QuoteStatus.SENT && <><Button size="xs" variant="success" onClick={() => void c.handleUpdateQuoteStatus(quote.id, QuoteStatus.ACCEPTED)}>{vi ? "Khách chấp nhận" : "Customer accepted"}</Button><Button size="xs" variant="danger" onClick={() => void c.handleUpdateQuoteStatus(quote.id, QuoteStatus.REJECTED)}>{vi ? "Khách từ chối" : "Customer rejected"}</Button></>}
          </>}
        </div>
      </article>)}
    {!compact && c.quoteQuery.next && <Button size="sm" variant="secondary" onClick={c.quoteQuery.nextPage}>{vi ? "Trang tiếp" : "Next page"}</Button>}
  </section>;
}
function QuoteMeta({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>; }
