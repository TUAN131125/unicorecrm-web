import React from "react";
import { motion } from "motion/react";
import { ActionDropdownTrigger } from "@/components/crm/ActionDropdownTrigger";
import type { CustomerOrder, OrderState } from "../../domain/model/order.types";
import type { PaymentSummaryState } from "@/modules/payments";

export interface OrderCardListProps {
  orders: CustomerOrder[];
  selectedOrderIds: string[];
  locale: string;
  activeMoreActionsOrderId?: string;
  renderStatusBadge: (status: OrderState) => React.ReactNode;
  renderPaymentBadge: (status?: PaymentSummaryState) => React.ReactNode;
  getPaymentState: (order: CustomerOrder) => PaymentSummaryState;
  formatDate: (dateStr: string) => string;
  formatValue: (val: number, currency?: string) => string;
  onSelectOrder: (id: string) => void;
  onViewOrder: (id: string) => void;
  onMoreActions: (order: CustomerOrder, anchorElement: HTMLElement) => void;
}

export const OrderCardList: React.FC<OrderCardListProps> = ({ orders, selectedOrderIds, locale, activeMoreActionsOrderId, renderStatusBadge, renderPaymentBadge, getPaymentState, formatDate, formatValue, onSelectOrder, onViewOrder, onMoreActions }) => (
  <div data-data-surface="list" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {orders.map((order) => {
      const selected = selectedOrderIds.includes(order.id);
      return <motion.article key={order.id} layout tabIndex={0} className={`flex min-h-[300px] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-200 ${selected ? "border-violet-500 ring-2 ring-violet-100" : "border-slate-200"}`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex min-w-0 items-start gap-3"><input type="checkbox" aria-label={locale === "vi" ? `Chọn đơn hàng ${order.orderNumber}` : `Select order ${order.orderNumber}`} checked={selected} onChange={() => onSelectOrder(order.id)} className="mt-1 h-4 w-4 rounded accent-violet-600" /><div className="min-w-0"><button type="button" onClick={() => onViewOrder(order.id)} className="crm-text-wrap font-mono text-sm font-semibold text-slate-950 hover:text-violet-700">{order.orderNumber}</button><div className="mt-1 text-xs text-slate-500">{order.sourceQuoteNumber || order.sourceDealName || (locale === "vi" ? "Đơn trực tiếp" : "Direct order")}</div></div></div>
          <ActionDropdownTrigger isOpen={activeMoreActionsOrderId === order.id} onClick={(event) => { event.stopPropagation(); onMoreActions(order, event.currentTarget); }} title={locale === "vi" ? `Thao tác đơn hàng ${order.orderNumber}` : `Order actions ${order.orderNumber}`} />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">{renderStatusBadge(order.state)}{renderPaymentBadge(getPaymentState(order))}</div>
          <div><div className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{locale === "vi" ? "Khách hàng" : "Customer"}</div><div className="mt-1 break-words text-sm font-medium text-slate-900">{order.customerName || order.buyerRef.id}</div>{order.contactName && <div className="mt-1 text-xs text-slate-500">{order.contactName}</div>}</div>
          <div className="grid grid-cols-2 gap-4 text-xs"><div><div className="font-medium uppercase tracking-wider text-slate-600">{locale === "vi" ? "Ngày đơn" : "Order date"}</div><div className="mt-1 font-semibold text-slate-700">{formatDate(order.orderDate)}</div></div><div><div className="font-medium uppercase tracking-wider text-slate-600">{locale === "vi" ? "Phụ trách" : "Owner"}</div><div className="mt-1 crm-text-wrap font-semibold text-slate-700">{order.ownerName || "—"}</div></div></div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4"><div className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{locale === "vi" ? "Tổng giá trị" : "Total"}</div><div className="mt-1 whitespace-nowrap text-lg font-semibold text-slate-950">{formatValue(order.grandTotal || order.totalAmount || 0, order.currency)}</div></div>
      </motion.article>;
    })}
  </div>
);
