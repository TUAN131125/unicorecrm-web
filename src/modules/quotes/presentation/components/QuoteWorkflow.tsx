import { quoteOrderStateLabel } from "../model/quoteOrderPresentation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { formatDateTime } from "@/shared/lib/format/date";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import type { Quote } from "../../domain/model/quote.types";
import { Button } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";
import { formatCommercialMoney } from "@/shared/lib/format/commercialMoney";
import { QuoteDocumentPanel } from "./QuoteDocumentPanel";
import { QuoteSalesAcceptancePanel } from "./QuoteSalesAcceptancePanel";
import { QuoteCustomerResponsePanel } from "./QuoteCustomerResponsePanel";
import { useQuoteWorkflow } from "../hooks/useQuoteWorkflow";

export function QuoteWorkflow({ quote, workspaceId, vi, canIssue, canRecord, onCommitted, onConfirmSent, timeZone, primaryActionHost }: {
  quote: Quote; workspaceId: string; vi: boolean; canIssue: boolean; canRecord: boolean;
  onCommitted: () => void; onConfirmSent: () => void; timeZone?: string; primaryActionHost: HTMLElement | null;
}) {
  const [issueRequest, setIssueRequest] = useState(0), [sendRequest, setSendRequest] = useState(0), [acceptRequest, setAcceptRequest] = useState(0);
  const flow = useQuoteWorkflow(quote, workspaceId);
  const titles = vi ? ["Phát hành PDF", "Gửi khách hàng", "Khách hàng phản hồi", "Đơn hàng"] : ["Issue PDF", "Send to customer", "Customer response", "Order"];
  const documents = <QuoteDocumentPanel quote={quote} workspaceId={workspaceId} vi={vi} canIssue={canIssue && flow.step === 0 && !flow.terminal} onCommitted={onCommitted} timeZone={timeZone} documents={flow.documents} requestIssue={flow.step === 0 ? issueRequest : 0} />;
  const response = <QuoteSalesAcceptancePanel quote={quote} workspaceId={workspaceId} vi={vi} canRecord={canRecord && !flow.terminal} onCommitted={onCommitted} timeZone={timeZone} documents={flow.documents} requestSend={flow.step === 1 ? sendRequest : 0} requestAcceptance={flow.step === 2 ? acceptRequest : 0} />;
  const events = [
    { id: "created", title: vi ? "Tạo báo giá" : "Quote created", at: quote.createdAt },
    ...flow.documents.items.map(item => ({ id: item.documentId, title: vi ? `Phát hành PDF · bản ${item.documentVersion}` : `PDF issued · version ${item.documentVersion}`, at: item.issuedAt })),
    ...(quote.deliveryHistory ?? []).map(item => ({ id: item.id, title: vi ? "Gửi khách hàng" : "Sent to customer", at: item.sentAt })),
    ...(quote.customerDecisionHistory ?? []).map(item => ({ id: item.id, title: item.sourceDescription, at: item.recordedAt })),
    ...(quote.salesAcceptance ? [{ id: quote.salesAcceptance.acceptanceId, title: vi ? "Khách hàng chấp nhận" : "Customer accepted", at: quote.salesAcceptance.acceptedAt }] : []),
  ].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  const primary = !flow.terminal && (flow.step === 0
    ? canIssue && quote.authoritativeActions?.issueDocument?.allowed && flow.documents.seller?.ready && !flow.documents.loading && <Button variant="primary" size="sm" className="h-9 rounded-xl" onClick={() => setIssueRequest(value => value + 1)}>{vi ? "Phát hành báo giá" : "Issue quote"}</Button>
    : flow.step === 1 ? canRecord && !flow.documents.loading && !flow.documents.error && flow.documents.items.length > 0 && <Button variant="primary" size="sm" className="h-9 rounded-xl" onClick={() => setSendRequest(value => value + 1)}>{vi ? "Gửi khách hàng" : "Send to customer"}</Button>
    : flow.step === 2 ? canRecord && !flow.documents.loading && !flow.documents.error && flow.documents.items.length > 0 && <Button variant="primary" size="sm" className="h-9 rounded-xl" onClick={() => setAcceptRequest(value => value + 1)}>{vi ? "Ghi nhận khách hàng chấp nhận" : "Record customer acceptance"}</Button>
    : flow.order ? <Link className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700" to={`/orders/${flow.order.id}`}>{vi ? "Xem đơn hàng" : "View Order"}</Link> : null);
  return <>{primaryActionHost && createPortal(primary, primaryActionHost)}<section data-quote-workflow="unified" className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
    <h2 className="mb-5 text-base font-semibold text-slate-900">{vi ? "Tiến trình báo giá" : "Quote workflow"}</h2>
    <ol className="space-y-0">{titles.map((title, index) => {
      const completed = index < flow.step && flow.completed[index] === true;
      const current = index === flow.step;
      return <li key={title} data-workflow-step={index} aria-current={current ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
        <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${completed ? "bg-emerald-50 text-emerald-700" : current ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400"}`}>{completed ? <Check size={15} /> : index + 1}</span>
        {index < 3 && <span aria-hidden="true" className="absolute left-3 top-8 h-[calc(100%-36px)] w-px bg-slate-200" />}
        <div className="min-w-0 flex-1 pt-0.5">
          {completed ? <details><summary className="cursor-pointer text-slate-600">{title} · {vi ? "Hoàn tất" : "Complete"}</summary><div className="mt-3">{index === 0 ? documents : index === 1 ? <p>{vi ? "Đã ghi nhận gửi khách hàng." : "Customer delivery recorded."}</p> : <p>{vi ? "Đã ghi nhận khách hàng chấp nhận." : "Customer acceptance recorded."}</p>}</div></details> : <p className={current ? "font-medium text-violet-800" : "text-slate-400"}>{title}</p>}
          {current && <div className="mt-3 space-y-3">
            {flow.terminal ? <div className="space-y-2"><p>{vi ? "Báo giá đã đóng. Xem lịch sử hoặc tạo phiên bản mới khi cần." : "This Quote is closed. Review its history or create a revision."}</p>{quote.customerDecisionHistory?.filter(item => item.decisionType === "REJECTION").map(item => <p key={item.id}>{item.sourceDescription}</p>)}</div> : <>
              {index === 0 && documents}
              {index === 1 && <p className="text-slate-500">{vi ? "Gửi PDF đã phát hành hoặc ghi nhận lần gửi qua kênh khác." : "Send the issued PDF or record delivery through another channel."}</p>}
              {index === 2 && <p className="text-slate-500">{vi ? "Đang chờ phản hồi. Dùng liên kết khách hàng hoặc ghi nhận đồng ý kèm bằng chứng." : "Awaiting a response. Use the customer link or record agreement with evidence."}</p>}
              {index > 0 && flow.documents.error !== null && <div role="alert"><p>{formatApplicationError(flow.documents.error, { locale: vi ? "vi" : "en" })}</p><Button variant="secondary" onClick={() => void flow.documents.refresh()}>{vi ? "Thử lại" : "Retry"}</Button></div>}
              {(index === 1 || index === 2) && response}
              {index === 1 && canRecord && <Button variant="secondary" onClick={onConfirmSent}>{vi ? "Ghi nhận đã gửi qua kênh khác" : "Record delivery through another channel"}</Button>}
              {index === 2 && canRecord && quote.authoritativeActions?.reject?.allowed === true && <details><summary className="cursor-pointer text-slate-500">{vi ? "Khách hàng từ chối" : "Customer declined"}</summary><QuoteCustomerResponsePanel quote={quote} workspaceId={workspaceId} canUpdate={canRecord} vi={vi} onCommitted={onCommitted} /></details>}
              {index === 3 && <>
                {!quote.salesAcceptance && <p>{vi ? "Đã chấp nhận. Chưa có đơn hàng được liên kết." : "Accepted. No linked Order is available."}</p>}
                {quote.salesAcceptance && !quote.salesAcceptance.orderId && response}
                {quote.salesAcceptance?.orderId && !flow.order && !flow.orderError && <p role="status">{vi ? "Đang tải đơn hàng…" : "Loading Order…"}</p>}
                {flow.orderError !== null && <div role="alert"><p>{formatApplicationError(flow.orderError, { locale: vi ? "vi" : "en" })}</p><Button variant="secondary" onClick={flow.retryOrder}>{vi ? "Thử lại" : "Retry"}</Button></div>}
                {flow.order && <div data-quote-order="authoritative" className="space-y-2"><p>{flow.order.orderNumber}</p><p>{quoteOrderStateLabel(flow.order, vi)}</p><p>{formatCommercialMoney(flow.order.commercialTotal, vi ? "vi" : "en")}</p></div>}
              </>}
            </>}
          </div>}
        </div>
      </li>;
    })}</ol>
    <details className="mt-5 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-slate-500">{vi ? "Lịch sử hoạt động" : "Activity history"}</summary>
      <ol className="mt-3 space-y-3">{events.map(event => <li key={event.id}><p>{event.title}</p><time dateTime={event.at} className="text-xs text-slate-500">{formatDateTime(event.at, vi ? "vi" : "en", { timeZone })}</time></li>)}</ol>
    </details>
  </section></>;
}
