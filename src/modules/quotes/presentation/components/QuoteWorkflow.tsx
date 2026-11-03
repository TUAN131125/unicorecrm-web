import { quoteOrderStateLabel, quoteConversionBlocker } from "../model/quoteOrderPresentation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { formatDateTime } from "@/shared/lib/format/date";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import type { Quote } from "../../domain/model/quote.types";
import { Button } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";
import { QuoteDocumentPanel } from "./QuoteDocumentPanel";
import { QuoteSalesAcceptancePanel } from "./QuoteSalesAcceptancePanel";
import { QuoteCustomerResponsePanel } from "./QuoteCustomerResponsePanel";
import { useQuoteWorkflow } from "../hooks/useQuoteWorkflow";

export function QuoteWorkflow({ quote, workspaceId, vi, canIssue, canRecord, canSend, canRecordDelivery, onCommitted, onConfirmSent, timeZone, primaryActionHost }: {
  quote: Quote; workspaceId: string; vi: boolean; canIssue: boolean; canRecord: boolean; canSend: boolean; canRecordDelivery: boolean;
  onCommitted: () => void; onConfirmSent: () => void; timeZone?: string; primaryActionHost: HTMLElement | null;
}) {
  const [deliveryHost, setDeliveryHost] = useState<HTMLDivElement | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [issueRequest, setIssueRequest] = useState(0);
  const flow = useQuoteWorkflow(quote, workspaceId);
  const lastDelivery = quote.deliveryHistory?.[quote.deliveryHistory.length - 1];
  const deliveryStatus = !lastDelivery ? (vi ? "Chưa gửi" : "Not sent")
    : lastDelivery.evidenceType === "USER_CONFIRMED_SENT" ? (vi ? "Đã ghi nhận gửi thủ công" : "Manual delivery recorded")
    : ["PROVIDER_CONFIRMED_SENT", "PROVIDER_ACCEPTED", "PROVIDER_DELIVERED"].includes(lastDelivery.evidenceType ?? "") ? (vi ? "SMTP đã tiếp nhận" : "SMTP accepted")
    : (vi ? "Nguồn xác nhận gửi chưa xác định" : "Delivery evidence source unknown");
  const titles = vi ? ["Phát hành báo giá", "Gửi khách hàng", "Khách hàng chấp nhận", "Đơn hàng"] : ["Issue PDF", "Send to customer", "Customer response", "Order"];
  const documents = <QuoteDocumentPanel quote={quote} workspaceId={workspaceId} vi={vi} canIssue={canIssue && !flow.terminal} onCommitted={onCommitted} timeZone={timeZone} documents={flow.documents} requestIssue={issueRequest} />;
  const response = <QuoteSalesAcceptancePanel quote={quote} workspaceId={workspaceId} vi={vi} canRecord={canRecord && !flow.terminal} canSend={canSend && !flow.terminal} onCommitted={onCommitted} timeZone={timeZone} documents={flow.documents} deliveryHost={deliveryHost} primaryAction={canRecord ? "staff" : canSend && quote.authoritativeActions?.issueDocument?.allowed !== true ? "gmail" : null} />;
  const events = [
    { id: "created", title: vi ? "Tạo báo giá" : "Quote created", at: quote.createdAt },
    ...flow.documents.items.map(item => ({ id: item.documentId, title: vi ? `Phát hành PDF · bản ${item.documentVersion}` : `PDF issued · version ${item.documentVersion}`, at: item.issuedAt })),
    ...(quote.deliveryHistory ?? []).map(item => ({ id: item.id, title: vi ? "Gửi khách hàng" : "Sent to customer", at: item.sentAt })),
    ...(quote.customerDecisionHistory ?? []).map(item => ({ id: item.id, title: item.sourceDescription, at: item.recordedAt })),
    ...(quote.salesAcceptance ? [{ id: quote.salesAcceptance.acceptanceId, title: vi ? "Khách hàng chấp nhận" : "Customer accepted", at: quote.salesAcceptance.acceptedAt }] : []),
  ].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  const primary = !flow.terminal && (canIssue && quote.authoritativeActions?.issueDocument?.allowed === true && flow.documents.seller?.ready && !flow.documents.loading
    ? <Button variant="primary" size="sm" className="h-9 rounded-xl" onClick={() => setIssueRequest(value => value + 1)}>{vi ? "Phát hành báo giá" : "Issue quote"}</Button>
    : flow.order ? <Link className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700" to={`/orders/${flow.order.id}`}>{vi ? "Xem đơn hàng" : "View Order"}</Link> : null);
  return <>{primaryActionHost && createPortal(primary, primaryActionHost)}<section data-quote-workflow="unified" className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
    <h2 className="mb-5 text-base font-semibold text-slate-900">{vi ? "QUY TRÌNH BÁO GIÁ" : "Quote workflow"}</h2>
    <ol className="space-y-0">{titles.map((title, index) => {
      const completed = index < flow.step && flow.completed[index] === true;
      const current = index === flow.step;
      return <li key={title} data-workflow-step={index} aria-current={current ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
        <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${completed ? "bg-emerald-50 text-emerald-700" : current ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400"}`}>{completed ? <Check size={15} /> : index + 1}</span>
        {index < 3 && <span aria-hidden="true" className="absolute left-3 top-8 h-[calc(100%-36px)] w-px bg-slate-200" />}
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className={current ? "font-medium text-violet-800" : "font-medium text-slate-700"}>{title}{completed && <span className="ml-2 text-xs font-normal text-emerald-700">{vi ? "Hoàn tất" : "Complete"}</span>}</h3>
          {index === 0 && <div className="mt-2">{documents}</div>}
          {index === 1 && <div className="mt-2 space-y-2 text-slate-600">
            <p className="break-words [overflow-wrap:anywhere]">{vi ? "Email khách hàng" : "Customer email"}: {quote.recipientEmail || (vi ? "Cần cập nhật email người nhận trên báo giá" : "Update the recipient email on the Quote")}</p>
            <p>{deliveryStatus}</p>
          </div>}
          {index === 1 && <><div ref={setDeliveryHost} />{canRecordDelivery && !flow.terminal && !quote.salesAcceptance && ["DRAFT", "REVIEW", "SENT"].includes(quote.status) && <Button variant="secondary" className="mt-3" onClick={onConfirmSent}>{vi ? "Ghi nhận đã gửi qua kênh khác" : "Record delivery through another channel"}</Button>}</>}


          {index === 2 && response}
          {index === 3 && flow.step < 3 && <p className="mt-2 text-slate-500">{vi ? "Chưa tạo đơn hàng." : "No Order created."}</p>}
          {current && <div className="mt-3 space-y-3">
            {flow.terminal ? <div className="space-y-2"><p>{vi ? "Báo giá đã đóng. Xem lịch sử hoặc tạo phiên bản mới khi cần." : "This Quote is closed. Review its history or create a revision."}</p>{quote.customerDecisionHistory?.filter(item => item.decisionType === "REJECTION").map(item => <p key={item.id}>{item.sourceDescription}</p>)}</div> : <>
              {index === 1 && <p className="text-slate-500">{vi ? "Gửi PDF đã phát hành hoặc ghi nhận lần gửi qua kênh khác." : "Send the issued PDF or record delivery through another channel."}</p>}
              {index === 2 && <p className="text-slate-500">{vi ? "Đang chờ phản hồi. Dùng liên kết khách hàng hoặc ghi nhận đồng ý kèm bằng chứng." : "Awaiting a response. Use the customer link or record agreement with evidence."}</p>}
              {index > 0 && flow.documents.error !== null && <div role="alert"><p>{formatApplicationError(flow.documents.error, { locale: vi ? "vi" : "en" })}</p><Button variant="secondary" onClick={() => void flow.documents.refresh()}>{vi ? "Thử lại" : "Retry"}</Button></div>}

              {index === 2 && quote.authoritativeActions?.reject?.allowed === true && <section aria-label={vi ? "Khách hàng từ chối" : "Customer declined"}><QuoteCustomerResponsePanel quote={quote} workspaceId={workspaceId} canUpdate vi={vi} onCommitted={onCommitted} /></section>}
              {index === 3 && <>
                {quote.salesAcceptance && !quote.salesAcceptance.orderId && <div role="status" className="space-y-2">
                  <p>{quote.salesAcceptance.conversionStatus === "BLOCKED" ? (vi ? "Đơn hàng đang bị chặn." : "Order processing is blocked.") : (vi ? "Đang xử lý đơn hàng…" : "Processing the Order…")}</p>
                  {quote.salesAcceptance.lastErrorCode && <p className="text-amber-800">{quoteConversionBlocker(quote.salesAcceptance.lastErrorCode, vi)}</p>}
                  {quote.salesAcceptance.operationalApprovalRequired && <p>{vi ? "Cần hoàn tất điều kiện vận hành theo chính sách Workspace." : "Complete the operational requirements of the Workspace policy."}</p>}
                </div>}
                {!quote.salesAcceptance && <p>{vi ? "Đã chấp nhận. Chưa có đơn hàng được liên kết." : "Accepted. No linked Order is available."}</p>}

                {quote.salesAcceptance?.orderId && !flow.order && !flow.orderError && <p role="status">{vi ? "Đang tải đơn hàng…" : "Loading Order…"}</p>}
                {flow.orderError !== null && <div role="alert"><p>{formatApplicationError(flow.orderError, { locale: vi ? "vi" : "en" })}</p><Button variant="secondary" onClick={flow.retryOrder}>{vi ? "Thử lại" : "Retry"}</Button></div>}
                {flow.order && <div data-quote-order="authoritative" className="space-y-2"><p>{flow.order.orderNumber}</p><p>{quoteOrderStateLabel(flow.order, vi)}</p><Link className="text-violet-700 underline" to={`/orders/${flow.order.id}`}>{vi ? "Xem đơn hàng" : "View Order"}</Link></div>}
              </>}
            </>}
          </div>}
        </div>
      </li>;
    })}</ol>
    <section className="mt-5 border-t border-slate-100 pt-4"><Button variant="secondary" aria-expanded={activityOpen} onClick={() => setActivityOpen(value => !value)}>{vi ? "Hoạt động" : "Activity"}</Button>
      {activityOpen && <div>
      <ol className="mt-3 space-y-3">{events.map(event => <li key={event.id}><p>{event.title}</p><time dateTime={event.at} className="text-xs text-slate-500">{formatDateTime(event.at, vi ? "vi" : "en", { timeZone })}</time></li>)}</ol></div>}
    </section>
  </section></>;
}
