import React from "react";
import { CheckCircle2, X } from "lucide-react";

interface ListBulkActionBarProps {
  selectedCount: number;
  label: string;
  children: React.ReactNode;
  onClear?: () => void;
  className?: string;
}

export const ListBulkActionBar: React.FC<ListBulkActionBarProps> = ({
  selectedCount,
  label,
  children,
  onClear,
  className = "",
}) => {
  if (selectedCount <= 0) return null;

  return (
    <div
      data-list-bulk-actions="v1"
      className={`flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between ${className}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-950">
        <CheckCircle2 size={16} className="text-indigo-600" />
        <span>{label}: {selectedCount}</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-200 bg-white text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
