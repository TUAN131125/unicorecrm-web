import React from "react";
import { Clock, Mail, MoreHorizontal, Phone } from "lucide-react";
import { Avatar, Badge, Checkbox, IconButton, RowActionPortal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { CustomerStatusBadge } from "../components/CustomerStatusBadge";
import { CustomerActionMenu } from "./CustomerActionMenu";
import { formatCustomerDate } from "./customerList.helpers";
import type { CustomerListRow } from "./customerList.types";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";
import { localizeBusinessDescriptor } from "@/shared/lib/i18n/businessDescriptorLabels";

interface CustomerCardListProps {
  rows: CustomerListRow[];
  selectedCustomerIds: string[];
  onSelectRow(id: string, checked: boolean): void;
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

export const CustomerCardList: React.FC<CustomerCardListProps> = ({
  rows,
  selectedCustomerIds,
  onSelectRow,
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

  return (
    <>
      <div data-data-surface="list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3 font-sans">
        {rows.map((row) => {
          const isSelected = selectedCustomerIds.includes(row.customer.id);
          const owner = getWorkspaceMemberOptions().find((user) => user.id === (row.customer.careOwnerId || row.model.identity.ownerId)) || getWorkspaceMemberOptions()[0];
          const ownerName = owner?.name || "System Owner";
          const phone = row.model.identity.phone;
          const email = row.model.identity.email;

          return (
            <div
              key={row.customer.id}
              className={`border rounded-2xl p-4 space-y-3 bg-white shadow-sm transition-all ${
                isSelected ? "border-indigo-400 ring-1 ring-indigo-400 bg-indigo-50/10" : "border-slate-100"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Checkbox
                    id={`customer-card-checkbox-${row.customer.id}`}
                    checked={isSelected}
                    onChange={(event) => onSelectRow(row.customer.id, event.target.checked)}
                    className="mt-0"
                  />
                  <div className="min-w-0">
                    <h4
                      onClick={() => onViewDetails(row.customer.id)}
                      className="font-medium text-sm text-indigo-600 hover:underline cursor-pointer crm-text-wrap"
                    >
                      {row.model.identity.displayName}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">{row.customer.customerCode}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  <CustomerStatusBadge status={row.customer.status} locale={isVi ? "vi" : "en"} />
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
                  >
                    <MoreHorizontal size={14} className="text-slate-500" />
                  </IconButton>
                </div>
              </div>

              <div className="text-xs font-medium text-slate-700">
                {row.customer.type === "B2B" ? "🏢" : "👤"} {row.model.identity.primaryContact?.fullName || row.model.identity.primaryContact?.name || localizeBusinessDescriptor(row.customer.segment, isVi ? "vi" : "en") || (isVi ? "Khách hàng" : "Customer")}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-50 text-[10px] text-slate-500">
                {phone && (
                  <div className="flex items-center gap-1">
                    <Phone size={10} className="text-teal-500 shrink-0" />
                    <span className="font-mono whitespace-nowrap">{phone}</span>
                  </div>
                )}
                {email && (
                  <div className="flex items-center gap-1 crm-text-wrap">
                    <Mail size={10} className="text-slate-400 shrink-0" />
                    <span className="crm-text-wrap">{email}</span>
                  </div>
                )}
                {row.customer.nextCareAt && (
                  <div className="col-span-2 flex items-center gap-1 text-slate-600 font-medium">
                    <Clock size={10} className="text-indigo-400" />
                    <span>{isVi ? "Chăm sóc tiếp" : "Next care"}: {formatCustomerDate(row.customer.nextCareAt, isVi)}</span>
                  </div>
                )}
                <div className="col-span-2 flex flex-wrap gap-1">
                  {row.customer.segment && <Badge variant="neutral" className="text-[9px]">{localizeBusinessDescriptor(row.customer.segment, isVi ? "vi" : "en")}</Badge>}
                  {row.customer.tags.slice(0, 2).map((tag) => <Badge key={tag} variant="neutral" className="text-[9px]">{localizeBusinessDescriptor(tag, isVi ? "vi" : "en")}</Badge>)}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-50">
                <div className="flex items-center gap-1 min-w-0">
                  <Avatar src={owner?.avatarUrl} name={ownerName} className="h-4 w-4" />
                  <span className="font-medium text-slate-600 crm-text-wrap">{ownerName}</span>
                </div>
                <span className="font-mono">{formatCustomerDate(row.customer.createdAt, isVi)}</span>
              </div>
            </div>
          );
        })}
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
