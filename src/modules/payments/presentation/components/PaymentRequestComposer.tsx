import React, { useMemo, useState } from "react";
import { Copy, Download, ExternalLink, Mail, QrCode, RotateCcw } from "lucide-react";
import { Button, Modal } from "@/shared/components/ui";
import type { CustomerOrder } from "@/modules/orders";
import { buildLocalVietQrPayload, getPaymentConfigurationSnapshot, renderPaymentTransferContent } from "../../public/api";
import { createDurableId } from "@/shared/ids";
import { formatMoneyDto } from "@/shared/money";
import { useMutationTask } from "@/shared/operations";
import { recordPaymentRequestDeliveryCanonical, type PaymentIntent, type PaymentRequestDelivery } from "../../public/api";

export interface PaymentRequestComposerProps {
  intent: PaymentIntent;
  order?: CustomerOrder;
  actorId: string;
  actorName?: string;
  locale: "vi" | "en";
  onClose: () => void;
}

function QrPreview({ payload }: { payload: string }) {
  const cells = useMemo(() => {
    let state = 2166136261;
    for (const char of payload) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
    return Array.from({ length: 225 }, (_, index) => {
      state = Math.imul(state ^ (index + 1), 2246822519) >>> 0;
      const row = Math.floor(index / 15);
      const column = index % 15;
      return (row < 5 && column < 5) || (row < 5 && column > 9) || (row > 9 && column < 5) || (state & 1) === 1;
    });
  }, [payload]);
  return <div className="grid aspect-square w-48 grid-cols-[repeat(15,minmax(0,1fr))] gap-px rounded-xl border-8 border-white bg-white shadow">{cells.map((filled, index) => <span key={index} className={filled ? "bg-slate-950" : "bg-white"} />)}</div>;
}

function formatDateTime(value: string, locale: "vi" | "en") {
  return new Date(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
}

export const PaymentRequestComposer: React.FC<PaymentRequestComposerProps> = ({ intent, order, locale, onClose }) => {
  const configuration = getPaymentConfigurationSnapshot();
  const account = configuration.receivingAccounts.find((item) => item.active && item.isDefaultForCurrency && item.currency === intent.amount.currency)
    ?? configuration.receivingAccounts.find((item) => item.active && item.currency === intent.amount.currency);
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const mutation = useMutationTask<PaymentIntent>();
  const effectiveIntent = mutation.snapshot.authoritativeEntity ?? intent;
  const communicationHistory = effectiveIntent.communicationHistory ?? [];
  const [showQr, setShowQr] = useState(false);
  const orderNumber = order?.orderNumber ?? intent.orderId ?? "—";
  const buyerName = order?.customerName || order?.contactName || order?.recipientName || intent.buyerRef.id;
  const buyerCode = order?.customerId || intent.buyerRef.id;
  const transferContent = renderPaymentTransferContent(configuration.qrPolicy.transferContentTemplate, orderNumber);
  const link = intent.checkoutUrl ?? `payment-request:${intent.id}`;
  const amountLabel = formatMoneyDto(intent.amount, locale === "vi" ? "vi-VN" : "en-US");
  const content = [
    text(`Yêu cầu thanh toán cho ${orderNumber}`, `Payment request for ${orderNumber}`),
    `${text("Khách hàng", "Customer")}: ${buyerName}`,
    `${text("Mã tham chiếu", "Reference")}: ${buyerCode}`,
    `${text("Mục đích", "Purpose")}: ${intent.purpose ?? "OTHER"}`,
    `${text("Số tiền yêu cầu", "Requested amount")}: ${amountLabel}`,
    `${text("Hạn thanh toán", "Expires")}: ${formatDateTime(intent.expiresAt, locale)}`,
    account ? `${account.bankName} · ${account.accountNumber} · ${account.accountHolder}` : "",
    `${text("Nội dung chuyển khoản", "Transfer content")}: ${transferContent}`,
    `${text("Liên kết", "Link")}: ${link}`,
    text("Sau khi thanh toán, doanh nghiệp chỉ ghi nhận tiền khi có Payment Record authoritative.", "After payment, funds are recognized only after an authoritative Payment Record exists."),
  ].filter(Boolean).join("\n");
  const qrPayload = account ? buildLocalVietQrPayload({ bankBin: account.bankBin, accountNumber: account.accountNumber, amount: Number(intent.amount.amount), transferContent }) : link;

  const record = async (
    channel: PaymentRequestDelivery["channel"],
    renderedContent = content,
    sourceIntent: PaymentIntent = effectiveIntent,
  ) => mutation.run(() => recordPaymentRequestDeliveryCanonical(sourceIntent.id, {
    expectedVersion: sourceIntent.version,
    idempotencyKey: createDurableId("payment_request_delivery"),
    channel,
    templateKey: sourceIntent.purpose === "DEPOSIT" ? "payment-request-deposit" : sourceIntent.purpose === "INSTALLMENT" ? "payment-request-installment" : sourceIntent.purpose === "OVERDUE_REMINDER" ? "payment-request-overdue" : "payment-request-full",
    renderedContent,
  }).then((outcome) => outcome.data));

  const copy = async (value: string, channel: PaymentRequestDelivery["channel"]) => {
    await navigator.clipboard.writeText(value);
    await record(channel, value);
  };

  const email = async () => {
    await record("EMAIL", content);
    window.location.href = `mailto:?subject=${encodeURIComponent(`${text("Yêu cầu thanh toán", "Payment request")} ${orderNumber}`)}&body=${encodeURIComponent(content)}`;
  };

  const retryDelivery = async (delivery: PaymentRequestDelivery) => {
    await record(delivery.channel, delivery.renderedContent);
  };

  const htmlDocument = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<title>${text("Yêu cầu thanh toán", "Payment request")} ${orderNumber}</title>
<style>
body{font-family:Arial,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}
.page{max-width:980px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:20px;padding:32px}
.header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #0f172a;padding-bottom:24px}
.logo{width:112px;height:112px;border:2px dashed #94a3b8;border-radius:16px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#64748b;background:#f8fafc}
.title{font-size:36px;font-weight:800;text-transform:uppercase;margin:0}
.section{margin-top:20px;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden}
.section h2{margin:0;background:#0f172a;color:#fff;padding:12px 16px;font-size:14px;text-transform:uppercase}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px}
.row{display:grid;grid-template-columns:180px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid #e2e8f0}
.row:last-child{border-bottom:none}
.label{font-weight:700;color:#64748b}
.table{width:100%;border-collapse:collapse}
.table th,.table td{padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px}
.table th{background:#f8fafc;text-transform:uppercase;font-size:11px}
.summary{padding:16px}
.summary .line{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e8f0}
.summary .line:last-child{border-bottom:none;font-weight:800}
.note{margin-top:20px;font-size:13px;color:#475569;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px;font-style:italic}
</style>
</head>
<body>
<div class="page">
<div class="header"><div><div class="logo">QR</div></div><div style="flex:1"><h1 class="title">${text("Mẫu yêu cầu thanh toán", "Payment request")}</h1><div style="margin-top:8px;font-size:20px;font-weight:700">${orderNumber}</div><div style="margin-top:12px;color:#475569">${text("Tài liệu thu tiền gửi khách hàng", "Customer-facing payment collection document")}</div></div></div>
<div class="section"><h2>1. ${text("Thông tin yêu cầu", "Request information")}</h2><div class="grid"><div>
<div class="row"><div class="label">${text("Số yêu cầu", "Request no.")}</div><div>${intent.id}</div></div>
<div class="row"><div class="label">${text("Ngày tạo", "Created")}</div><div>${formatDateTime(intent.createdAt, locale)}</div></div>
<div class="row"><div class="label">${text("Mục đích", "Purpose")}</div><div>${intent.purpose ?? "OTHER"}</div></div>
<div class="row"><div class="label">${text("Hạn thanh toán", "Expires")}</div><div>${formatDateTime(intent.expiresAt, locale)}</div></div>
</div><div>
<div class="row"><div class="label">${text("Khách hàng", "Customer")}</div><div>${buyerName}</div></div>
<div class="row"><div class="label">${text("Mã tham chiếu", "Reference")}</div><div>${buyerCode}</div></div>
<div class="row"><div class="label">${text("Mã đơn hàng", "Order")}</div><div>${orderNumber}</div></div>
<div class="row"><div class="label">${text("Số tiền yêu cầu", "Requested amount")}</div><div><strong>${amountLabel}</strong></div></div>
</div></div></div>
<div class="section"><h2>2. ${text("Hướng dẫn thanh toán", "Payment instructions")}</h2><div class="grid"><div>
<div class="row"><div class="label">${text("Ngân hàng", "Bank")}</div><div>${account?.bankName ?? "—"}</div></div>
<div class="row"><div class="label">${text("Chủ tài khoản", "Account name")}</div><div>${account?.accountHolder ?? "—"}</div></div>
<div class="row"><div class="label">${text("Số tài khoản", "Account number")}</div><div>${account?.accountNumber ?? "—"}</div></div>
<div class="row"><div class="label">${text("Nội dung chuyển khoản", "Transfer content")}</div><div>${transferContent}</div></div>
<div class="row"><div class="label">${text("Liên kết", "Link")}</div><div>${link}</div></div>
</div><div><div style="height:220px;border:2px dashed #94a3b8;border-radius:16px;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#64748b;font-weight:700">QR CODE</div></div></div></div>
<div class="section"><h2>3. ${text("Xác nhận & lưu ý", "Confirmation & notes")}</h2><div class="summary">
<div class="line"><span>${text("Số tiền yêu cầu", "Requested amount")}</span><span>${amountLabel}</span></div>
<div class="line"><span>${text("Doanh nghiệp chỉ ghi nhận tiền khi có Payment Record", "Funds are recognized only after a Payment Record exists")}</span><span>OK</span></div>
</div></div>
<div class="note">${text("Yêu cầu thanh toán được tạo từ đơn hàng; sau khi doanh nghiệp xác nhận đã nhận tiền, hệ thống mới ghi nhận Payment Record.", "This payment request is created from the order. The system only records payment after the business confirms funds were received.")}</div>
</div>
</body>
</html>`;

  const download = async () => {
    const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${intent.id}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    await record("DOWNLOAD", htmlDocument);
  };

  return (
    <Modal id="payment-request-composer" isOpen onClose={onClose} size="lg" title={text("Soạn yêu cầu thanh toán", "Compose payment request")} bodyClassName="space-y-5 bg-slate-50/70">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-2xl font-black uppercase tracking-tight text-slate-950">{text("Mẫu yêu cầu thanh toán", "Payment request")}</div>
              <div className="mt-1 text-sm text-slate-500">{orderNumber} · {buyerName}</div>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">{intent.purpose ?? "OTHER"}</div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-wide text-white">1. {text("Thông tin yêu cầu", "Request information")}</div>
                <div className="grid gap-3 p-4 text-sm">
                  {[
                    [text("Số yêu cầu", "Request no."), intent.id],
                    [text("Khách hàng", "Customer"), buyerName],
                    [text("Mã tham chiếu", "Reference"), buyerCode],
                    [text("Mã đơn hàng", "Order no."), orderNumber],
                    [text("Số tiền yêu cầu", "Requested amount"), amountLabel],
                    [text("Hạn thanh toán", "Expires"), formatDateTime(intent.expiresAt, locale)],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="grid grid-cols-[170px_minmax(0,1fr)] gap-3 border-b border-slate-100 pb-2 last:border-none last:pb-0">
                      <div className="font-semibold text-slate-500">{label}</div>
                      <div className="font-semibold text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-wide text-white">2. {text("Hướng dẫn thanh toán", "Payment instructions")}</div>
                <div className="grid gap-3 p-4 text-sm">
                  {[
                    [text("Ngân hàng", "Bank"), account?.bankName ?? "—"],
                    [text("Chủ tài khoản", "Account name"), account?.accountHolder ?? "—"],
                    [text("Số tài khoản", "Account number"), account?.accountNumber ?? "—"],
                    [text("Nội dung chuyển khoản", "Transfer content"), transferContent],
                    [text("Liên kết thanh toán", "Payment link"), link],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="grid grid-cols-[170px_minmax(0,1fr)] gap-3 border-b border-slate-100 pb-2 last:border-none last:pb-0">
                      <div className="font-semibold text-slate-500">{label}</div>
                      <div className="break-all text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                {text("Yêu cầu thanh toán này không phải là hóa đơn VAT. Doanh nghiệp chỉ ghi nhận tiền sau khi có Payment Record authoritative.", "This payment request is not a VAT invoice. Funds are recognized only after an authoritative Payment Record exists.")}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">QR</div>
                <div className="mt-3 flex justify-center"><QrPreview payload={qrPayload} /></div>
                <div className="mt-3 text-xs text-slate-500">{text("Khách có thể quét QR hoặc dùng link thanh toán.", "Customer can scan the QR or use the payment link.")}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{text("Nội dung rút gọn", "Compact message")}</div>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans leading-6 text-slate-800">{content}</pre>
              </div>
            </div>
          </div>
        </div>

        {communicationHistory.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">{text("Lịch sử gửi", "Communication history")}</div>
            <div className="mt-3 space-y-2">
              {[...communicationHistory].reverse().map((delivery) => (
                <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{delivery.channel} · {delivery.state}</div>
                    <div className="mt-0.5 text-slate-500">{formatDateTime(delivery.sentAt ?? delivery.createdAt, locale)}</div>
                  </div>
                  {delivery.state === "FAILED" && <Button variant="secondary" size="sm" icon={<RotateCcw size={13} />} onClick={() => { void retryDelivery(delivery); }}>{text("Gửi lại", "Retry")}</Button>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button icon={<Copy size={14} />} onClick={() => copy(content, "COPY")} loading={mutation.busy}>{text("Sao chép nội dung", "Copy content")}</Button>
          <Button variant="secondary" icon={<ExternalLink size={14} />} onClick={() => copy(link, "LINK")}>{text("Sao chép link", "Copy link")}</Button>
          <Button variant="secondary" icon={<QrCode size={14} />} onClick={() => { setShowQr((value) => !value); void record("QR", qrPayload); }}>{text("Hiển thị QR", "Show QR")}</Button>
          <Button variant="secondary" icon={<Mail size={14} />} onClick={email}>{text("Mở email", "Open email")}</Button>
          <Button variant="secondary" icon={<Download size={14} />} onClick={download}>{text("Tải hướng dẫn", "Download guide")}</Button>
          <Button variant="secondary" icon={<RotateCcw size={14} />} onClick={() => setShowQr(false)}>{text("Đặt lại", "Reset")}</Button>
        </div>

        {showQr && <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-5"><QrPreview payload={qrPayload} /><p className="mt-3 break-all text-center text-[10px] text-slate-500">{qrPayload}</p></div>}
        {mutation.snapshot.failure && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{mutation.snapshot.failure.message}</div>}
      </div>
    </Modal>
  );
};
