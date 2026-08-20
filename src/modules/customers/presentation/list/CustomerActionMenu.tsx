import React from "react";
import {
  Archive,
  BriefcaseBusiness,
  CheckSquare,
  Eye,
  FileText,
  Link2,
  ShoppingBag,
} from "lucide-react";
import { MenuItemButton } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { CustomerListRow } from "./customerList.types";

interface CustomerActionMenuProps {
  row: CustomerListRow;
  onClose(): void;
  onViewDetails(customerId: string): void;
  onOpenSource(row: CustomerListRow): void;
  onCreateOpportunity(row: CustomerListRow): void;
  onCreateQuote(row: CustomerListRow): void;
  onCreateOrder(row: CustomerListRow): void;
  onCreateTask(row: CustomerListRow): void;
  onArchive(row: CustomerListRow): void;
}

export const CustomerActionMenu: React.FC<CustomerActionMenuProps> = ({
  row,
  onClose,
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
  const isArchived = row.customer.status === "ARCHIVED";

  const run = (event: React.MouseEvent, action: () => void) => {
    event.stopPropagation();
    onClose();
    action();
  };

  return (
    <div className="customer-action-menu w-full bg-white rounded-2xl border border-slate-200 outline-none shadow-xl p-1.5 font-sans text-left space-y-0.5 max-h-[380px] overflow-y-auto crm-scroll-y">
      <MenuItemButton onClick={(event) => run(event, () => onViewDetails(row.customer.id))} icon={<Eye size={13} className="text-slate-500" />}>
        {isVi ? "Xem Customer 360" : "View Customer 360"}
      </MenuItemButton>

      {!isArchived && (
        <>
          <MenuItemButton onClick={(event) => run(event, () => onCreateOpportunity(row))} variant="primary" icon={<BriefcaseBusiness size={13} />}>
            <span className="font-semibold">{isVi ? "Tạo cơ hội mới" : "Create opportunity"}</span>
          </MenuItemButton>
          <MenuItemButton onClick={(event) => run(event, () => onCreateQuote(row))} icon={<FileText size={13} className="text-pink-600" />}>
            {isVi ? "Tạo báo giá" : "Create quote"}
          </MenuItemButton>
          <MenuItemButton onClick={(event) => run(event, () => onCreateOrder(row))} icon={<ShoppingBag size={13} className="text-emerald-600" />}>
            {isVi ? "Tạo đơn hàng" : "Create order"}
          </MenuItemButton>
          <MenuItemButton onClick={(event) => run(event, () => onCreateTask(row))} icon={<CheckSquare size={13} className="text-purple-600" />}>
            {isVi ? "Giao việc" : "Create task"}
          </MenuItemButton>
        </>
      )}

      <div className="border-t border-slate-100 my-1" />
      <MenuItemButton onClick={(event) => run(event, () => onOpenSource(row))} icon={<Link2 size={13} className="text-indigo-500" />}>
        {isVi ? "Mở liên hệ / tổ chức nguồn" : "Open source Contact / Organization"}
      </MenuItemButton>

      {!isArchived && (
        <>
          <div className="border-t border-slate-100 my-1" />
          <MenuItemButton onClick={(event) => run(event, () => onArchive(row))} icon={<Archive size={13} className="text-amber-500" />}>
            {isVi ? "Đưa vào lưu trữ" : "Archive"}
          </MenuItemButton>
        </>
      )}
    </div>
  );
};
