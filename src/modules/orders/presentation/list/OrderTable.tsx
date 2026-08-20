import React from "react";
import { ActionDropdownTrigger } from "@/components/crm/ActionDropdownTrigger";
import {
  ListDataTable,
  ListTableBody,
  ListTableCell,
  ListTableHead,
  ListTableHeaderCell,
  ListTableRow,
  ListTableSurface,
  type ListTableAlign,
} from "@/components/crm/list-archetype";
import type { CustomerOrder } from "../../domain/model/order.types";
import type { ColumnConfig, OrderColumnDef } from "./orderList.types";

export interface OrderTableProps {
  orders: CustomerOrder[];
  selectedOrderIds: string[];
  columnConfig: ColumnConfig;
  columnDefs: OrderColumnDef[];
  locale: string;
  activeMoreActionsOrderId?: string;
  onSelectAll: () => void;
  onSelectOrder: (id: string) => void;
  onMoreActions: (order: CustomerOrder, anchorElement: HTMLElement) => void;
}

const getColumnAlign = (column: OrderColumnDef): ListTableAlign => {
  if (column.align) return column.align;
  if (["grandTotal"].includes(column.key)) return "right";
  if (["state", "paymentSummary", "currency", "productsCount"].includes(column.key)) return "center";
  return "left";
};

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  selectedOrderIds,
  columnConfig,
  columnDefs,
  locale,
  activeMoreActionsOrderId,
  onSelectAll,
  onSelectOrder,
  onMoreActions,
}) => (
  <ListTableSurface surfaceId="orders">
    <ListDataTable minWidth={1320}>
      <ListTableHead>
        <tr>
          <ListTableHeaderCell align="center" className="w-12">
            <input
              type="checkbox"
              aria-label={locale === "vi" ? "Chọn tất cả đơn hàng" : "Select all orders"}
              checked={selectedOrderIds.length === orders.length && orders.length > 0}
              onChange={onSelectAll}
              className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </ListTableHeaderCell>
          {columnConfig.visibleColumnOrder.map((key) => {
            const column = columnDefs.find((item) => item.key === key);
            if (!column) return null;
            return (
              <ListTableHeaderCell key={key} align={getColumnAlign(column)} className={`whitespace-nowrap ${column.width}`}>
                {locale === "vi" ? column.labelVi : column.labelEn}
              </ListTableHeaderCell>
            );
          })}
          <ListTableHeaderCell align="center" sticky="right" className="w-20">
            {locale === "vi" ? "Thao tác" : "Actions"}
          </ListTableHeaderCell>
        </tr>
      </ListTableHead>
      <ListTableBody>
        {orders.map((order) => {
          const isSelected = selectedOrderIds.includes(order.id);
          return (
            <ListTableRow key={order.id} selected={isSelected}>
              <ListTableCell align="center" density="compact" className="w-12">
                <input
                  type="checkbox"
                  aria-label={locale === "vi" ? `Chọn đơn hàng ${order.orderNumber}` : `Select order ${order.orderNumber}`}
                  checked={isSelected}
                  onChange={() => onSelectOrder(order.id)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </ListTableCell>
              {columnConfig.visibleColumnOrder.map((key) => {
                const column = columnDefs.find((item) => item.key === key);
                if (!column) return null;
                return (
                  <ListTableCell key={key} align={getColumnAlign(column)} density="compact" className={`${column.width} ${column.cellClassName ?? ""}`}>
                    {column.render(order)}
                  </ListTableCell>
                );
              })}
              <ListTableCell align="center" sticky="right" density="compact" className="w-20">
                <ActionDropdownTrigger
                  isOpen={activeMoreActionsOrderId === order.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoreActions(order, event.currentTarget);
                  }}
                  title={locale === "vi" ? `Thao tác đơn hàng ${order.orderNumber}` : `Order actions ${order.orderNumber}`}
                />
              </ListTableCell>
            </ListTableRow>
          );
        })}
      </ListTableBody>
    </ListDataTable>
  </ListTableSurface>
);
