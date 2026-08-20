import React from "react";
import { ShoppingBag, Eye, Edit, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { DetailTabActionButton } from "@/shared/components/ui";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";
import { formatVnd } from "@/shared/lib/format/currency";
import { CustomerOrder } from "@/modules/orders";
import { getPaymentSummaryForOrder } from "@/modules/payments";

export interface ContactOrderDisplayItem {
  order: CustomerOrder;
  relationship: "contact" | "customer";
}

interface ContactOrdersTabProps {
  orders: ContactOrderDisplayItem[];
  onCreateOrderClick?: () => void;
  onOpenModule: () => void;
}

export const ContactOrdersTab: React.FC<ContactOrdersTabProps> = ({
  orders = [],
  onCreateOrderClick,
  onOpenModule,
}) => {
  const { tx, locale } = useI18n();
  const navigate = useNavigate();

  return (
    <div id="contact-orders-tab" className="space-y-4 animate-fade-in text-[11px] text-slate-700 text-left">
      <RelationshipWorkspaceHeader
        title={tx("contacts.orders.title", "Đơn hàng liên quan")}
        actions={<RelationshipModuleActions secondaryLabel={locale === "vi" ? "Mở Đơn hàng" : "Open Orders"} primaryLabel={onCreateOrderClick ? tx("contacts.orders.create", "Tạo đơn hàng") : undefined} onSecondary={onOpenModule} onPrimary={onCreateOrderClick} />}
      />

      {orders.length === 0 ? (
        <div className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400 space-y-3">
          <ShoppingBag size={24} className="text-slate-300" />
          <div className="space-y-1">
            <span className="font-semibold block text-slate-700">
              {tx("contacts.orders.empty", "Liên hệ này chưa có đơn hàng liên quan.")}
            </span>
            <p className="max-w-md text-[10px] text-slate-400 mx-auto leading-relaxed">
              {tx("contactDetail.orders.emptyDesc", "Liên hệ này chưa có đơn hàng liên kết. Theo quy trình, cần chuyển đổi liên hệ thành khách hàng chính thức từ cơ hội thành công trước khi có đơn hàng.")}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-semibold tracking-wide border-b border-slate-100">
                <th className="p-3">Số đơn hàng</th>
                <th className="p-3">Nguồn liên kết</th>
                <th className="p-3 text-right">Trị giá đơn</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Loại liên kết</th>
                <th className="p-3">Người phụ trách</th>
                <th className="p-3">Ngày tạo</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-sans font-semibold text-slate-700">
              {orders.map(({ order, relationship }) => {
                const isCustomerLevel = relationship === "customer";
                const oid = order.id || order.orderId || "";
                return (
                  <tr key={oid} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 font-semibold text-indigo-600 font-mono">
                      {order.orderNumber}
                    </td>
                    <td className="p-3 text-slate-500">
                      {order.sourceQuoteId ? (
                        <div className="text-[10px] text-indigo-500 font-sans">
                          {tx("orders.detail.createdFromQuote", "Báo giá")}: {order.sourceQuoteNumber || "QT-Link"}
                        </div>
                      ) : order.sourceDealId ? (
                        <div className="text-[10px] text-amber-600 font-sans">
                          {tx("orders.detail.createdFromDeal", "Cơ hội")}: {order.sourceDealName || "Deal-Link"}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right text-slate-900 font-mono font-semibold">
                      {formatVnd(order.grandTotal || 0, locale)}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[9px] font-semibold uppercase">
                          {order.state}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-[9px] font-semibold uppercase">
                          {getPaymentSummaryForOrder(order.id, order.grandTotal ?? order.totalAmount ?? 0, order.currency ?? "VND").state}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      {isCustomerLevel ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-orange-50 border border-orange-100 text-orange-700 rounded-full text-[9px] font-semibold">
                          {tx("contacts.orders.customerLevel", "Đơn hàng cấp khách hàng")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 bg-teal-50 border border-teal-100 text-teal-700 rounded-full text-[9px] font-semibold">
                          {tx("contacts.orders.contactOrder", "Đơn hàng theo liên hệ")}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">
                      {order.ownerName || tx("contactDetail.fields.unassignedOwner", "Chưa bàn giao")}
                    </td>
                    <td className="p-3 text-slate-500 font-mono">
                      {order.orderDate ? new Date(order.orderDate).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US") : "-"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${oid}`)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                          title={tx("common.view", "Xem")}
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${oid}/edit`)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                          title={tx("common.edit", "Sửa")}
                        >
                          <Edit size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
