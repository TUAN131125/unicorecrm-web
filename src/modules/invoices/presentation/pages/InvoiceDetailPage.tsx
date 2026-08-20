import { formatApplicationError } from "@/shared/operations";
import React from "react";
import { Ban, Copy, Download, FileText, Link2, Mail, Pencil, Printer, ReceiptText, RotateCcw, Send, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input, Modal, SectionHeader, Select, Textarea } from "@/shared/components/ui";
import { RecordDetailFrame, RecordDetailHeader } from "@/components/crm/detail-archetype";
import { RecordHeaderActionMenu } from "@/components/crm/RecordHeaderActionMenu";
import type { ActionDropdownItem, ActionDropdownSection } from "@/components/crm/ActionDropdown";
import { CommercialDocumentPreviewModal } from "@/components/crm/commercial-documents";
import { ListDataTable, ListTableBody, ListTableCell, ListTableHead, ListTableHeaderCell, ListTableRow, ListTableSurface } from "@/components/crm/list-archetype";
import { notifyProduct, requestConfirmation, requestTextInput } from "@/components/feedback/ProductDialogService";
import { useI18n } from "@/i18n";
import { usePlatformState } from "@/platform/application-state";
import { toWorkspacePath } from "@/platform/navigation";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { compareMoney, formatMoneyDto, money, sumMoney } from "@/shared/money";
import { EvidencePanel } from "@/shared/evidence";
import { classifyMutationFailure, type MutationFailure } from "@/shared/operations";
import { getReasonCatalog } from "@/platform/configuration-runtime";
import { AuditTrailViewer } from "@/platform/audit";
import {
  createCreditNoteCanonical,
  discardInvoiceDraftCanonical,
  issueInvoiceCanonical,
  retryInvoiceIssueCanonical,
  sendInvoiceCanonical,
  voidInvoiceCanonical,
  type Invoice,
} from "../../public/api";
import { InvoiceStateBadge, SettlementBadge } from "./invoicePresentation";
import { useInvoiceDetailQuery } from "../hooks/useInvoiceVerticalSlice";

const durableId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
type BusyAction = "issue" | "send" | "credit" | "discard" | "void" | null;

function documentHtml(invoice: Invoice, locale: "vi" | "en"): string {
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const moneyLocale = locale === "vi" ? "vi-VN" : "en-US";
  const escape = (value: unknown) => String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const sellerName = invoice.sellerSnapshot.legalName ?? invoice.sellerSnapshot.displayName;
  const buyerName = invoice.buyerSnapshot.legalName ?? invoice.buyerSnapshot.displayName;
  const rows = invoice.lines.map((line, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td><div class="strong">${escape(line.description)}</div><div class="muted">${escape(line.skuSnapshot ?? line.productId ?? "—")}</div></td>
      <td class="right">${escape(line.quantity)} ${escape(line.unitOfMeasure ?? "")}</td>
      <td class="right">${escape(formatMoneyDto(line.unitPrice, moneyLocale))}</td>
      <td class="right strong">${escape(formatMoneyDto(line.lineTotal, moneyLocale))}</td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<title>${escape(invoice.invoiceNumber ?? invoice.id)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#eef2f7;padding:24px;color:#111827;font-family:"Times New Roman",Times,serif;font-size:13px;line-height:1.45}
.page{width:860px;min-height:1160px;margin:0 auto;background:#fff;padding:46px 54px;box-shadow:0 1px 4px rgba(15,23,42,.12)}
.header{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:36px;align-items:start;border-bottom:1px solid #64748b;padding-bottom:18px}
.company{font-size:18px;font-weight:600;text-transform:uppercase;line-height:1.35}.company-meta{margin-top:8px;color:#475569;font-size:12px;line-height:1.45}
.title{text-align:right}.title h1{margin:0;font-size:26px;line-height:1.2;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.reference{margin-top:7px;font-size:16px;font-weight:600}
.section{margin-top:24px}.section h2{margin:0 0 8px;border-bottom:1px solid #cbd5e1;padding-bottom:4px;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 34px}.info-row{display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;padding:3px 0}.label,.muted{color:#64748b}
.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px}.party-name{font-weight:600;margin-bottom:3px}.party p{margin:2px 0}
table{width:100%;border-collapse:collapse;font-size:12px}th{border-top:1px solid #64748b;border-bottom:1px solid #64748b;padding:7px 6px;text-align:left;font-weight:600}td{border-bottom:1px solid #cbd5e1;padding:8px 6px;vertical-align:top}.right{text-align:right}.center{text-align:center}.strong{font-weight:600}
.summary-wrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:36px}.notes{white-space:pre-wrap}.summary{border-top:1px solid #64748b;padding-top:5px}.summary-line{display:flex;justify-content:space-between;gap:24px;padding:3px 0}.summary-total{margin-top:6px;border-top:1px solid #64748b;padding-top:7px;font-size:15px;font-weight:600}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:12px}.signature{text-align:center;min-height:118px}.signature-title{font-weight:600}.signature-hint{font-size:11px;font-style:italic;color:#64748b;margin-top:2px}.signature-line{margin-top:70px;border-top:1px solid #cbd5e1;padding-top:3px;font-size:11px;color:#64748b}
.notice{margin-top:24px;border-top:1px solid #cbd5e1;padding-top:10px;text-align:center;color:#64748b;font-size:11px;font-style:italic}
@media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;padding:0;box-shadow:none}}
</style>
</head>
<body>
<div class="page">
  <header class="header">
    <div>
      <div class="company">${escape(invoice.sellerSnapshot.displayName || sellerName)}</div>
      <div class="company-meta">
        <div>${escape(invoice.sellerSnapshot.addressLines?.join(", ") || "—")}</div>
        <div>MST: ${escape(invoice.sellerSnapshot.taxId || "—")}</div>
        <div>${escape(invoice.sellerSnapshot.email || "—")}</div>
      </div>
    </div>
    <div class="title">
      <h1>${text("Hóa đơn", "Invoice")}</h1>
      <div class="reference">${escape(invoice.invoiceNumber ?? invoice.id)}</div>
    </div>
  </header>

  <section class="section">
    <h2>1. ${text("Thông tin chung", "General information")}</h2>
    <div class="info-grid">
      <div class="info-row"><div class="label">${text("Ngày lập", "Issue date")}</div><div>${escape(invoice.issueDate || "—")}</div></div>
      <div class="info-row"><div class="label">${text("Ngày đến hạn", "Due date")}</div><div>${escape(invoice.dueDate || "—")}</div></div>
      <div class="info-row"><div class="label">${text("Đơn hàng liên quan", "Related order")}</div><div>${escape(invoice.sourceLinks.orderId || "—")}</div></div>
      <div class="info-row"><div class="label">${text("Tiền tệ", "Currency")}</div><div>${escape(invoice.currency)}</div></div>
    </div>
  </section>

  <section class="section">
    <h2>2. ${text("Bên bán và bên mua", "Seller and buyer")}</h2>
    <div class="party-grid">
      <div class="party">
        <div class="party-name">${escape(sellerName)}</div>
        <p>MST: ${escape(invoice.sellerSnapshot.taxId || "—")}</p>
        <p>${escape(invoice.sellerSnapshot.addressLines?.join(", ") || "—")}</p>
        <p>${escape(invoice.sellerSnapshot.email || "—")}</p>
      </div>
      <div class="party">
        <div class="party-name">${escape(buyerName)}</div>
        <p>MST: ${escape(invoice.buyerSnapshot.taxId || "—")}</p>
        <p>${escape(invoice.buyerSnapshot.addressLines?.join(", ") || "—")}</p>
        <p>${escape(invoice.buyerSnapshot.email || "—")}</p>
      </div>
    </div>
  </section>

  <section class="section">
    <h2>3. ${text("Sản phẩm và dịch vụ", "Products and services")}</h2>
    <table>
      <thead><tr><th class="center" style="width:38px">#</th><th>${text("Mô tả", "Description")}</th><th class="right" style="width:90px">${text("Số lượng", "Quantity")}</th><th class="right" style="width:120px">${text("Đơn giá", "Unit price")}</th><th class="right" style="width:130px">${text("Thành tiền", "Amount")}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>

  <section class="section">
    <div class="summary-wrap">
      <div>
        <h2>4. ${text("Ghi chú", "Notes")}</h2>
        <div class="notes">${escape(invoice.paymentTerms || text("Theo điều khoản thanh toán đã xác nhận.", "According to the confirmed payment terms."))}</div>
      </div>
      <div class="summary">
        <div class="summary-line"><span>${text("Tạm tính", "Subtotal")}</span><span>${escape(formatMoneyDto(invoice.totals.subtotal, moneyLocale))}</span></div>
        <div class="summary-line"><span>${text("Chiết khấu", "Discount")}</span><span>${escape(formatMoneyDto(invoice.totals.discountTotal, moneyLocale))}</span></div>
        <div class="summary-line"><span>${text("Thuế", "Tax")}</span><span>${escape(formatMoneyDto(invoice.totals.taxTotal, moneyLocale))}</span></div>
        <div class="summary-line summary-total"><span>${text("Tổng thanh toán", "Grand total")}</span><span>${escape(formatMoneyDto(invoice.totals.grandTotal, moneyLocale))}</span></div>
      </div>
    </div>
  </section>

  <section class="section">
    <h2>5. ${text("Xác nhận", "Confirmation")}</h2>
    <div class="signatures">
      <div class="signature"><div class="signature-title">${text("Đại diện bên bán", "Seller representative")}</div><div class="signature-hint">${text("Ký và ghi rõ họ tên", "Sign and print name")}</div><div class="signature-line">${text("Ngày …… / …… / …………", "Date …… / …… / …………")}</div></div>
      <div class="signature"><div class="signature-title">${text("Bên mua xác nhận", "Buyer confirmation")}</div><div class="signature-hint">${text("Ký và ghi rõ họ tên", "Sign and print name")}</div><div class="signature-line">${text("Ngày …… / …… / …………", "Date …… / …… / …………")}</div></div>
    </div>
  </section>

  <div class="notice">${text("Hóa đơn phản ánh nghĩa vụ thanh toán; trạng thái thu tiền được theo dõi riêng trong phân hệ Thanh toán.", "This invoice records the payment obligation; collection status is tracked separately in Payments.")}</div>
</div>
</body>
</html>`;
}

export const InvoiceDetailPage: React.FC = () => {
  const { invoiceId = "" } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const operationGuide = {
    title: locale === "vi" ? "Hướng dẫn thao tác Hóa đơn" : "Invoice operation guide",
    steps: locale === "vi" ? [
      "Kiểm tra bên mua, các dòng hàng và tổng tiền trước khi phát hành.",
      "Hiệu chỉnh chỉ khả dụng khi Hóa đơn còn ở trạng thái nháp.",
      "Phát hành Hóa đơn trước khi gửi cho khách hàng.",
      "Dùng menu ba chấm để xem trước, tải, in, gửi hoặc mở Công nợ.",
      "Dùng Credit Note hoặc Void theo đúng quyền và trạng thái nghiệp vụ.",
    ] : [
      "Review buyer, invoice lines, and totals before issuance.",
      "Editing is available only while the invoice remains a draft.",
      "Issue the invoice before customer delivery.",
      "Use the three-dot menu to preview, download, print, send, or open Receivables.",
      "Use Credit Note or Void according to permissions and lifecycle state.",
    ],
  } as const;
  const { activeWorkspace } = usePlatformState();
  const access = useEffectiveAccess();
  const invoiceQuery = useInvoiceDetailQuery(invoiceId);
  const invoice = invoiceQuery.data?.invoice;
  const receivable = invoiceQuery.data?.receivable;
  const deliveries = invoiceQuery.data?.deliveries ?? [];
  const creditNotes = invoiceQuery.data?.creditNotes ?? [];
  const allocations = invoiceQuery.data?.allocations ?? [];
  const [busyAction, setBusyAction] = React.useState<BusyAction>(null);
  const [mutationFailure, setMutationFailure] = React.useState<MutationFailure | null>(null);
  const [creditOpen, setCreditOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [creditLineAmounts, setCreditLineAmounts] = React.useState<Record<string, string>>({});
  const creditReasons = getReasonCatalog("CREDIT_NOTE")?.entries.filter((entry) => entry.enabled) ?? [];
  const [creditReasonCode, setCreditReasonCode] = React.useState(creditReasons[0]?.code ?? "COMMERCIAL_ADJUSTMENT");
  const [creditReason, setCreditReason] = React.useState("");
  const [creditError, setCreditError] = React.useState("");
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const path = (value: string) => toWorkspacePath(activeWorkspace.workspaceKey, "crm", value);

  if (!invoice) return <RecordDetailFrame id="invoice-detail-not-found"><Card><p className="text-sm text-slate-600">{invoiceQuery.loading ? text("Đang tải hóa đơn authoritative…", "Loading authoritative invoice…") : invoiceQuery.state === "ERROR" ? text("Không thể tải hóa đơn.", "Invoice could not be loaded.") : text("Không tìm thấy hóa đơn.", "Invoice not found.")}</p><div className="mt-4 flex gap-2">{invoiceQuery.state === "ERROR" && <Button variant="secondary" onClick={() => void invoiceQuery.refresh()}>{text("Thử lại", "Retry")}</Button>}<Button onClick={() => navigate(path("invoices"))}>{text("Quay lại", "Back")}</Button></div></Card></RecordDetailFrame>;

  const formatMoney = (value: typeof invoice.totals.grandTotal) => formatMoneyDto(value, locale === "vi" ? "vi-VN" : "en-US");
  const invoiceUrl = `${window.location.origin}${window.location.pathname}#${path(`invoices/${invoice.id}`)}`;
  const run = async (action: Exclude<BusyAction, null>, operation: () => Promise<unknown>, successMessage: string) => {
    setBusyAction(action);
    setMutationFailure(null);
    try {
      await operation();
      notifyProduct(successMessage, "success");
    } catch (error) {
      const failure = classifyMutationFailure(error);
      setMutationFailure(failure);
      notifyProduct(failure.message, "danger");
    } finally {
      setBusyAction(null);
    }
  };
  const downloadDocument = () => {
    const blob = new Blob([documentHtml(invoice, locale)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${invoice.invoiceNumber ?? invoice.id}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const printDocument = () => {
    const frame = window.open("", "_blank", "noopener,noreferrer");
    if (!frame) return;
    frame.document.write(documentHtml(invoice, locale));
    frame.document.close();
    frame.focus();
    frame.print();
  };
  const copyLink = async () => { await navigator.clipboard.writeText(invoiceUrl); notifyProduct(text("Đã sao chép link hóa đơn.", "Invoice link copied."), "success"); };
  const handleIssue = () => run("issue", () => invoice.lifecycleState === "ISSUE_FAILED" ? retryInvoiceIssueCanonical(invoice.id, { expectedVersion: invoice.version }) : issueInvoiceCanonical(invoice.id, { expectedVersion: invoice.version }), text("Hóa đơn đã được phát hành từ adapter authoritative.", "Invoice issued by the authoritative adapter."));
  const handleSend = async () => {
    const recipient = await requestTextInput({ title: text("Gửi hóa đơn", "Send invoice"), description: text("Kết quả gửi chỉ được ghi nhận sau khi adapter trả về delivery evidence.", "Delivery is recorded only after the adapter returns delivery evidence."), label: "Email", placeholder: invoice.buyerSnapshot.email ?? "finance@example.com", submitLabel: text("Gửi", "Send"), cancelLabel: text("Hủy", "Cancel"), requiredMessage: text("Email người nhận là bắt buộc.", "Recipient email is required.") });
    if (!recipient) return;
    await run("send", () => sendInvoiceCanonical(invoice.id, { expectedVersion: invoice.version, channel: "EMAIL", recipient, idempotencyKey: durableId(`send_${invoice.id}`) }), text("Đã ghi nhận delivery evidence.", "Delivery evidence recorded."));
  };
  const handleDiscard = async () => {
    const confirmed = await requestConfirmation({ title: text("Loại bỏ hóa đơn nháp", "Discard draft invoice"), message: text("Hóa đơn nháp sẽ chuyển sang DISCARDED và không thể phát hành.", "The draft will move to DISCARDED and cannot be issued."), confirmLabel: text("Loại bỏ", "Discard"), cancelLabel: text("Giữ lại", "Keep"), tone: "danger" });
    if (!confirmed) return;
    await run("discard", () => discardInvoiceDraftCanonical(invoice.id, { expectedVersion: invoice.version }), text("Đã loại bỏ hóa đơn nháp.", "Draft invoice discarded."));
    navigate(path("invoices"));
  };
  const handleVoid = async () => {
    const options = getReasonCatalog("INVOICE_VOID")?.entries.filter((entry) => entry.enabled) ?? [];
    const reason = await requestTextInput({ title: text("Void hóa đơn đã phát hành", "Void issued invoice"), description: `${text("Chọn mã lý do được cấu hình và ghi chú cụ thể.", "Use a configured reason code and provide a specific note.")} ${options.map((entry) => `${entry.code}: ${locale === "vi" ? entry.labelVi : entry.labelEn}`).join(" · ")}`, label: text("Mã lý do và ghi chú", "Reason code and note"), submitLabel: "Void", cancelLabel: text("Hủy", "Cancel"), requiredMessage: text("Lý do là bắt buộc.", "A reason is required.") });
    if (!reason) return;
    await run("void", () => voidInvoiceCanonical(invoice.id, { expectedVersion: invoice.version, reason }), text("Hóa đơn đã chuyển sang VOIDED.", "Invoice moved to VOIDED."));
  };
  const handleCreditNote = async () => {
    setCreditError("");
    try {
      const lines = invoice.lines.flatMap((line) => {
        const raw = creditLineAmounts[line.id]?.trim();
        if (!raw || Number(raw) <= 0) return [];
        const amount = money(raw, invoice.currency);
        if (compareMoney(amount, line.lineTotal) > 0) throw new Error(text(`Điều chỉnh dòng ${line.description} vượt giá trị dòng.`, `Adjustment for ${line.description} exceeds the line value.`));
        return [{ invoiceLineId: line.id, description: line.description, quantity: line.quantity, reasonCode: creditReasonCode, amount }];
      });
      if (lines.length === 0) throw new Error(text("Nhập giá trị điều chỉnh cho ít nhất một dòng.", "Enter an adjustment for at least one line."));
      const total = sumMoney(lines.map((line) => line.amount), invoice.currency);
      if (receivable && compareMoney(total, receivable.outstandingAmount) > 0) throw new Error(text("Credit Note không được vượt số dư công nợ hiện tại.", "Credit Note cannot exceed the current outstanding balance."));
      if (!creditReason.trim()) throw new Error(text("Lý do điều chỉnh là bắt buộc.", "Adjustment reason is required."));
      await run("credit", () => createCreditNoteCanonical({ invoiceId: invoice.id, expectedInvoiceVersion: invoice.version, reasonCode: creditReasonCode, reason: creditReason.trim(), lines, idempotencyKey: durableId(`credit_${invoice.id}`) }), text("Credit Note đã được phát hành.", "Credit Note issued."));
      setCreditOpen(false); setCreditLineAmounts({}); setCreditReason("");
    } catch (error) { setCreditError(formatApplicationError(error, { locale, fallbackMessage: text("Dữ liệu Credit Note không hợp lệ.", "Invalid Credit Note data.") })); }
  };

  const canEdit = invoice.lifecycleState === "DRAFT" && access.can(CAPABILITIES.INVOICES_UPDATE_DRAFT);
  const canIssue = ["DRAFT", "ISSUE_FAILED"].includes(invoice.lifecycleState) && access.can(invoice.lifecycleState === "ISSUE_FAILED" ? CAPABILITIES.INVOICES_RETRY_ISSUE : CAPABILITIES.INVOICES_ISSUE);
  const canSend = invoice.lifecycleState === "ISSUED" && access.can(CAPABILITIES.INVOICES_SEND);
  const canCredit = invoice.lifecycleState === "ISSUED" && access.can(CAPABILITIES.INVOICES_CREATE_CREDIT_NOTE) && Boolean(receivable && compareMoney(receivable.outstandingAmount, money("0", invoice.currency)) > 0);
  const canDiscard = invoice.lifecycleState === "DRAFT" && access.can(CAPABILITIES.INVOICES_DISCARD_DRAFT);
  const canVoid = invoice.lifecycleState === "ISSUED" && access.can(CAPABILITIES.INVOICES_VOID);

  const primaryActionId = canIssue ? "issue" : canSend ? "send" : canEdit ? "edit" : canCredit ? "credit" : undefined;
  const actionItems: ActionDropdownItem[] = [
    { id: "preview", label: text("Xem trước", "Preview"), icon: <FileText size={14} />, onClick: () => setPreviewOpen(true) },
    { id: "download", label: text("Tải tài liệu", "Download document"), icon: <Download size={14} />, onClick: downloadDocument },
    { id: "print", label: text("In", "Print"), icon: <Printer size={14} />, onClick: printDocument },
    { id: "copy-link", label: text("Sao chép link", "Copy link"), icon: <Link2 size={14} />, onClick: () => { void copyLink(); } },
    ...(canEdit && primaryActionId !== "edit" ? [{ id: "edit", label: text("Hiệu chỉnh", "Edit"), icon: <Pencil size={14} />, onClick: () => navigate(path(`invoices/${invoice.id}/edit`)) }] : []),
    ...(canIssue && primaryActionId !== "issue" ? [{ id: "issue", label: invoice.lifecycleState === "ISSUE_FAILED" ? text("Thử phát hành lại", "Retry issue") : text("Phát hành", "Issue"), icon: invoice.lifecycleState === "ISSUE_FAILED" ? <RotateCcw size={14} /> : <Send size={14} />, onClick: handleIssue, disabled: busyAction === "issue", variant: "primary" as const }] : []),
    ...(canSend && primaryActionId !== "send" ? [{ id: "send", label: deliveries.length ? text("Gửi lại", "Resend") : text("Gửi hóa đơn", "Send invoice"), icon: <Mail size={14} />, onClick: () => { void handleSend(); }, disabled: busyAction === "send", variant: "primary" as const }] : []),
    ...(canCredit && primaryActionId !== "credit" ? [{ id: "credit", label: text("Phiếu điều chỉnh", "Credit Note"), icon: <ReceiptText size={14} />, onClick: () => setCreditOpen(true), variant: "warning" as const }] : []),
    ...(receivable ? [{ id: "receivable", label: text("Xem công nợ", "View receivable"), icon: <ReceiptText size={14} />, onClick: () => navigate(path(`receivables/${invoice.id}`)) }] : []),
    ...(canDiscard ? [{ id: "discard", label: text("Loại bỏ", "Discard"), icon: <Trash2 size={14} />, onClick: () => { void handleDiscard(); }, disabled: busyAction === "discard", destructive: true }] : []),
    ...(canVoid ? [{ id: "void", label: "Void", icon: <Ban size={14} />, onClick: () => { void handleVoid(); }, disabled: busyAction === "void", destructive: true }] : []),
  ];
  const headerMenuSections: ActionDropdownSection[] = [{ id: "invoice-actions", title: text("THAO TÁC HÓA ĐƠN", "INVOICE ACTIONS"), items: actionItems }];

  const primaryAction = primaryActionId === "issue"
    ? <Button size="sm" actionIntent={invoice.lifecycleState === "ISSUE_FAILED" ? "retry" : "confirm"} icon={invoice.lifecycleState === "ISSUE_FAILED" ? <RotateCcw size={14} /> : <Send size={14} />} loading={busyAction === "issue"} onClick={handleIssue}>{invoice.lifecycleState === "ISSUE_FAILED" ? text("Thử phát hành lại", "Retry issue") : text("Phát hành", "Issue")}</Button>
    : primaryActionId === "send"
      ? <Button size="sm" actionIntent="sync" icon={<Mail size={14} />} loading={busyAction === "send"} onClick={() => { void handleSend(); }}>{deliveries.length ? text("Gửi lại", "Resend") : text("Gửi hóa đơn", "Send")}</Button>
      : primaryActionId === "edit"
        ? <Button size="sm" actionIntent="navigate" icon={<Pencil size={14} />} onClick={() => navigate(path(`invoices/${invoice.id}/edit`))}>{text("Hiệu chỉnh", "Edit")}</Button>
        : primaryActionId === "credit"
          ? <Button size="sm" actionIntent="create" icon={<ReceiptText size={14} />} onClick={() => setCreditOpen(true)}>{text("Phiếu điều chỉnh", "Credit Note")}</Button>
          : null;

  return <RecordDetailFrame id="invoice-detail-page">
    <RecordDetailHeader
      backLabel={text("Quay lại danh sách hóa đơn", "Back to invoices")}
      onBack={() => navigate(path("invoices"))}
      identityIcon={<FileText size={20} />}
      identityToneClassName="border-violet-200 bg-violet-50 text-violet-700"
      title={invoice.invoiceNumber ?? text("Hóa đơn nháp", "Draft invoice")}
      status={<InvoiceStateBadge state={invoice.lifecycleState} />}
      metadata={<><span>{invoice.buyerSnapshot.displayName}</span><span>{invoice.sourceLinks.orderId ?? text("Không gắn đơn hàng", "No linked order")}</span><span>{invoice.issueDate ?? text("Chưa phát hành", "Not issued")}</span></>}
      actions={(
        <div className="flex items-center gap-2">
          {primaryAction}
          <RecordHeaderActionMenu
            sections={headerMenuSections}
            label={text("Thao tác khác", "More actions")}
            guide={operationGuide}
            guideLabel={text("Hướng dẫn thao tác", "Operation guide")}
            closeGuideLabel={text("Đã hiểu", "Got it")}
          />
        </div>
      )}
      actionsPlacement="inline"
    />

    {mutationFailure && <Card className={`border ${mutationFailure.state === "CONFLICTED" ? "border-amber-300 bg-amber-50" : "border-rose-200 bg-rose-50"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p role="alert" className="text-sm font-semibold text-slate-900">{mutationFailure.state === "CONFLICTED" ? text("Hóa đơn đã được cập nhật ở nơi khác.", "The invoice was updated elsewhere.") : mutationFailure.message}</p>{mutationFailure.state === "CONFLICTED" && <p className="mt-1 text-xs text-slate-600">{text("Tải lại bản authoritative trước khi thực hiện lại thao tác.", "Refresh the authoritative version before retrying the action.")}</p>}</div>{mutationFailure.state === "CONFLICTED" && <Button variant="secondary" onClick={() => { setMutationFailure(null); void invoiceQuery.refresh(); }}>{text("Tải lại", "Refresh")}</Button>}</div></Card>}

    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><SectionHeader title={text("Nội dung chứng từ", "Document content")} /><div className="mb-5 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-semibold text-slate-500">{text("Bên bán", "Seller")}</p><p className="mt-1 font-semibold text-slate-900">{invoice.sellerSnapshot.legalName ?? invoice.sellerSnapshot.displayName}</p><p className="text-sm text-slate-500">{invoice.sellerSnapshot.taxId ?? "—"}</p><p className="text-xs text-slate-400">{invoice.sellerSnapshot.addressLines.join(", ")}</p></div><div><p className="text-xs font-semibold text-slate-500">{text("Bên mua", "Buyer")}</p><p className="mt-1 font-semibold text-slate-900">{invoice.buyerSnapshot.legalName ?? invoice.buyerSnapshot.displayName}</p><p className="text-sm text-slate-500">{invoice.buyerSnapshot.taxId ?? "—"}</p><p className="text-xs text-slate-400">{invoice.buyerSnapshot.addressLines.join(", ")}</p></div></div>
        <ListTableSurface surfaceId="invoice-lines"><ListDataTable minWidth={760}><ListTableHead><tr><ListTableHeaderCell>{text("Nội dung", "Description")}</ListTableHeaderCell><ListTableHeaderCell align="center">{text("Số lượng", "Quantity")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Trước thuế", "Net")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Thuế", "Tax")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Thành tiền", "Line total")}</ListTableHeaderCell></tr></ListTableHead><ListTableBody>{invoice.lines.map((line) => <ListTableRow key={line.id}><ListTableCell><div className="font-semibold text-slate-900">{line.description}</div><div className="mt-0.5 text-[10px] text-slate-400">{line.skuSnapshot ?? line.productId ?? ""}</div></ListTableCell><ListTableCell align="center">{line.quantity} {line.unitOfMeasure}</ListTableCell><ListTableCell align="right">{formatMoney(money(String(Number(line.lineTotal.amount) - Number(line.taxAmount.amount)), invoice.currency))}</ListTableCell><ListTableCell align="right">{formatMoney(line.taxAmount)}</ListTableCell><ListTableCell align="right" className="whitespace-nowrap font-semibold text-slate-950">{formatMoney(line.lineTotal)}</ListTableCell></ListTableRow>)}</ListTableBody></ListDataTable></ListTableSurface>
        <div className="ml-auto mt-5 max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatMoney(invoice.totals.subtotal)}</span></div><div className="flex justify-between"><span className="text-slate-500">Discount</span><span>{formatMoney(invoice.totals.discountTotal)}</span></div><div className="flex justify-between"><span className="text-slate-500">Tax</span><span>{formatMoney(invoice.totals.taxTotal)}</span></div><div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold"><span>Total</span><span>{formatMoney(invoice.totals.grandTotal)}</span></div></div>
      </Card>
      <div className="space-y-4"><Card><SectionHeader title={text("Trạng thái", "Status")} /><div className="space-y-3 text-sm"><div className="flex items-center justify-between"><span className="text-slate-500">Lifecycle</span><InvoiceStateBadge state={invoice.lifecycleState} /></div><div className="flex justify-between"><span className="text-slate-500">Delivery</span><span className="font-medium">{invoice.deliveryState}</span></div>{receivable && <div className="flex items-center justify-between"><span className="text-slate-500">Settlement</span><SettlementBadge state={receivable.settlementState} /></div>}</div></Card><Card><SectionHeader title={text("Nguồn nghiệp vụ", "Business sources")} /><dl className="space-y-3 text-sm"><div><dt className="text-slate-500">Order</dt><dd><button type="button" className="font-medium text-violet-700" onClick={() => invoice.sourceLinks.orderId && navigate(path(`orders/${invoice.sourceLinks.orderId}`))}>{invoice.sourceLinks.orderId ?? "—"}</button></dd></div><div><dt className="text-slate-500">Due date</dt><dd className="font-medium">{invoice.dueDate ?? "—"}</dd></div><div><dt className="text-slate-500">Version</dt><dd className="font-medium">{invoice.version}</dd></div></dl></Card>{invoice.lifecycleState === "ISSUED" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{text("Nội dung thương mại đã khóa sau khi phát hành. Điều chỉnh phải đi qua Credit Note hoặc void có kiểm soát.", "Commercial content is locked after issue. Adjustments require a Credit Note or controlled void.")}</div>}</div>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><SectionHeader title={text("Phân bổ và công nợ", "Allocations and receivable")} />{allocations.length === 0 ? <p className="text-sm text-slate-500">{text("Chưa có phân bổ thanh toán.", "No payment allocations yet.")}</p> : <div className="space-y-2">{allocations.map((allocation) => <button key={allocation.id} type="button" className="flex w-full justify-between rounded-xl border border-slate-200 p-3 text-left" onClick={() => allocation.paymentRecordId && navigate(path(`payments/${allocation.paymentRecordId}`))}><span className="font-medium">{allocation.id}</span><span>{formatMoney(allocation.amount)} · {allocation.state}</span></button>)}</div>}</Card>
      <Card><SectionHeader title={text("Phiếu điều chỉnh", "Credit Notes")} />{creditNotes.length === 0 ? <p className="text-sm text-slate-500">{text("Chưa có Credit Note.", "No Credit Notes.")}</p> : <div className="space-y-2">{creditNotes.map((note) => <div key={note.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between"><strong>{note.creditNoteNumber}</strong><span>{formatMoney(note.total)}</span></div><div className="mt-1 text-xs text-slate-500">{note.reasonCode} · {note.reason}</div></div>)}</div>}</Card>
      <Card><SectionHeader title={text("Lịch sử gửi", "Send history")} />{deliveries.length === 0 ? <p className="text-sm text-slate-500">{text("Chưa gửi chứng từ.", "Document has not been sent.")}</p> : <div className="space-y-2">{deliveries.map((delivery) => <div key={delivery.id} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex justify-between"><strong>{delivery.channel}</strong><span>{delivery.state}</span></div><div className="mt-1 text-xs text-slate-500">{delivery.recipient ?? "—"} · {delivery.sentAt ?? delivery.createdAt}</div></div>)}</div>}</Card>
      <Card><SectionHeader title={text("Lịch sử kiểm toán", "Audit history")} /><AuditTrailViewer resourceKey="invoices" recordId={invoice.id} embedded /></Card>
    </div>
    {invoice.issueEvidence?.length ? <EvidencePanel title={text("Bằng chứng phát hành", "Issue evidence")} items={invoice.issueEvidence} locale={locale} /> : null}

    <CommercialDocumentPreviewModal
      id="invoice-a4-preview-modal"
      isOpen={previewOpen}
      onClose={() => setPreviewOpen(false)}
      title={text("Xem trước hóa đơn", "Invoice preview")}
    >
      <iframe
        title={text("Xem trước hóa đơn", "Invoice preview")}
        srcDoc={documentHtml(invoice, locale)}
        className="h-[1280px] w-[920px] border-0 bg-white"
      />
    </CommercialDocumentPreviewModal>
    <Modal isOpen={creditOpen} onClose={() => setCreditOpen(false)} title={text("Phát hành Credit Note theo dòng", "Issue line-level Credit Note")} size="sm" variant="form" footer={<><Button variant="secondary" onClick={() => setCreditOpen(false)}>{text("Hủy", "Cancel")}</Button><Button actionIntent="confirm" loading={busyAction === "credit"} onClick={() => { void handleCreditNote(); }}>{text("Phát hành", "Issue")}</Button></>}>
      <div className="space-y-4"><p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">{text("Chỉ nhập giá trị cần điều chỉnh tại từng dòng. Hóa đơn gốc không bị sửa.", "Enter the adjustment amount per line. The original Invoice remains unchanged.")}</p><Select label={text("Mã lý do", "Reason code")} value={creditReasonCode} onChange={(event) => setCreditReasonCode(event.target.value)}>{creditReasons.length ? creditReasons.map((entry) => <option key={entry.code} value={entry.code}>{entry.code} · {locale === "vi" ? entry.labelVi : entry.labelEn}</option>) : <option value="COMMERCIAL_ADJUSTMENT">COMMERCIAL_ADJUSTMENT</option>}</Select><div className="space-y-2">{invoice.lines.map((line) => <div key={line.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_180px]"><div><div className="font-semibold text-slate-900">{line.description}</div><div className="text-xs text-slate-500">{text("Giá trị dòng", "Line value")}: {formatMoney(line.lineTotal)}</div></div><Input label={text("Giá trị điều chỉnh", "Adjustment")} value={creditLineAmounts[line.id] ?? ""} onChange={(event) => { setCreditLineAmounts((current) => ({ ...current, [line.id]: event.target.value })); setCreditError(""); }} placeholder="0" /></div>)}</div><Textarea label={text("Ghi chú lý do", "Reason note")} value={creditReason} onChange={(event) => { setCreditReason(event.target.value); setCreditError(""); }} rows={3} />{creditError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{creditError}</p>}</div>
    </Modal>
  </RecordDetailFrame>;
};
