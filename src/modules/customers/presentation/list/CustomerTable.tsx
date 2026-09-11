import React from "react";
import { Mail, MoreHorizontal, Phone } from "lucide-react";
import { TableResizeHeader } from "@/components/crm/TableResizeHeader";
import { Avatar, Badge, Checkbox, IconButton, RowActionPortal, Table, TableBody, TableCell, TableHeader, TableRow } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { CustomerHealthBadge, CustomerStatusBadge, CustomerTypeBadge } from "../components/CustomerStatusBadge";
import { CustomerActionMenu } from "./CustomerActionMenu";
import { customerColumnLabel, formatCustomerCurrency, formatCustomerDate } from "./customerList.helpers";
import type { CustomerListRow } from "./customerList.types";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";
import { localizeBusinessDescriptor } from "@/shared/lib/i18n/businessDescriptorLabels";

interface CustomerTableProps {
  rows: CustomerListRow[];
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  selectedCustomerIds: string[];
  onSelectAll(checked: boolean): void;
  onSelectRow(id: string, checked: boolean): void;
  onColumnResize(event: React.MouseEvent, columnKey: string): void;
  onColumnReset(columnKey: string): void;
  openRowActionId: string | null;
  setOpenRowActionId(id: string | null): void;
  onViewDetails(customerId: string): void;
  onOpenSource(row: CustomerListRow): void;
  onCreateOpportunity(row: CustomerListRow): void;
  onCreateQuote(row: CustomerListRow): void;
  onCreateOrder(row: CustomerListRow): void;
  onCreateTask(row: CustomerListRow): void;
  onArchive(row: CustomerListRow): void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  rows,
  visibleColumns,
  columnWidths,
  selectedCustomerIds,
  onSelectAll,
  onSelectRow,
  onColumnResize,
  onColumnReset,
  openRowActionId,
  setOpenRowActionId,
  onViewDetails,
  onOpenSource,
  onCreateOpportunity,
  onCreateQuote,
  onCreateOrder,
  onCreateTask,
  onArchive,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const [rowActionAnchorEl, setRowActionAnchorEl] = React.useState<HTMLElement | null>(null);
  const activeRow = React.useMemo(
    () => rows.find((row) => row.customer.id === openRowActionId) || null,
    [openRowActionId, rows],
  );

  React.useEffect(() => {
    if (!openRowActionId) setRowActionAnchorEl(null);
  }, [openRowActionId]);

  const selectionWidth = columnWidths.selection || 48;
  const actionsWidth = columnWidths.actions || 80;
  const defaultColumnWidth = 150;
  const tableMinWidth = selectionWidth + actionsWidth + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] || defaultColumnWidth), 0);
  const allSelected = rows.length > 0 && rows.every((row) => selectedCustomerIds.includes(row.customer.id));

  return (
    <>
      <div className="overflow-x-auto crm-scroll-x font-sans rounded-2xl border border-slate-200 shadow-sm">
        <Table style={{ tableLayout: "fixed", width: "100%", minWidth: tableMinWidth }} className="min-w-full bg-white">
          <TableHeader>
            <TableRow className="bg-slate-50/70 border-b border-slate-200">
              <TableCell
                style={{ width: selectionWidth, minWidth: selectionWidth, maxWidth: selectionWidth }}
                className="text-center select-none sticky left-0 bg-slate-50 z-20 p-2.5 border-r border-slate-100"
              >
                <div className="flex justify-center items-center">
                  <Checkbox checked={allSelected} onChange={(event) => onSelectAll(event.target.checked)} />
                </div>
              </TableCell>

              {visibleColumns.map((columnKey) => (
                <TableResizeHeader
                  key={columnKey}
                  colKey={columnKey}
                  width={columnWidths[columnKey] || defaultColumnWidth}
                  label={customerColumnLabel(columnKey, isVi)}
                  onResize={onColumnResize}
                  onReset={onColumnReset}
                  tooltip={isVi ? "Kéo để đổi kích thước, gõ đúp để khôi phục" : "Drag to resize, double-click to restore"}
                />
              ))}

              <TableCell
                style={{ width: actionsWidth, minWidth: actionsWidth, maxWidth: actionsWidth }}
                className="font-medium text-slate-700 text-[11px] uppercase tracking-wider text-center sticky right-0 bg-slate-50 py-2 px-3 whitespace-nowrap z-20 border-l border-slate-100"
              >
                {isVi ? "Thao tác" : "Actions"}
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => {
              const isSelected = selectedCustomerIds.includes(row.customer.id);
              return (
                <TableRow
                  key={row.customer.id}
                  className={`hover:bg-indigo-50/10 border-b border-indigo-50/40 transition-colors ${isSelected ? "bg-indigo-50/20" : ""}`}
                >
                  <TableCell
                    style={{ width: selectionWidth, minWidth: selectionWidth, maxWidth: selectionWidth }}
                    className="text-center p-2.5 sticky left-0 bg-white/95 select-none z-10 border-r border-slate-100"
                  >
                    <div className="flex justify-center items-center">
                      <Checkbox checked={isSelected} onChange={(event) => onSelectRow(row.customer.id, event.target.checked)} />
                    </div>
                  </TableCell>

                  {visibleColumns.map((columnKey) => (
                    <TableCell
                      key={columnKey}
                      style={{ width: columnWidths[columnKey] || defaultColumnWidth, minWidth: columnWidths[columnKey] || defaultColumnWidth, maxWidth: columnWidths[columnKey] || defaultColumnWidth }}
                      className="py-2.5 px-3 text-[11px] text-slate-600 overflow-hidden"
                    >
                      {renderCustomerCell(row, columnKey, isVi, onViewDetails)}
                    </TableCell>
                  ))}

                  <TableCell
                    style={{ width: actionsWidth, minWidth: actionsWidth, maxWidth: actionsWidth }}
                    className="text-center sticky right-0 bg-white/95 z-10 border-l border-slate-100 py-2 px-2"
                  >
                    <IconButton
                      onClick={(event) => {
                        event.stopPropagation();
                        const target = event.currentTarget as HTMLElement;
                        if (openRowActionId === row.customer.id) {
                          setOpenRowActionId(null);
                          setRowActionAnchorEl(null);
                        } else {
                          setOpenRowActionId(row.customer.id);
                          setRowActionAnchorEl(target);
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-slate-700 p-1"
                      aria-label={`${isVi ? "Thao tác" : "Actions"} ${row.model.identity.displayName}`}
                    >
                      <MoreHorizontal size={14} className="text-slate-500" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <RowActionPortal
        open={Boolean(openRowActionId && activeRow)}
        anchorEl={rowActionAnchorEl}
        onClose={() => {
          setOpenRowActionId(null);
          setRowActionAnchorEl(null);
        }}
        width={256}
      >
        {activeRow && (
          <CustomerActionMenu
            row={activeRow}
            onClose={() => {
              setOpenRowActionId(null);
              setRowActionAnchorEl(null);
            }}
            onViewDetails={onViewDetails}
            onOpenSource={onOpenSource}
            onCreateOpportunity={onCreateOpportunity}
            onCreateQuote={onCreateQuote}
            onCreateOrder={onCreateOrder}
            onCreateTask={onCreateTask}
            onArchive={onArchive}
          />
        )}
      </RowActionPortal>
    </>
  );
};

function renderCustomerCell(
  row: CustomerListRow,
  columnKey: string,
  isVi: boolean,
  onViewDetails: (customerId: string) => void,
): React.ReactNode {
  const { customer, model } = row;
  const owner = getWorkspaceMemberOptions().find((user) => user.id === (customer.careOwnerId || model.identity.ownerId));
  const primaryContactName = model.identity.primaryContact?.fullName || model.identity.primaryContact?.name;

  switch (columnKey) {
    case "code":
      return <span className="font-mono text-[10.5px] font-medium text-slate-500 bg-slate-100/70 px-1.5 py-0.5 rounded">{customer.customerCode}</span>;
    case "customer":
      return (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 bg-indigo-600/10 text-indigo-700 flex items-center justify-center font-medium text-[10px] uppercase shrink-0 border border-indigo-600/20">
            {model.identity.displayName.substring(0, 1)}
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onViewDetails(customer.id)}
              className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer text-xs whitespace-nowrap crm-text-wrap block max-w-full"
            >
              {model.identity.displayName}
            </button>
            <div className="flex items-center gap-1 mt-0.5 min-w-0">
              {customer.segment && <span className="text-[9px] text-slate-400 crm-text-wrap">{localizeBusinessDescriptor(customer.segment, isVi ? "vi" : "en")}</span>}
              {customer.tags.slice(0, 1).map((tag) => <Badge key={tag} variant="neutral" className="text-[8px] px-1 py-0">{localizeBusinessDescriptor(tag, isVi ? "vi" : "en")}</Badge>)}
            </div>
          </div>
        </div>
      );
    case "primaryContact":
      return primaryContactName ? (
        <div className="min-w-0">
          <span className="font-medium text-slate-700 crm-text-wrap block">{primaryContactName}</span>
          <span className="text-[9px] text-slate-400 crm-text-wrap block">{model.identity.primaryContact?.roleTitle || model.identity.primaryContact?.title || "—"}</span>
        </div>
      ) : "—";
    case "phone":
      return model.identity.phone ? <span className="font-mono font-medium text-slate-700 whitespace-nowrap flex items-center gap-1"><Phone size={11} className="text-slate-400" />{model.identity.phone}</span> : "—";
    case "email":
      return model.identity.email ? <span className="font-medium text-slate-600 crm-text-wrap flex items-center gap-1"><Mail size={11} className="text-slate-400 shrink-0" /><span className="crm-text-wrap">{model.identity.email}</span></span> : "—";
    case "status": return <CustomerStatusBadge status={customer.status} locale={isVi ? "vi" : "en"} />;
    case "health": return <CustomerHealthBadge health={customer.health} locale={isVi ? "vi" : "en"} />;
    case "type": return <CustomerTypeBadge type={customer.type} />;
    case "segment": return customer.segment ? localizeBusinessDescriptor(customer.segment, isVi ? "vi" : "en") : "—";
    case "owner":
      return owner ? (
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar src={owner.avatarUrl} name={owner.name} className="h-5 w-5" />
          <span className="font-medium text-slate-600 crm-text-wrap">{owner.name}</span>
        </div>
      ) : "—";
    case "revenue": return <span className="font-semibold tabular-nums text-slate-800 whitespace-nowrap">{model.metrics.revenue === undefined ? "—" : formatCustomerCurrency(model.metrics.revenue, isVi)}</span>;
    case "orders": return <span className="font-medium text-slate-700">{model.metrics.orderCount ?? "—"}</span>;
    case "openDeals": return <span className="font-medium text-indigo-600">{model.metrics.openDealCount ?? "—"}</span>;
    case "openWork": return <span className="font-medium text-slate-700">{model.metrics.openTaskCount ?? "—"}</span>;
    case "openSupport": return <span className="font-medium text-slate-700">{model.metrics.openSupportCount ?? "—"}</span>;
    case "lastPurchase": return <span className="whitespace-nowrap">{formatCustomerDate(customer.lastPurchaseAt ?? undefined, isVi)}</span>;
    case "nextCare": return <span className="whitespace-nowrap">{formatCustomerDate(customer.nextCareAt, isVi)}</span>;
    default: return "—";
  }
}
