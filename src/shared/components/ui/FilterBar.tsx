import React from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/classnames/cn";
import { useI18n } from "@/i18n";

export const FilterBar: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return (
    <div className={cn("flex flex-wrap gap-2.5 items-center justify-between pb-4 text-xs select-none", className)}>
      {children}
    </div>
  );
};

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearchChange: (val: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onSearchChange,
  className,
  placeholder,
  ...props
}) => {
  const { tx } = useI18n();
  const resolvedPlaceholder = placeholder || tx("common.searchPlaceholder", "Search...");
  return (
    <div className="relative max-w-xs w-full text-left">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="text"
        className={cn(
          "w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 transition-all duration-150 shadow-sm",
          className
        )}
        placeholder={resolvedPlaceholder}
        value={value}
        onChange={(e) => onSearchChange(e.target.value)}
        {...props}
      />
    </div>
  );
};

export interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick, icon }) => {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all duration-150 select-none cursor-pointer border",
        active
          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
