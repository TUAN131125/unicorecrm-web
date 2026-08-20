import React from "react";
import { Lock } from "lucide-react";
import { ListBulkActionBar } from "@/components/crm/list-archetype";

export interface OrderBulkActionBarProps {
  selectedCount: number;
  canCompleteOrder: boolean;
  locale: string;
  onComplete: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onClear: () => void;
}

export const OrderBulkActionBar: React.FC<OrderBulkActionBarProps> = ({ selectedCount, canCompleteOrder, locale, onComplete, onCancel, onArchive, onClear }) => {
  const vi = locale === "vi";
  return (
    <ListBulkActionBar selectedCount={selectedCount} label={vi ? "Đã chọn đơn hàng" : "Orders selected"} onClear={onClear}>
      <button type="button" onClick={onComplete} disabled={!canCompleteOrder} className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium shadow-sm ${canCompleteOrder ? "bg-emerald-600 text-white hover:bg-emerald-700" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}>
        {!canCompleteOrder && <Lock size={12} />}{vi ? "Hoàn tất đủ điều kiện" : "Complete eligible"}
      </button>
      <button type="button" onClick={onCancel} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100">{vi ? "Hủy đơn" : "Cancel"}</button>
      <button type="button" onClick={onArchive} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">{vi ? "Lưu trữ" : "Archive"}</button>
    </ListBulkActionBar>
  );
};
