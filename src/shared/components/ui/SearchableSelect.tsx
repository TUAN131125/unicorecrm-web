import React from "react";
import { AlertCircle, Check, ChevronDown, Search, X } from "lucide-react";
import { RowActionPortal } from "./Dialog";
import { cn } from "../../lib/classnames/cn";
import { useI18n } from "@/i18n";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  label?: React.ReactNode;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  menuWidth?: number;
  error?: string;
  selectedLabel?: string;
  ariaDescribedBy?: string;
}

const normalize = (value: string) => value
  .toLocaleLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  label,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearable = true,
  disabled = false,
  required = false,
  id,
  className,
  menuWidth = 420,
  error,
  selectedLabel,
  ariaDescribedBy,
}) => {
  const { tx } = useI18n();
  const resolvedPlaceholder = placeholder || tx("common.selectPlaceholder", "Select...");
  const resolvedSearchPlaceholder = searchPlaceholder || tx("common.searchPlaceholder", "Search...");
  const resolvedEmptyText = emptyText || tx("common.noMatchingResult", "No matching result");
  const clearSearchLabel = tx("common.clearSearch", "Clear search");
  const generatedId = React.useId();
  const controlId = id || `searchable-select-${generatedId.replace(/:/g, "")}`;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const resolvedSelectedLabel = selectedLabel || selected?.label;
  const filtered = React.useMemo(() => {
    const search = normalize(query.trim());
    if (!search) return options;
    return options.filter((option) => normalize(`${option.label} ${option.description || ""} ${option.keywords || ""}`).includes(search));
  }, [options, query]);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <div className={cn("block min-w-0 space-y-1.5", className)}>
      {label && <label htmlFor={controlId} className="block text-xs font-bold text-slate-600">{label}</label>}
      <button
        id={controlId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        onClick={(event) => {
          setAnchor(event.currentTarget);
          setOpen((current) => !current);
        }}
        className={cn("flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60", error ? "border-rose-300 hover:border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-300 hover:border-slate-400 focus:border-violet-400 focus:ring-violet-500/20")}
      >
        <span className={cn("min-w-0 flex-1 crm-text-wrap", !selected && "text-slate-400")}>{resolvedSelectedLabel || resolvedPlaceholder}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {required && <input type="text" required tabIndex={-1} aria-hidden="true" value={value} onChange={() => undefined} className="pointer-events-none absolute h-px w-px opacity-0" />}
      {error && <span id={errorId} role="alert" className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-600"><AlertCircle size={10} aria-hidden="true" /><span>{error}</span></span>}
      <RowActionPortal
        open={open}
        anchorEl={anchor}
        width={menuWidth}
        onClose={() => {
          setOpen(false);
          setAnchor(null);
        }}
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={resolvedSearchPlaceholder}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
              {query && (
                <button type="button" aria-label={clearSearchLabel} onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div role="listbox" className="max-h-80 overflow-y-auto p-2 crm-scroll-y">
            {clearable && value && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); setAnchor(null); }}
                className="mb-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50"
              >
                {resolvedPlaceholder}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm font-medium text-slate-400">{resolvedEmptyText}</div>
            ) : filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setAnchor(null);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  option.value === value ? "bg-violet-50 text-violet-800" : "text-slate-700 hover:bg-slate-50",
                  option.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block crm-text-wrap text-sm font-bold">{option.label}</span>
                  {option.description && <span className="mt-0.5 block crm-text-wrap text-xs font-medium text-slate-500">{option.description}</span>}
                </span>
                {option.value === value && <Check size={16} className="mt-0.5 shrink-0 text-violet-600" />}
              </button>
            ))}
          </div>
        </div>
      </RowActionPortal>
    </div>
  );
};
