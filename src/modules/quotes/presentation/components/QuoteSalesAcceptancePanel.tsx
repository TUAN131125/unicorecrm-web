import { normalizeApplicationError } from "@/shared/domain";
import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/shared/lib/format/date";
import { Button, Modal, ConfirmDialog } from "@/shared/components/ui";
import { createDurableId } from "@/shared/ids";
import { formatApplicationError } from "@/shared/operations";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import type { Quote } from "../../domain/model/quote.types";
import type { StaffAcceptanceInput } from "../../application/ports/QuoteSalesAcceptancePort";
import { inviteQuoteCustomer, recordSalesAcceptance, readQuoteInvitationHistory, type SalesInvitation } from "../../public/salesAcceptance";
import { useQuoteDocuments } from "../hooks/useQuoteDocuments";

export function QuoteSalesAcceptancePanel({ quote, workspaceId, canRecord, vi, onCommitted, requestAcceptance = 0, requestSend = 0, timeZone, documents }: {
  quote: Quote; workspaceId: string; canRecord: boolean; vi: boolean; onCommitted: () => void; requestAcceptance?: number; requestSend?: number; timeZone?: string; documents: ReturnType<typeof useQuoteDocuments>;
}) {
  const [sendOpen, setSendOpen] = useState(false);
  useEffect(() => { if (requestAcceptance > 0) setOpen(true); }, [requestAcceptance]);
  useEffect(() => { if (requestSend > 0) setSendOpen(true); }, [requestSend]);
  const [documentId, setDocument] = useState("");
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<StaffAcceptanceInput["channel"]>("PHONE");
  const [agreedAt, setAgreedAt] = useState(""); const [evidence, setEvidence] = useState("");
  const [attachment, setAttachment] = useState(""); const [responsible, setResponsible] = useState(false);
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<SalesInvitation | null>(null);
  const [history, setHistory] = useState<SalesInvitation[]>([]);
  const active = useRef(true); const submitting = useRef(false);
  const attempt = useRef<{ payload: string; key: string; version: number } | null>(null);
  const guard = useUnsavedChangesGuard(() => setOpen(false));
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    void readQuoteInvitationHistory(quote.id, controller.signal).then(setHistory).catch(cause => { if (!controller.signal.aborted) setError(formatApplicationError(cause, { locale: vi ? "vi" : "en" })); });
    return () => controller.abort();
  }, [quote.id, quote.resourceVersion, workspaceId, invitation?.invitationId, vi]);
  useEffect(() => { guard.setIsDirty(open && Boolean(evidence || agreedAt || attachment)); }, [open, evidence, agreedAt, attachment, guard.setIsDirty]);
  useEffect(() => {
    if (!quote.salesAcceptance || quote.salesAcceptance.orderId) return;
    const interval = window.setInterval(onCommitted, 2500);
    return () => window.clearInterval(interval);
  }, [quote.salesAcceptance?.conversionStatus, onCommitted]);
  const selected = documentId || documents.items[0]?.documentId;
  const execute = async (kind: "staff" | "gmail" | "link") => {
    if (submitting.current || !selected || quote.resourceVersion === undefined) return;
    submitting.current = true; setPending(true); setError(null);
    const input: StaffAcceptanceInput = { documentId: selected, channel, customerAgreedAt: agreedAt ? new Date(agreedAt).toISOString() : "", evidence, responsibilityConfirmed: responsible, ...(attachment.trim() ? { attachmentEvidenceId: attachment.trim() } : {}) };
    const payload = JSON.stringify({ kind, selected, input });
    if (attempt.current && attempt.current.payload !== payload) {
      submitting.current = false; setPending(false); setError(vi ? "Yêu cầu trước chưa được xác nhận. Hãy tải lại báo giá để kiểm tra kết quả trước khi thay đổi thông tin." : "The previous request is unresolved. Reload the Quote to check its result before changing the information."); return;
    }
    if (!attempt.current) attempt.current = { payload, key: createDurableId("quote_sales_acceptance"), version: quote.resourceVersion };
    const opening = attempt.current;
    try {
      if (kind === "staff") await recordSalesAcceptance(quote.id, opening.version, input, opening.key);
      else { const result = await inviteQuoteCustomer(quote.id, opening.version, selected, kind === "gmail", opening.key); if (active.current) setInvitation(result); }
      attempt.current = null; // A successful receipt resolves this intent; another explicit action may begin.
      if (active.current) { setOpen(false); setSendOpen(false); guard.setIsDirty(false); onCommitted(); }
    } catch (cause) {
      if (normalizeApplicationError(cause).category === "VALIDATION") attempt.current = null; // Definitive rejection, no committed consent.
      if (active.current) setError(formatApplicationError(cause, { locale: vi ? "vi" : "en" }));
    }
    finally { submitting.current = false; if (active.current) setPending(false); }
  };
  const acceptance = quote.salesAcceptance;
  return <div id="quote-customer-response" data-quote-sales-acceptance="panel">
    
    {acceptance ? <div className="mt-3 space-y-2 text-sm" role="status">
      <p>{vi ? "Đã chấp nhận" : "Accepted"} · {acceptance.source === "CUSTOMER_LINK" ? (vi ? "Khách hàng xác nhận" : "Customer confirmed") : (vi ? "Nhân viên ghi nhận" : "Recorded by staff")} · {formatDateTime(acceptance.acceptedAt, vi ? "vi" : "en", { timeZone })}</p>
      <p className="text-slate-500">{vi ? "Đã ghi nhận đồng ý mua hàng." : "Agreement to purchase recorded."}</p>
      
      {acceptance.source === "STAFF_RECORDED" && <p>{acceptance.evidence}</p>}
      {!acceptance.orderId && <p>{vi ? "Đang xử lý đơn hàng. Tiến độ sẽ tự cập nhật." : "Processing the Order. Progress updates automatically."}</p>}
      {acceptance.lastErrorCode && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">{conversionBlocker(acceptance.lastErrorCode, vi)}</p>}
      {acceptance.operationalApprovalRequired && <p>{vi ? "Cần phê duyệt bổ sung trước khi xác nhận vận hành." : "Additional approval is required before operational confirmation."}</p>}
    </div> : <>
      <div className="mt-3 flex flex-wrap gap-2">{quote.status === "SENT" && canRecord && <Button variant="secondary" disabled={pending || !selected} onClick={() => setSendOpen(true)}>{vi ? "Gửi & liên kết khách hàng" : "Delivery & customer link"}</Button>}</div>
      <Modal isOpen={sendOpen} onClose={() => { if (!pending) setSendOpen(false); }} title={vi ? "Gửi báo giá" : "Send quote"} size="md" portalToRoot>
      <label className="mt-3 block text-sm">{vi ? "Tài liệu đã phát hành" : "Issued document"}<select className="mt-1 block w-full rounded border p-2" value={selected ?? ""} onChange={event => setDocument(event.target.value)} disabled={pending}>
        {!documents.items.length && <option value="">{vi ? "Hãy phát hành PDF trước" : "Issue a PDF first"}</option>}
        {documents.items.map(item => <option key={item.documentId} value={item.documentId}>{item.fileName} · {item.documentVersion}</option>)}
      </select></label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!canRecord || !selected || pending} onClick={() => void execute("gmail")}>{vi ? "Gửi báo giá qua Gmail" : "Send quote via Gmail"}</Button>
        <Button variant="secondary" disabled={!canRecord || !selected || pending || quote.status !== "SENT"} onClick={() => void execute("link")}>{vi ? "Tạo liên kết chấp nhận" : "Create acceptance link"}</Button>

      </div>
      {error && <p role="alert">{error}</p>}</Modal>
      {invitation && <div className="mt-3 text-sm" role="status"><p>{vi ? "Trạng thái gửi" : "Delivery status"}: {invitation.deliveryStatus}</p>
        {invitation.deliveryErrorCode && <p>{vi ? "Chưa gửi được Gmail. Kiểm tra cấu hình hoặc kết nối Workspace rồi thử lại." : "Gmail was not sent. Check the Workspace configuration or connection and retry."}</p>}
        {invitation.acceptanceUrl && <a href={invitation.acceptanceUrl} target="_blank" rel="noreferrer" className="text-violet-700 underline">{vi ? "Mở liên kết dành cho khách hàng" : "Open customer acceptance link"}</a>}
      </div>}
      <Modal isOpen={open} onClose={() => { if (!pending) guard.requestClose(); }} title={vi ? "Ghi nhận khách hàng chấp nhận" : "Record customer acceptance"} size="md" variant="form" portalToRoot><form className="grid gap-3" onSubmit={event => { event.preventDefault(); void execute("staff"); }}>
        <label>{vi ? "Kênh xác nhận" : "Confirmation channel"}<select value={channel} onChange={event => setChannel(event.target.value as StaffAcceptanceInput["channel"])} disabled={pending} className="block w-full rounded border p-2">
          {(["PHONE", "EMAIL", "GMAIL", "ZALO", "IN_PERSON", "OTHER"] as const).map(value => <option key={value} value={value}>{({ PHONE: vi ? "Điện thoại" : "Phone", EMAIL: "Email", GMAIL: "Gmail", ZALO: "Zalo", IN_PERSON: vi ? "Gặp trực tiếp" : "In person", OTHER: vi ? "Kênh khác" : "Other" })[value]}</option>)}</select></label>
        <label>{vi ? "Thời gian khách hàng đồng ý" : "Customer agreement time"}<input type="datetime-local" required value={agreedAt} onChange={event => setAgreedAt(event.target.value)} disabled={pending} className="block w-full rounded border p-2" /></label>
        <label>{vi ? "Ghi chú / bằng chứng" : "Notes / evidence"}<textarea required maxLength={3500} value={evidence} onChange={event => setEvidence(event.target.value)} disabled={pending} className="block w-full rounded border p-2" /></label>
        <label>{vi ? "Mã tham chiếu tệp đính kèm (nếu có)" : "Attachment reference (optional)"}<input value={attachment} onChange={event => setAttachment(event.target.value)} disabled={pending} className="block w-full rounded border p-2" /></label>
        <p className="text-sm">{vi ? "Tải tệp tại mục Bằng chứng của báo giá. Tệp cần hoàn tất kiểm tra an toàn trước khi sử dụng." : "Upload files in the quote Evidence section. Files must complete safety checks before use."}</p>
        <label className="flex gap-2"><input type="checkbox" checked={responsible} onChange={event => setResponsible(event.target.checked)} disabled={pending} required />{vi ? "Tôi chịu trách nhiệm về thông tin ghi nhận khách hàng đã đồng ý." : "I take responsibility for recording the customer's agreement."}</label>
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        <div className="flex gap-2"><Button variant="primary" type="submit" disabled={pending || !responsible}>{pending ? (vi ? "Đang lưu…" : "Saving…") : (vi ? "Lưu chấp nhận" : "Save acceptance")}</Button><Button type="button" variant="secondary" disabled={pending} onClick={guard.requestClose}>{vi ? "Hủy" : "Cancel"}</Button></div>
      </form></Modal>
    </>}
    <ConfirmDialog isOpen={guard.isConfirmOpen} onClose={() => guard.setIsConfirmOpen(false)} onConfirm={guard.confirmDiscard} title={vi ? "Bỏ thông tin chưa lưu?" : "Discard unsaved information?"} message={vi ? "Thông tin chấp nhận chưa được lưu." : "Acceptance information has not been saved."} confirmText={vi ? "Bỏ thay đổi" : "Discard"} cancelText={vi ? "Tiếp tục" : "Continue"} type="warning" />
    {error && !sendOpen && !open && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}
    <details className="mt-4 text-sm"><summary>{vi ? "Lịch sử gửi lời mời chấp nhận" : "Acceptance invitation delivery history"}</summary>
      {!history.length && <p>{vi ? "Chưa có lời mời." : "No invitations yet."}</p>}
      <ol>{history.map(item => <li className="mt-2" key={item.invitationId}>{item.deliveryStatus} · {vi ? "Hết hạn" : "Expires"}: {formatDateTime(item.expiresAt, vi ? "vi" : "en", { timeZone })}</li>)}</ol>
    </details>
  </div>;
}

function conversionBlocker(code: string, vi: boolean): string {
  const labels: Record<string, [string, string]> = {
    AUTO_CONFIRM_POLICY_DISABLED: ["Chưa bật xác nhận đơn hàng tự động. Liên hệ quản trị viên.", "Automatic Order confirmation is not enabled. Contact your administrator."],
    AUTO_CONFIRM_RISK_LIMIT_EXCEEDED: ["Giá trị báo giá vượt hạn mức xác nhận tự động. Cần kiểm tra chính sách bán hàng.", "Quote value exceeds the automatic confirmation limit. Review the sales policy."],
    AUTO_CONFIRM_PRODUCT_TYPE_BLOCKED: ["Loại sản phẩm cần kiểm tra điều kiện thực hiện trước khi xác nhận đơn hàng.", "This product type needs a fulfillment review before Order confirmation."],
    OPERATIONAL_APPROVAL_REQUIRED: ["Cần hoàn tất điều kiện duyệt vận hành theo chính sách hiện hành.", "Complete the operational approval required by the current policy."],
    CREDIT_APPROVAL_REQUIRED: ["Điều khoản trả sau cần phê duyệt tín dụng hợp lệ.", "Postpaid terms require valid credit approval."],
    VERIFIED_SIGNER_AUTHORITY_REQUIRED: ["Cần xác minh người đại diện trước khi xác nhận đơn hàng.", "Verify signing authority before Order confirmation."],
    FULFILLMENT_INFORMATION_REQUIRED: ["Cần bổ sung thông tin người nhận và giao hàng.", "Recipient and delivery information is required."],
    BUYER_BINDING_INVALID: ["Thông tin người mua cần được kiểm tra lại.", "Buyer information needs review."],
    PAYMENT_ACCOUNT_AUTHORITY_REQUIRED: ["Chưa có chỉ dẫn thanh toán hợp lệ.", "Valid payment instructions are required."],
    QUOTE_EXPIRED_OR_TIMEZONE_UNAVAILABLE: ["Cần kiểm tra hiệu lực báo giá và múi giờ trước khi tạo đơn hàng.", "Review Quote validity and timezone before creating the Order."],
  };
  return labels[code]?.[vi ? 0 : 1] ?? (vi ? "Chưa thể xác nhận đơn hàng. Liên hệ người phụ trách để kiểm tra điều kiện; hệ thống sẽ thử lại." : "Order confirmation is incomplete. Ask the responsible person to review the requirements; processing will retry.");
}
