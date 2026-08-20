import React, { forwardRef, useMemo } from "react";
import {
  CommercialDocumentFieldGrid,
  CommercialDocumentHeader,
  CommercialDocumentNotice,
  CommercialDocumentSection,
  CommercialDocumentSheet,
  CommercialDocumentSignatureGrid,
} from "@/components/crm/commercial-documents/CommercialDocumentSheet";
import { PaymentQrCode } from "@/components/crm/commercial-documents";
import { getPaymentConfigurationSnapshot, subscribeToPaymentConfiguration } from "@/modules/payments";
import { getInvoiceSellerInformation, subscribeToInvoiceConfiguration } from "@/modules/invoices";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import type { CustomerOrder, OrderItem } from "../../domain/model/order.types";

interface OrderCustomerDocumentPartySnapshot {
  displayName?: string;
  companyName?: string;
  individualName?: string;
  name?: string;
  customerCode?: string;
  taxCode?: string;
  address?: string;
  billingAddress?: string;
  phone?: string;
  email?: string;
  billingEmail?: string;
}

interface OrderCustomerDocumentContactSnapshot {
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface OrderCustomerDocumentProps {
  order: CustomerOrder;
  customerLabel: string;
  contactLabel?: string;
  locale: "vi" | "en";
  customer?: OrderCustomerDocumentPartySnapshot;
  contact?: OrderCustomerDocumentContactSnapshot;
}

function formatDate(value: string | undefined, locale: "vi" | "en") {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

function formatMoney(value: number | undefined, currency = "VND", locale: "vi" | "en" = "vi") {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number.isFinite(value) ? Number(value) : 0);
}

function firstText(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() || "—";
}

function shippingAddressText(order: CustomerOrder) {
  const address = order.shippingAddress;
  if (!address) return "—";
  return [address.line1, address.line2, address.ward, address.district, address.city, address.country, address.postalCode].filter(Boolean).join(", ");
}

function paymentMethodText(order: CustomerOrder, locale: "vi" | "en") {
  const method = order.paymentInstruction?.method;
  if (!method) return locale === "vi" ? "Theo thỏa thuận thương mại" : "Per commercial agreement";
  const labels: Record<string, { vi: string; en: string }> = {
    BANK_TRANSFER: { vi: "Chuyển khoản ngân hàng", en: "Bank transfer" },
    COD: { vi: "Thanh toán khi nhận hàng", en: "Cash on delivery" },
    EXTERNAL_GATEWAY: { vi: "Cổng thanh toán", en: "Payment gateway" },
    CARD: { vi: "Thẻ", en: "Card" },
    CASH: { vi: "Tiền mặt", en: "Cash" },
  };
  return labels[method]?.[locale] ?? method;
}

function paymentTermsText(order: CustomerOrder, locale: "vi" | "en") {
  const lines = order.paymentAgreementSnapshot?.lines ?? [];
  if (lines.length === 0) return locale === "vi" ? "Theo thỏa thuận thương mại giữa hai bên." : "According to the commercial agreement between both parties.";
  return [...lines]
    .sort((a, b) => a.sequence - b.sequence)
    .map((line) => `${line.sequence}. ${line.label}: ${formatMoney(Number(line.previewAmount.amount), line.previewAmount.currency, locale)}`)
    .join("\n");
}

function lineUnit(item: OrderItem, locale: "vi" | "en") {
  if (item.billingCycleSnapshot) return locale === "vi" ? "Gói" : "Package";
  if (item.productTypeSnapshot === "service") return locale === "vi" ? "Dịch vụ" : "Service";
  return locale === "vi" ? "Đơn vị" : "Unit";
}

export const OrderCustomerDocument = forwardRef<HTMLDivElement, OrderCustomerDocumentProps>(function OrderCustomerDocument(
  { order, customer, contact, customerLabel, contactLabel, locale },
  ref,
) {
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const configuration = useWorkspaceOperationalConfiguration();
  const invoiceConfiguration = useSubscribableSnapshot(getInvoiceSellerInformation, subscribeToInvoiceConfiguration);
  const paymentConfiguration = useSubscribableSnapshot(getPaymentConfigurationSnapshot, subscribeToPaymentConfiguration);
  const invoiceAddress = configuration.addresses.find((address) => address.id === invoiceConfiguration.invoiceAddressId);
  const company = {
    name: invoiceConfiguration.sellerName || configuration.businessInformation.legalName || configuration.businessInformation.displayName,
    address: invoiceAddress?.addressLine1 || "",
    taxCode: invoiceConfiguration.taxId || configuration.businessInformation.taxId,
    email: invoiceConfiguration.email || configuration.businessInformation.billingEmail,
    phone: invoiceConfiguration.phone || configuration.businessInformation.phone,
  };
  const currency = order.currency || configuration.localeRegion.currencies.baseCurrency;
  const items = order.items ?? [];
  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const discountTotal = order.discountTotal ?? items.reduce((sum, item) => sum + item.lineDiscountAmount, 0);
  const taxTotal = order.taxTotal ?? items.reduce((sum, item) => sum + item.lineTaxAmount, 0);
  const shippingFee = useMemo(
    () => (order.adjustments ?? []).filter((item) => item.type === "SHIPPING" || item.type === "FEE").reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [order.adjustments],
  );
  const grandTotal = order.grandTotal ?? order.totalAmount;
  const depositAmount = order.paymentAgreementSnapshot?.lines
    .filter((line) => line.purpose === "DEPOSIT")
    .reduce((sum, line) => sum + Number(line.previewAmount.amount || 0), 0) ?? 0;
  const balanceDue = Math.max(0, grandTotal - depositAmount);
  const showPaymentQr = Boolean(
    paymentConfiguration.qrPolicy.showOnPrint
    && order.paymentInstruction?.method === "BANK_TRANSFER"
    && order.paymentInstruction.qrPayload,
  );

  return (
    <CommercialDocumentSheet ref={ref} data-order-pdf-source="true">
      <CommercialDocumentHeader company={company} title={text("Đơn hàng", "Sales order")} reference={order.orderNumber} />

      <div className="mt-6 space-y-6">
        <CommercialDocumentSection number={1} title={text("Thông tin chung", "General information")}>
          <CommercialDocumentFieldGrid
            columns={2}
            fields={[
              { label: text("Ngày tạo", "Order date"), value: formatDate(order.orderDate, locale) },
              { label: text("Trạng thái", "Status"), value: order.state },
              { label: text("Khách hàng", "Customer"), value: customerLabel },
              { label: text("Người liên hệ", "Contact"), value: firstText(contactLabel, contact?.fullName, contact?.name) },
              { label: text("Số điện thoại", "Phone"), value: firstText(order.recipientPhone, customer?.phone, contact?.phone) },
              { label: "Email", value: firstText(order.recipientEmail, customer?.billingEmail, customer?.email, contact?.email) },
              { label: text("Địa chỉ giao hàng", "Shipping address"), value: shippingAddressText(order) },
              { label: text("Ngày giao dự kiến", "Expected delivery"), value: formatDate(order.expectedDeliveryDate, locale) },
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
              {items.length === 0 ? (
                <tr><td colSpan={6} className="border-b border-slate-300 px-2 py-8 text-center text-slate-500">{text("Chưa có sản phẩm hoặc dịch vụ.", "No products or services added.")}</td></tr>
              ) : items.map((item, index) => (
                <tr key={item.id} className="border-b border-slate-300 align-top">
                  <td className="px-2 py-2.5 text-center">{index + 1}</td>
                  <td className="px-2 py-2.5">
                    <div className="font-semibold text-slate-950">{item.productNameSnapshot || item.name || "—"}</div>
                    <div className="text-[11px] text-slate-500">{item.skuSnapshot || item.productId || "—"}</div>
                    {item.descriptionSnapshot && <div className="mt-1 whitespace-pre-line text-[11px] text-slate-600">{item.descriptionSnapshot}</div>}
                  </td>
                  <td className="px-2 py-2.5 text-center">{lineUnit(item, locale)}</td>
                  <td className="px-2 py-2.5 text-right">{item.quantity}</td>
                  <td className="px-2 py-2.5 text-right">{formatMoney(item.unitPriceSnapshot, currency, locale)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold">{formatMoney(item.lineTotal, currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CommercialDocumentSection>

        <div className="grid grid-cols-[minmax(0,1fr)_310px] gap-10">
          <CommercialDocumentSection number={3} title={text("Thanh toán và ghi chú", "Payment and notes")}>
            <CommercialDocumentFieldGrid
              fields={[
                { label: text("Phương thức", "Method"), value: paymentMethodText(order, locale) },
                { label: text("Điều khoản", "Terms"), value: <span className="whitespace-pre-line">{paymentTermsText(order, locale)}</span> },
                { label: text("Ghi chú", "Notes"), value: order.notes || "—" },
              ]}
            />
            {showPaymentQr && order.paymentInstruction?.qrPayload && (
              <div data-order-print-qr="bank-transfer" className="mt-4 grid grid-cols-[minmax(0,1fr)_116px] gap-5 border-t border-slate-300 pt-4">
                <div className="text-[12px] leading-5 text-slate-700">
                  <div className="font-semibold text-slate-900">{text("Thông tin chuyển khoản", "Bank transfer details")}</div>
                  <div className="mt-1">{order.paymentInstruction.bankAccount?.bankName || "—"}</div>
                  <div>{order.paymentInstruction.bankAccount?.accountName || "—"}</div>
                  <div>{order.paymentInstruction.bankAccount?.accountNumber || "—"}</div>
                  <div className="mt-1">{order.paymentInstruction.transferContent}</div>
                </div>
                <PaymentQrCode
                  payload={order.paymentInstruction.qrPayload}
                  alt={text(`QR chuyển khoản cho ${order.orderNumber}`, `Bank transfer QR for ${order.orderNumber}`)}
                  className="h-28 w-28 border border-slate-300 p-1"
                />
              </div>
            )}
          </CommercialDocumentSection>

          <div className="space-y-1 border-t border-slate-400 pt-2 text-[12.5px]">
            {[
              [text("Tạm tính", "Subtotal"), formatMoney(subtotal, currency, locale)],
              [text("Chiết khấu", "Discount"), formatMoney(discountTotal, currency, locale)],
              [text("Thuế", "Tax"), formatMoney(taxTotal, currency, locale)],
              [text("Phí vận chuyển", "Shipping"), formatMoney(shippingFee, currency, locale)],
              [text("Đặt cọc", "Deposit"), formatMoney(depositAmount, currency, locale)],
            ].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-5 py-1"><span className="text-slate-600">{label}</span><span>{value}</span></div>)}
            <div className="mt-2 flex justify-between gap-5 border-t border-slate-400 pt-2 text-[14px] font-semibold"><span>{text("Tổng cộng", "Grand total")}</span><span>{formatMoney(grandTotal, currency, locale)}</span></div>
            <div className="flex justify-between gap-5 py-1"><span className="text-slate-600">{text("Còn phải thanh toán", "Balance due")}</span><span>{formatMoney(balanceDue, currency, locale)}</span></div>
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
        {text("Đơn hàng thể hiện nội dung thương mại đã xác nhận; việc thanh toán và giao hàng được ghi nhận riêng.", "This sales order records the confirmed commercial scope; payment and fulfillment are recorded separately.")}
      </CommercialDocumentNotice>
    </CommercialDocumentSheet>
  );
});
