import React from "react";
import { ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui";
import {
  RelationshipModuleActions,
  RelationshipWorkspaceHeader,
} from "@/components/crm/relationship-detail";
import { useI18n } from "@/i18n";
import type { Contact } from "../../../domain/model/contact.types";
import { getOwnedProductDisplay } from "@/modules/customers";
import { formatVnd } from "@/shared/lib/format/currency";

interface ContactPurchasedProductsTabProps {
  contact: Contact;
  purchasedProducts?: any[];
  onCreateOpportunityClick?: () => void;
  onOpenModule(): void;
}

export const ContactPurchasedProductsTab: React.FC<ContactPurchasedProductsTabProps> = ({
  contact,
  purchasedProducts = [],
  onCreateOpportunityClick,
  onOpenModule,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => (isVi ? vi : en);

  return (
    <div id="contact-purchased-products-tab" className="space-y-4 text-[11px] text-slate-700">
      <RelationshipWorkspaceHeader
        title={text("Hàng hóa đã mua", "Purchased items")}
        actions={(
          <RelationshipModuleActions
            secondaryLabel={text("Mở Sản phẩm", "Open Products")}
            primaryLabel={onCreateOpportunityClick ? text("Tạo cơ hội bán thêm", "Create upsell opportunity") : undefined}
            onSecondary={onOpenModule}
            onPrimary={onCreateOpportunityClick}
          />
        )}
      />

      {purchasedProducts.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center">
          <ShoppingBag size={26} className="text-slate-300" />
          <h4 className="mt-3 text-sm font-semibold text-slate-700">
            {text("Chưa có hàng hóa đã mua", "No purchased items")}
          </h4>
          <p className="mt-1 max-w-xl text-xs font-normal leading-5 text-slate-500">
            {text(
              "Dữ liệu sẽ được tổng hợp từ các dòng đơn hàng của hồ sơ khách hàng hoặc tổ chức liên kết.",
              "Items will be assembled from order lines belonging to the linked customer or organization.",
            )}
          </p>
          {onCreateOpportunityClick ? (
            <Button className="mt-4" size="sm" variant="primary" icon={<Sparkles size={14} />} onClick={onCreateOpportunityClick}>
              {text("Tạo cơ hội bán thêm", "Create upsell opportunity")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-medium leading-5 text-emerald-800">
            {text(
              `${contact.fullName || contact.name} có hàng hóa được xác nhận từ giao dịch thuộc quan hệ khách hàng liên kết.`,
              `${contact.fullName || contact.name} has items confirmed by transactions in the linked customer relationship.`,
            )}
          </div>

          <div className="crm-scroll-x overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[920px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  <th className="p-3">{text("Sản phẩm / Dịch vụ", "Product / Service")}</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">{text("Loại", "Type")}</th>
                  <th className="p-3 text-center">{text("Số lượng", "Quantity")}</th>
                  <th className="p-3 text-right">{text("Giá trị", "Amount")}</th>
                  <th className="p-3">{text("Ngày mua", "Purchase date")}</th>
                  <th className="p-3">{text("Gia hạn / Bảo hành", "Renewal / Warranty")}</th>
                  <th className="p-3">{text("Chu kỳ / SLA", "Cycle / SLA")}</th>
                  <th className="p-3">{text("Nguồn", "Source")}</th>
                  <th className="p-3 text-center">{text("Trạng thái", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {purchasedProducts.map((product) => {
                  const display = getOwnedProductDisplay(product);
                  const sourceLabel = product.sourceOrderId
                    ? `${text("Đơn hàng", "Order")}: #${product.sourceOrderId.replace("order_", "ORD-")}`
                    : product.sourceQuoteId
                      ? `${text("Báo giá", "Quote")}: #${product.sourceQuoteId.replace("quote_", "QT-")}`
                      : product.sourceDealId
                        ? `${text("Cơ hội", "Opportunity")}: #${product.sourceDealId.replace("deal_", "DEAL-")}`
                        : display.sourceLabel || "—";
                  const status = String(display.status || "active").toLowerCase();
                  const statusPresentation = status === "expired"
                    ? { label: text("Hết hạn", "Expired"), className: "border-rose-200 bg-rose-50 text-rose-700" }
                    : status === "cancelled"
                      ? { label: text("Đã hủy", "Cancelled"), className: "border-slate-200 bg-slate-100 text-slate-600" }
                      : status === "renewal_due"
                        ? { label: text("Sắp hết hạn", "Expiring soon"), className: "border-amber-200 bg-amber-50 text-amber-700" }
                        : { label: text("Hoạt động", "Active"), className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
                  const renewalOrWarranty = display.renewalAt
                    ? `${text("Gia hạn", "Renewal")}: ${display.renewalAt}`
                    : product.warrantyUntil
                      ? `${text("Bảo hành", "Warranty")}: ${product.warrantyUntil}`
                      : "—";
                  const cycleSla = [display.billingCycle, display.slaLevel].filter(Boolean).join(" / ") || "—";

                  return (
                    <tr key={product.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="p-3"><span className="crm-text-wrap font-medium text-slate-900">{display.productName}</span></td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">{display.sku || "—"}</td>
                      <td className="p-3 text-[10px] capitalize text-slate-500">{display.productType?.replaceAll("_", " ") || "—"}</td>
                      <td className="p-3 text-center font-medium text-slate-800">{display.quantity}</td>
                      <td className="p-3 text-right font-mono font-semibold text-indigo-700">{formatVnd(display.amount, locale)}</td>
                      <td className="p-3 font-mono text-slate-500">{display.purchaseDate || "—"}</td>
                      <td className="p-3 text-[10px] text-slate-500">{renewalOrWarranty}</td>
                      <td className="p-3 text-[10px] text-slate-500">{cycleSla}</td>
                      <td className="p-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{sourceLabel}</span></td>
                      <td className="p-3 text-center"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium ${statusPresentation.className}`}>{statusPresentation.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
