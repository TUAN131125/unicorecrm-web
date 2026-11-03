import { createPortal } from "react-dom";
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
import { downloadIssuedQuoteDocument } from "../../public/documents";

export function QuoteSalesAcceptancePanel({ quote, workspaceId, canRecord, canSend, vi, onCommitted, requestAcceptance = 0, requestSend = 0, timeZone, documents, deliveryHost, primaryAction }: {
  deliveryHost: HTMLElement | null; quote: Quote; workspaceId: string; canRecord: boolean; canSend: boolean; vi: boolean; onCommitted: () => void; requestAcceptance?: number; requestSend?: number; timeZone?: string; documents: ReturnType<typeof useQuoteDocuments>; primaryAction: "gmail" | "staff" | null;
}) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [sendOpen, setSendOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const previewRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (requestAcceptance > 0 && quote.authoritativeActions?.recordSalesAcceptance?.allowed === true) setOpen(true); }, [requestAcceptance]);
  useEffect(() => { if (requestSend > 0 && quote.authoritativeActions?.sendGmail?.allowed === true) setSendOpen(true); }, [requestSend]);
  const [documentId, setDocument] = useState("");
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<StaffAcceptanceInput["channel"]>("PHONE");
  const [agreedAt, setAgreedAt] = useState(""); const [evidence, setEvidence] = useState("");
  const [attachment, setAttachment] = useState(""); const [responsible, setResponsible] = useState(false);
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<SalesInvitation | null>(null);
  const [showHistory, setShowHistory] = useState(false);
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
  const currentDocuments = documents.items.filter(item => item.quoteRevision === quote.version);
  const selectedDocument = currentDocuments.find(item => item.documentId === documentId) ?? currentDocuments[0];
  const selected = selectedDocument?.documentId;
  useEffect(() => { setPreview(null); setPreviewPending(false); return () => previewRequest.current?.abort(); }, [selected, quote.id, workspaceId, sendOpen]);
  const canOpenSend = canSend && quote.authoritativeActions?.sendGmail?.allowed === true;
  const canOpenStaff = canRecord && quote.authoritativeActions?.recordSalesAcceptance?.allowed === true;
  const canCreateLink = quote.authoritativeActions?.createAcceptanceLink?.allowed === true;
  const previewPdf = async () => {
    if (!selected || previewPending) return;
    const request = new AbortController(); previewRequest.current = request;
    setPreviewPending(true); setError(null);
    try { const file = await downloadIssuedQuoteDocument(quote.id, selected, request.signal); if (active.current && !request.signal.aborted) setPreview(URL.createObjectURL(file.blob)); }
    catch (cause) { if (active.current && !request.signal.aborted) setError(formatApplicationError(cause, { locale: vi ? "vi" : "en" })); }
    finally { if (active.current && !request.signal.aborted) setPreviewPending(false); }
  };
  const execute = async (kind: "staff" | "gmail" | "link") => {
    if (submitting.current || !selected || quote.resourceVersion === undefined) return;
    setFieldErrors({});
    if (kind === "staff") {
      const fields: Record<string, string[]> = {};
      if (!agreedAt || !Number.isFinite(Date.parse(agreedAt))) fields.customerAgreedAt = [vi ? "Chọn thời gian khách hàng đồng ý." : "Choose the agreement time."];
      if (!evidence.trim()) fields.evidence = [vi ? "Nhập ghi chú hoặc bằng chứng khách hàng đồng ý." : "Enter notes or evidence of agreement."];
      if (!responsible) fields.responsibilityConfirmed = [vi ? "Cần xác nhận trách nhiệm." : "Confirm responsibility."];
      if (Object.keys(fields).length) { setFieldErrors(fields); return; }
    }
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
      else { const result = await inviteQuoteCustomer(quote.id, opening.version, selected, kind === "gmail", opening.key); if (active.current) { setInvitation(result); setHistory(previous => [result, ...previous.filter(item => item.invitationId !== result.invitationId)]); } }
      attempt.current = null; // A successful receipt resolves this intent; another explicit action may begin.
      if (active.current) { setOpen(false); setSendOpen(false); guard.setIsDirty(false); onCommitted(); }
    } catch (cause) {
      const failure = normalizeApplicationError(cause);
      if (failure.category === "VALIDATION") attempt.current = null;
      if (active.current) {
        if (failure.fieldErrors && Object.keys(failure.fieldErrors).length) setFieldErrors(failure.fieldErrors);
        else setError(formatApplicationError(cause, { locale: vi ? "vi" : "en" }));
      }
    }
    finally { submitting.current = false; if (active.current) setPending(false); }
  };
  const acceptance = quote.salesAcceptance;
  const fieldError = (field: string) => fieldErrors[field]?.length ? <p role="alert" className="mt-1 text-sm italic text-rose-600">{fieldErrors[field]?.join(" ")}</p> : null;
  const controlClass = (field: string) => `block w-full rounded border p-2 ${fieldErrors[field]?.length ? "border-rose-500" : "border-slate-300"}`;
  return <div id="quote-customer-response" data-quote-sales-acceptance="panel">

    {deliveryHost && createPortal(<>
      {!acceptance && <div className="mt-3 space-y-2" data-quote-action="gmail">
        <Button variant={primaryAction === "gmail" ? "primary" : "secondary"} disabled={!canOpenSend || pending || documents.loading || !selected || history.some(item => ["SENDING", "UNKNOWN"].includes(item.deliveryStatus))} onClick={() => setSendOpen(true)}>{vi ? "Gửi báo giá qua Gmail" : "Send quote via Gmail"}</Button>
        {!canOpenSend && <p className="text-sm text-slate-500">{actionBlocker(quote.authoritativeActions?.sendGmail?.blockerCodes[0] ?? "ACTION_AUTHORITY_UNAVAILABLE", vi, quote)}</p>}
      </div>}
      <Modal isOpen={sendOpen} onClose={() => { if (!pending) setSendOpen(false); }} title={vi ? "Gửi báo giá" : "Send quote"} size="md" portalToRoot>
      <div className="mt-3 space-y-2 text-sm"><p>{vi ? "Báo giá" : "Quote"}: {quote.quoteNumber}</p><p className="break-words">{vi ? "Người nhận" : "Recipient"}: {quote.recipientEmail}</p></div>
      <label className="mt-3 block text-sm">{vi ? "Tài liệu đã phát hành" : "Issued document"}<select className="mt-1 block w-full rounded border p-2" value={selected ?? ""} onChange={event => setDocument(event.target.value)} disabled={pending}>
        {!documents.items.length && <option value="">{vi ? "Hãy phát hành PDF trước" : "Issue a PDF first"}</option>}
        {currentDocuments.map(item => <option key={item.documentId} value={item.documentId}>{item.fileName} · {item.documentVersion}</option>)}
      </select></label>
      <Button variant="secondary" className="mt-3" disabled={!selected || previewPending || pending} onClick={() => void previewPdf()}>{previewPending ? (vi ? "Đang tải PDF…" : "Loading PDF…") : (vi ? "Kiểm tra PDF trước khi gửi" : "Review PDF before sending")}</Button>
      {preview && <iframe title={vi ? "PDF báo giá sắp gửi" : "Quote PDF to send"} src={preview} className="mt-3 h-64 w-full rounded border" />}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" loading={pending} disabled={!canSend || !selected || pending || quote.authoritativeActions?.sendGmail?.allowed !== true} onClick={() => void execute("gmail")}>{pending ? (vi ? "Đang gửi…" : "Sending…") : (vi ? "Gửi báo giá qua Gmail" : "Send quote via Gmail")}</Button>

      </div>
      {error && <p role="alert">{error}</p>}</Modal>
    <section className="mt-4 text-sm"><Button variant="secondary" aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}>{vi ? "Lịch sử gửi" : "Delivery history"}</Button>
      {!history.length && <p>{vi ? "Chưa có lần gửi Gmail hoặc liên kết khách hàng." : "No Gmail sends or customer links yet."}</p>}
      <ol>{(showHistory ? history : history.slice(0, 1)).map(item => <li className="mt-2" key={item.invitationId}>{deliveryLabel(item.deliveryStatus, vi)}{item.deliveredAt || item.createdAt ? ` · ${formatDateTime(item.deliveredAt ?? item.createdAt ?? "", vi ? "vi" : "en", { timeZone })}` : ""}{item.hasAcceptanceLink === false ? (vi ? " · Chỉ gửi PDF" : " · PDF only") : ` · ${vi ? "Hết hạn" : "Expires"}: ${formatDateTime(item.expiresAt, vi ? "vi" : "en", { timeZone })}`}{item.deliveryErrorCode && <p className="mt-1 text-amber-800">{deliveryError(item.deliveryErrorCode, item.deliveryStatus, vi)}</p>}</li>)}</ol>
    </section></>, deliveryHost)}

    {acceptance ? <div className="mt-3 space-y-2 text-sm" role="status">
      <p>{vi ? "Khách hàng đã chấp nhận" : "Customer accepted"} · {acceptance.source === "CUSTOMER_LINK" ? (vi ? "Khách hàng xác nhận" : "Customer confirmed") : (vi ? "Nhân viên ghi nhận" : "Recorded by staff")} · {formatDateTime(acceptance.acceptedAt, vi ? "vi" : "en", { timeZone })}</p>

      {acceptance.source === "STAFF_RECORDED" && <><p>{acceptance.evidence}</p><p className="text-xs text-slate-500">{vi ? "Nhân viên ghi nhận" : "Recorded by"}: {acceptance.recordedBy}</p></>}
    </div> : <>
      <div className="mt-3 space-y-2" data-quote-action="staff-acceptance"><Button variant={primaryAction === "staff" ? "primary" : "secondary"} disabled={!canOpenStaff || pending || documents.loading || !selected} onClick={() => setOpen(true)}>{vi ? "Ghi nhận khách hàng đã chấp nhận" : "Record customer acceptance"}</Button>
      {!canOpenStaff && <p className="text-sm text-slate-500">{actionBlocker(quote.authoritativeActions?.recordSalesAcceptance?.blockerCodes[0] ?? "ACTION_AUTHORITY_UNAVAILABLE", vi, quote)}</p>}</div>
      {canCreateLink && <Button variant="secondary" disabled={pending || !selected} onClick={() => void execute("link")}>{vi ? "Tạo liên kết chấp nhận" : "Create acceptance link"}</Button>}
      {invitation?.acceptanceUrl && <a className="ml-2 text-sm text-violet-700 underline" href={invitation.acceptanceUrl} target="_blank" rel="noreferrer">{vi ? "Mở liên kết khách hàng" : "Open customer link"}</a>}
      <Modal isOpen={open} onClose={() => { if (!pending) guard.requestClose(); }} title={vi ? "Ghi nhận khách hàng đã chấp nhận" : "Record customer acceptance"} size="md" variant="form" portalToRoot><form noValidate className="grid gap-3" onSubmit={event => { event.preventDefault(); void execute("staff"); }}>
        <label>{vi ? "Kênh xác nhận" : "Confirmation channel"}<select value={channel} onChange={event => setChannel(event.target.value as StaffAcceptanceInput["channel"])} disabled={pending} className={controlClass("channel")}>
          {(["PHONE", "EMAIL", "GMAIL", "ZALO", "IN_PERSON", "OTHER"] as const).map(value => <option key={value} value={value}>{({ PHONE: vi ? "Điện thoại" : "Phone", EMAIL: "Email", GMAIL: "Gmail", ZALO: "Zalo", IN_PERSON: vi ? "Gặp trực tiếp" : "In person", OTHER: vi ? "Kênh khác" : "Other" })[value]}</option>)}</select>{fieldError("channel")}</label>
        <label>{vi ? "Thời gian khách hàng đồng ý" : "Customer agreement time"}<input type="datetime-local" required value={agreedAt} onChange={event => setAgreedAt(event.target.value)} disabled={pending} className={controlClass("customerAgreedAt")} aria-invalid={Boolean(fieldErrors.customerAgreedAt)} />{fieldError("customerAgreedAt")}</label>
        <label>{vi ? "Ghi chú / bằng chứng" : "Notes / evidence"}<textarea required maxLength={3500} value={evidence} onChange={event => setEvidence(event.target.value)} disabled={pending} className={controlClass("evidence")} aria-invalid={Boolean(fieldErrors.evidence)} />{fieldError("evidence")}</label>
        <label>{vi ? "Mã tham chiếu tệp đính kèm (nếu có)" : "Attachment reference (optional)"}<input value={attachment} onChange={event => setAttachment(event.target.value)} disabled={pending} className={controlClass("attachmentEvidenceId")} aria-invalid={Boolean(fieldErrors.attachmentEvidenceId)} />{fieldError("attachmentEvidenceId")}</label>
        <p className="text-sm">{vi ? "Tải tệp tại mục Bằng chứng của báo giá. Tệp cần hoàn tất kiểm tra an toàn trước khi sử dụng." : "Upload files in the quote Evidence section. Files must complete safety checks before use."}</p>
        <label className="flex gap-2"><input type="checkbox" checked={responsible} onChange={event => setResponsible(event.target.checked)} disabled={pending} aria-invalid={Boolean(fieldErrors.responsibilityConfirmed)} className={fieldErrors.responsibilityConfirmed ? "outline outline-1 outline-rose-500" : ""} />{vi ? "Tôi chịu trách nhiệm về thông tin ghi nhận khách hàng đã đồng ý." : "I take responsibility for recording the customer's agreement."}</label>{fieldError("responsibilityConfirmed")}
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        <div className="flex gap-2"><Button variant="primary" type="submit" disabled={pending}>{pending ? (vi ? "Đang lưu…" : "Saving…") : (vi ? "Lưu chấp nhận" : "Save acceptance")}</Button><Button type="button" variant="secondary" disabled={pending} onClick={guard.requestClose}>{vi ? "Hủy" : "Cancel"}</Button></div>
      </form></Modal>
    </>}
    <ConfirmDialog isOpen={guard.isConfirmOpen} onClose={() => guard.setIsConfirmOpen(false)} onConfirm={guard.confirmDiscard} title={vi ? "Bỏ thông tin chưa lưu?" : "Discard unsaved information?"} message={vi ? "Thông tin chấp nhận chưa được lưu." : "Acceptance information has not been saved."} confirmText={vi ? "Bỏ thay đổi" : "Discard"} cancelText={vi ? "Tiếp tục" : "Continue"} type="warning" />
    {error && !sendOpen && !open && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}

  </div>;
}

function actionBlocker(code: string, vi: boolean, quote?: Quote): string {
  if (code === "QUOTE_ACCEPTANCE_STATE_INVALID" && quote) {
    if (quote.archivedAt) return vi ? "Báo giá đã được lưu trữ." : "The Quote is archived.";
    if (quote.status === "ACCEPTED") return vi ? "Khách hàng đã chấp nhận báo giá." : "The Quote is already accepted.";
    if (quote.status === "REJECTED") return vi ? "Khách hàng đã từ chối báo giá." : "The Quote is rejected.";
    if (quote.status === "EXPIRED") return vi ? "Báo giá đã hết hiệu lực." : "The Quote has expired.";
    if (quote.status !== "SENT") return vi ? "Báo giá chưa được gửi hợp lệ. Gửi qua Gmail hoặc ghi nhận gửi qua kênh khác." : "Send the Quote or record delivery through another channel first.";
  }
  const labels: Record<string, [string, string]> = {
    ACTION_AUTHORITY_UNAVAILABLE: ["Chưa đọc được điều kiện thao tác từ máy chủ. Hãy tải lại báo giá.", "Server action eligibility is unavailable. Reload the Quote."],
    QUOTE_EXPIRED_OR_TIMEZONE_UNAVAILABLE: ["Báo giá đã hết hạn hoặc chưa xác định được múi giờ Workspace.", "The Quote is expired or the Workspace timezone is unavailable."],
    ACCESS_DENIED: ["Bạn chưa có đủ quyền cho thao tác này.", "You do not have the required access for this action."],
    GMAIL_WORKSPACE_NOT_ALLOWED: ["Workspace chưa được cho phép sử dụng Gmail hệ thống.", "This Workspace is not allowed to use the system Gmail sender."],
    GMAIL_NOT_CONFIGURED: ["SMTP hệ thống chưa sẵn sàng. Liên hệ quản trị viên.", "System SMTP is unavailable. Contact your administrator."],
    GMAIL_DELIVERY_UNRESOLVED: ["Lần gửi trước đang xử lý hoặc chưa rõ kết quả. Không gửi lại.", "An earlier send is in progress or unresolved. Do not resend."],
    QUOTE_RECIPIENT_REQUIRED: ["Cập nhật email người nhận trên báo giá trước khi gửi.", "Update the recipient email on the Quote before sending."],
    ACCEPTANCE_DOCUMENT_BINDING_INVALID: ["Cần PDF đã phát hành cho đúng phiên bản báo giá.", "An issued PDF for this Quote revision is required."],
    ACCEPTANCE_POLICY_DISABLED: ["Chính sách Workspace chưa cho phép phương thức này.", "Workspace policy does not allow this method."],
    VERIFIED_SIGNER_AUTHORITY_REQUIRED: ["Cần xác minh thẩm quyền người đại diện theo chính sách Workspace.", "Workspace policy requires verified signing authority."],
    ACCEPTANCE_RISK_LIMIT_EXCEEDED: ["Giá trị hoặc tiền tệ báo giá ngoài phạm vi chính sách chấp nhận.", "Quote value or currency is outside the acceptance policy."],
    QUOTE_ACCEPTANCE_STATE_INVALID: ["Báo giá chưa ở trạng thái cho phép thao tác này.", "The Quote is not in an eligible state for this action."],
    ACCEPTANCE_PUBLIC_ORIGIN_UNAVAILABLE: ["Địa chỉ liên kết khách hàng chưa được cấu hình hợp lệ.", "The customer-link origin is not configured correctly."],
    DOCUMENT_INTEGRITY_FAILED: ["Chưa xác minh được tính toàn vẹn PDF đã phát hành.", "The issued PDF integrity could not be verified."],
  };
  return labels[code]?.[vi ? 0 : 1] ?? (vi ? "Chưa đủ điều kiện thực hiện. Kiểm tra hiệu lực và nội dung báo giá." : "Requirements are incomplete. Review Quote validity and commercial content.");
}

function deliveryError(code: string, status: string, vi: boolean): string {
  if (status === "UNKNOWN" || status === "SENDING") return vi ? "Kết quả gửi chưa rõ. Không gửi lại yêu cầu này; cần kiểm tra bằng chứng từ nhà cung cấp." : "The send is unresolved. Do not resend; provider evidence must be reviewed.";
  if (code === "GMAIL_ACCEPTED_BINDING_CHANGED") return vi ? "SMTP đã tiếp nhận, nhưng báo giá thay đổi trong lúc gửi. Kiểm tra lại phiên bản PDF và liên kết khách hàng." : "SMTP accepted the message, but the Quote changed during sending. Review the PDF revision and customer link.";
  if (code === "GMAIL_WORKSPACE_NOT_ALLOWED" || code === "GMAIL_NOT_CONFIGURED" || code === "GMAIL_RECIPIENT_INVALID") return actionBlocker(code === "GMAIL_RECIPIENT_INVALID" ? "QUOTE_RECIPIENT_REQUIRED" : code, vi);
  if (code === "GMAIL_AUTHENTICATION_FAILED") return vi ? "SMTP xác thực thất bại. Liên hệ quản trị viên hệ thống." : "SMTP authentication failed. Contact your system administrator.";
  if (code === "GMAIL_TLS_FAILED") return vi ? "Không thiết lập được kết nối SMTP bảo mật." : "The secure SMTP connection could not be established.";
  return vi ? "Lần gửi thất bại. Kiểm tra kết nối và cấu hình SMTP trước khi thực hiện lần gửi mới." : "Sending failed. Review connectivity and SMTP configuration before starting a new send.";
}

function deliveryLabel(status: string, vi: boolean): string {
  const labels: Record<string, [string, string]> = {
    NOT_SENT: ["Chưa gửi", "Not sent"], SENDING: ["Đang gửi — kết quả chưa xác định", "Sending — outcome unresolved"],
    SENT: ["SMTP đã tiếp nhận", "SMTP accepted"], FAILED: ["Gửi thất bại", "Sending failed"], UNKNOWN: ["Kết quả gửi chưa xác định", "Delivery outcome unknown"],
  };
  return labels[status]?.[vi ? 0 : 1] ?? (vi ? "Kết quả gửi chưa xác định" : "Delivery outcome unknown");
}
