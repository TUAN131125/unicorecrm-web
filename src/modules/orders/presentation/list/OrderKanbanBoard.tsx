import React from "react";
import { Package } from "lucide-react";
import { ActionDropdownTrigger } from "@/components/crm/ActionDropdownTrigger";
import type { CustomerOrder, OrderState } from "../../domain/model/order.types";
import type { PaymentSummaryState } from "@/modules/payments";
import type { OrderStatusConfig } from "./orderList.types";

export interface OrderKanbanBoardProps {
  orders: CustomerOrder[];
  statusConfigs: OrderStatusConfig[];
  locale: string;
  activeMoreActionsOrderId?: string;
  renderPaymentBadge: (status?: PaymentSummaryState) => React.ReactNode;
  getPaymentState: (order: CustomerOrder) => PaymentSummaryState;
  formatDate: (dateStr: string) => string;
  formatValue: (val: number, currency?: string) => string;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetStatus: OrderState) => void;
  onViewOrder: (id: string) => void;
  onMoreActions: (order: CustomerOrder, anchorElement: HTMLElement) => void;
}

export const OrderKanbanBoard: React.FC<OrderKanbanBoardProps> = ({
  orders,
  statusConfigs,
  locale,
  activeMoreActionsOrderId,
  renderPaymentBadge,
  getPaymentState,
  formatDate,
  formatValue,
  onDragStart,
  onDragOver,
  onDrop,
  onViewOrder,
  onMoreActions,
}) => {
  return (
    <div
      className="h-[600px] min-h-0 overflow-x-auto overflow-y-hidden pb-4 crm-scroll-x"
      style={{ direction: "ltr" }}
    >
      <div className="flex h-full gap-4 min-w-max">
        {statusConfigs
          .filter((conf) => conf.isActive)
          .sort((a, b) => a.order - b.order)
          .map((column) => {
            const colOrders = orders.filter(
              (o) => o.state === column.code
            );
            const colTotalValue = colOrders.reduce(
              (sum, o) => sum + (o.grandTotal || o.totalAmount || 0),
              0
            );

            return (
              <div
                key={column.code}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, column.code as OrderState)}
                className="flex h-full w-[310px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-white/70 shadow-2xs"
              >
                {/* Column Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-1 rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm crm-text-wrap pr-2">
                      {locale === "vi" ? column.labelVi : column.labelEn}
                    </span>
                    <span className="bg-slate-200 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0">
                      {colOrders.length}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 font-mono tracking-tight mt-0.5">
                    {formatValue(colTotalValue)}
                  </div>
                </div>

                {/* Column card scroll body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 crm-scroll-y bg-slate-50/30">
                  {colOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-200 rounded-xl min-h-[140px] bg-white">
                      <Package
                        size={24}
                        className="text-slate-350 stroke-[1.25] mb-1.5"
                      />
                      <span className="text-[11px] font-semibold text-slate-400">
                        {locale === "vi" ? "Chưa có đơn hàng" : "No orders yet"}
                      </span>
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <div
                        key={order.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, order.id)}
                        className="p-3 bg-white border border-slate-200 rounded-xl text-xs hover:border-violet-200 hover:shadow-xs transition-all flex flex-col gap-3 group relative cursor-grab active:cursor-grabbing border-l-3 border-l-violet-400"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => onViewOrder(order.id)}
                            className="font-semibold text-slate-800 tracking-tight hover:text-violet-600 transition-colors font-mono"
                          >
                            {order.orderNumber}
                          </button>

                          <ActionDropdownTrigger
                            isOpen={activeMoreActionsOrderId === order.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoreActions(order, e.currentTarget);
                            }}
                            title={
                              locale === "vi" ? "Thao tác phụ" : "More actions"
                            }
                          />
                        </div>

                        {/* Content info */}
                        <div className="space-y-1">
                          <div
                            className="font-semibold text-slate-800 crm-text-wrap"
                            title={order.customerName}
                          >
                            {order.customerName}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{formatDate(order.orderDate)}</span>
                            <span className="font-mono text-slate-400">
                              {order.items?.length || 0} SP
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-100/60">
                            {renderPaymentBadge(getPaymentState(order))}
                            <span className="font-semibold text-slate-800 font-mono text-xs">
                              {formatValue(
                                order.grandTotal || order.totalAmount || 0,
                                order.currency,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
