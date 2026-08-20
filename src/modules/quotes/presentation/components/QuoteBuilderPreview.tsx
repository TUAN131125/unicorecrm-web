import React, { useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, Mail } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { CommercialDocumentPreviewModal } from "@/components/crm/commercial-documents/CommercialDocumentPreviewModal";
import {
  CommercialDocumentFieldGrid,
  CommercialDocumentHeader,
  CommercialDocumentNotice,
  CommercialDocumentSection,
  CommercialDocumentSheet,
  CommercialDocumentSignatureGrid,
} from "@/components/crm/commercial-documents/CommercialDocumentSheet";
import { useI18n } from "@/i18n";
import type { CustomerDisplay as Customer } from "@/modules/customers";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { getInvoiceSellerInformation, subscribeToInvoiceConfiguration } from "@/modules/invoices";
import { useSubscribableSnapshot } from "@/platform/react";

import type { QuoteLineItem, SalesDocumentAdjustment } from "../../domain/model/quote.types";

export interface QuoteBuilderPreviewProps {
  quoteNumber: string;
  currency: string;
  validUntil: string;
  quoteTitle?: string;
  referencedDeal?: { name?: string } | null;
  referencedCustomer?: Customer;
  editingQuote?: {
    senderName?: string;
    senderAddress?: string;
    senderTaxId?: string;
    senderEmail?: string;
    senderPhone?: string;
    senderContactName?: string;
    customerContact?: string;
    createdAt?: string;
  } | null;
  quoteLines: QuoteLineItem[];
  rawSubtotal: number;
  computedFees: number;
  computedDiscounts: number;
  quoteGrandTotal: number;
  adjustments: SalesDocumentAdjustment[];
  quoteNotes: string;
  onExportPdf?: () => void;
  onSendGmail?: () => void;
  onConfirmSent?: () => void;
  exportBusy?: boolean;
  sendBusy?: boolean;
  showPreviewLauncher?: boolean;
  previewOpen?: boolean;
  onPreviewOpenChange?: (open: boolean) => void;
}

function formatDate(value: string | undefined, locale: "vi" | "en") {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

function formatMoney(value: number, currency: string, locale: "vi" | "en") {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function lineUnit(line: QuoteLineItem, locale: "vi" | "en") {
  if (line.billingCycleSnapshot) return locale === "vi" ? "Gói" : "Package";
  if (line.productTypeSnapshot === "service") return locale === "vi" ? "Dịch vụ" : "Service";
  return locale === "vi" ? "Đơn vị" : "Unit";
}

export const QuoteBuilderPreview: React.FC<QuoteBuilderPreviewProps> = ({
  quoteNumber,
  currency,
  validUntil,
  quoteTitle,
  referencedDeal,
  referencedCustomer,
  editingQuote,
  quoteLines,
  rawSubtotal,
  computedFees,
  computedDiscounts,
  quoteGrandTotal,
  adjustments,
  quoteNotes,
  onExportPdf,
  onSendGmail,
  onConfirmSent,
  exportBusy,
  sendBusy,
  showPreviewLauncher = true,
  previewOpen: controlledPreviewOpen,
  onPreviewOpenChange,
}) => {
  const { locale: i18nLocale, t } = useI18n();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const invoiceConfiguration = useSubscribableSnapshot(getInvoiceSellerInformation, subscribeToInvoiceConfiguration);
  const locale: "vi" | "en" = i18nLocale === "vi" ? "vi" : "en";
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const issueDate = editingQuote?.createdAt ?? new Date().toISOString();
  const customerName = referencedCustomer?.displayName
    || referencedCustomer?.companyName
    || referencedCustomer?.individualName
    || referencedCustomer?.name
    || text("Khách hàng chưa chọn", "Customer not selected");
  const customerContact = editingQuote?.customerContact || "—";
  const taxTotal = useMemo(() => quoteLines.reduce((sum, line) => sum + Number(line.lineTaxAmount || 0), 0), [quoteLines]);
  const shippingFee = useMemo(
    () => adjustments
      .filter((item) => ["SHIPPING_FEE", "SERVICE_FEE", "INSTALLATION_FEE", "CONSULTATION_FEE", "SURCHARGE"].includes(String(item.type)))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [adjustments],
  );
  const feeTotal = Math.max(computedFees, shippingFee);
  const grossTotalLabel = t("quotes.grossTotal");
  const invoiceAddress = workspaceConfiguration.addresses.find((address) => address.id === invoiceConfiguration.invoiceAddressId);
  const company = {
    name: editingQuote?.senderName
      || invoiceConfiguration.sellerName
      || workspaceConfiguration.businessInformation.legalName
      || workspaceConfiguration.businessInformation.displayName,
    address: editingQuote?.senderAddress || invoiceAddress?.addressLine1 || "",
    taxCode: editingQuote?.senderTaxId || invoiceConfiguration.taxId || workspaceConfiguration.businessInformation.taxId,
    email: editingQuote?.senderEmail || invoiceConfiguration.email || workspaceConfiguration.businessInformation.billingEmail,
    phone: editingQuote?.senderPhone || invoiceConfiguration.phone || workspaceConfiguration.businessInformation.phone,
  };

  const [internalPreviewOpen, setInternalPreviewOpen] = useState(false);
  const previewOpen = controlledPreviewOpen ?? internalPreviewOpen;
  const setPreviewOpen = (open: boolean) => {
    if (controlledPreviewOpen === undefined) setInternalPreviewOpen(open);
    onPreviewOpenChange?.(open);
  };

  const renderDocument = () => (
    <CommercialDocumentSheet data-quote-pdf-source="true" className="mx-auto">
      <CommercialDocumentHeader
        company={company}
        title={text("Báo giá", "Quotation")}
        reference={quoteNumber || text("Số được tạo khi lưu", "Number generated on save")}
      />

      <div className="mt-6 space-y-6">
        <CommercialDocumentSection number={1} title={text("Thông tin chung", "General information")}>
          <CommercialDocumentFieldGrid
            columns={2}
            fields={[
              { label: text("Ngày báo giá", "Quotation date"), value: formatDate(issueDate, locale) },
              { label: text("Hiệu lực đến", "Valid until"), value: formatDate(validUntil, locale) },
              { label: text("Khách hàng", "Customer"), value: customerName },
              { label: text("Người liên hệ", "Contact person"), value: customerContact },
              { label: "Email", value: referencedCustomer?.billingEmail || referencedCustomer?.email || "—" },
              { label: text("Cơ hội liên kết", "Linked opportunity"), value: referencedDeal?.name || "—" },
              { label: text("Địa chỉ", "Address"), value: referencedCustomer?.billingAddress || referencedCustomer?.address || "—" },
              { label: text("Người phụ trách", "Owner"), value: editingQuote?.senderContactName || "—" },
            ]}
          />
        </CommercialDocumentSection>

        <CommercialDocumentSection number={2} title={text("Sản phẩm và dịch vụ", "Products and services")} bodyClassName="overflow-hidden">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-slate-400 text-left">
                <th className="w-10 px-2 py-2 font-semibold">#</th>
                <th className="px-2 py-2 font-semibold">{text("Mô tả", "Description")}</th>
                <th className="w-20 px-2 py-2 text-center font-semibold">{text("ĐVT", "Unit")}</th>
                <th className="w-16 px-2 py-2 text-right font-semibold">{text("SL", "Qty")}</th>
                <th className="w-28 px-2 py-2 text-right font-semibold">{text("Đơn giá", "Unit price")}</th>
                <th className="w-32 px-2 py-2 text-right font-semibold">{text("Thành tiền", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {quoteLines.length === 0 ? (
                <tr><td colSpan={6} className="border-b border-slate-300 px-2 py-8 text-center text-slate-500">{text("Chưa có sản phẩm hoặc dịch vụ.", "No products or services added.")}</td></tr>
              ) : quoteLines.map((line, index) => (
                <tr key={line.id} className="border-b border-slate-300 align-top">
                  <td className="px-2 py-2.5 text-center">{index + 1}</td>
                  <td className="px-2 py-2.5">
                    <div className="font-semibold text-slate-950">{line.productNameSnapshot || line.productName || "—"}</div>
                    <div className="text-[11px] text-slate-500">{line.skuSnapshot || line.productId || "—"}</div>
                    {(line.descriptionSnapshot || line.description) && <div className="mt-1 whitespace-pre-line text-[11px] text-slate-600">{line.descriptionSnapshot || line.description}</div>}
                  </td>
                  <td className="px-2 py-2.5 text-center">{lineUnit(line, locale)}</td>
                  <td className="px-2 py-2.5 text-right">{line.quantity}</td>
                  <td className="px-2 py-2.5 text-right">{formatMoney(line.unitPriceSnapshot || line.unitPrice || 0, currency, locale)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold">{formatMoney(line.lineTotal || 0, currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CommercialDocumentSection>

        <div className="grid grid-cols-[minmax(0,1fr)_310px] gap-10">
          <CommercialDocumentSection number={3} title={text("Điều khoản và ghi chú", "Terms and notes")}>
            <div className="space-y-2 text-[12.5px] leading-5">
              {quoteTitle && <p className="font-semibold">{quoteTitle}</p>}
              <p className="whitespace-pre-line">{quoteNotes || text("Theo thỏa thuận thương mại giữa hai bên.", "As commercially agreed by both parties.")}</p>
              <p><span className="text-slate-600">{text("Hiệu lực:", "Validity:")}</span> {formatDate(validUntil, locale)}</p>
            </div>
          </CommercialDocumentSection>

          <div className="space-y-1 border-t border-slate-400 pt-2 text-[12.5px]">
            {[
              [text("Tạm tính", "Subtotal"), formatMoney(rawSubtotal, currency, locale)],
              [text("Chiết khấu", "Discount"), formatMoney(computedDiscounts, currency, locale)],
              [text("Thuế", "Tax"), formatMoney(taxTotal, currency, locale)],
              [text("Phí", "Fees"), formatMoney(feeTotal, currency, locale)],
            ].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-5 py-1"><span className="text-slate-600">{label}</span><span>{value}</span></div>)}
            <div className="mt-2 flex justify-between gap-5 border-t border-slate-400 pt-2 text-[14px] font-semibold"><span>{grossTotalLabel}</span><span>{formatMoney(quoteGrandTotal, currency, locale)}</span></div>
          </div>
        </div>

        <CommercialDocumentSection number={4} title={text("Xác nhận", "Confirmation")}>
          <CommercialDocumentSignatureGrid
            labels={[text("Đại diện bên bán", "Seller representative"), text("Khách hàng xác nhận", "Customer confirmation")]}
            hint={text("Ký và ghi rõ họ tên", "Sign and print name")}
            dateHint={text("Ngày …… / …… / …………", "Date …… / …… / …………")}
          />
        </CommercialDocumentSection>
      </div>

      <CommercialDocumentNotice>
        {text("Báo giá là đề nghị thương mại, chưa phải hóa đơn và chưa ghi nhận thanh toán.", "This quotation is a commercial proposal, not an invoice or payment record.")}
      </CommercialDocumentNotice>
    </CommercialDocumentSheet>
  );

  return (
    <div data-quote-live-preview="v1" data-quote-builder-preview="full-width">
      {showPreviewLauncher && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">{text("Tài liệu báo giá", "Quotation document")}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Eye size={14} />} onClick={() => setPreviewOpen(true)}>{text("Xem trước", "Preview")}</Button>
            {onExportPdf && <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={onExportPdf} loading={exportBusy}>{text("Xuất PDF", "Export PDF")}</Button>}
            {onSendGmail && <Button variant="secondary" size="sm" icon={<Mail size={14} />} onClick={onSendGmail} loading={sendBusy}>{text("Gửi email", "Send email")}</Button>}
            {onConfirmSent && <Button variant="secondary" size="sm" icon={<CheckCircle2 size={14} />} onClick={onConfirmSent}>{text("Xác nhận đã gửi", "Confirm sent")}</Button>}
          </div>
        </div>
      )}

      <div aria-hidden="true" className="pointer-events-none fixed left-[-12000px] top-0 z-[-1] w-[1000px]">
        {renderDocument()}
      </div>

      <CommercialDocumentPreviewModal
        id="quote-a4-preview-modal"
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={text("Xem trước báo giá", "Quotation preview")}
      >
        {renderDocument()}
      </CommercialDocumentPreviewModal>
    </div>
  );
};
