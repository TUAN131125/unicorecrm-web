import React from "react";
import { Search, X, List, Grid, Layers, BarChart2, Filter, Sliders } from "lucide-react";
import { useI18n } from "@/i18n";

export type ListViewMode = "table" | "card" | "kanban" | "list";

export type ListControlBarViewOption = {
  value: ListViewMode;
  label: string;
  icon?: React.ReactNode;
};

export type ListControlBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  viewMode?: ListViewMode;
  onViewModeChange?: (mode: ListViewMode) => void;
  viewOptions?: ListControlBarViewOption[];

  onOpenStats?: () => void;
  onOpenFilters?: () => void;
  onCloseFilters?: () => void;
  filtersOpen?: boolean;
  filtersPanel?: React.ReactNode;
  onOpenColumns?: () => void;

  statsLabel?: string;
  filtersLabel?: string;
  columnsLabel?: string;

  activeFilterCount?: number;
  hasActiveFilters?: boolean;

  showStats?: boolean;
  showFilters?: boolean;
  showColumns?: boolean;

  disabled?: boolean;

  leftSlot?: React.ReactNode;
  controlsPrefix?: React.ReactNode;
  rightSlot?: React.ReactNode;
  compactControls?: boolean;
  controlsClassName?: string;
  className?: string;
};

export const ListControlBar: React.FC<ListControlBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  viewMode,
  onViewModeChange,
  viewOptions,
  onOpenStats,
  onOpenFilters,
  onCloseFilters,
  filtersOpen = false,
  filtersPanel,
  onOpenColumns,
  statsLabel,
  filtersLabel,
  columnsLabel,
  activeFilterCount = 0,
  hasActiveFilters = false,
  showStats = false,
  showFilters = false,
  showColumns = false,
  disabled = false,
  leftSlot,
  controlsPrefix,
  rightSlot,
  compactControls = false,
  controlsClassName = "",
  className = "",
}) => {
  const { tx } = useI18n();
  const isFiltersActive = hasActiveFilters || activeFilterCount > 0;
  const clearSearchLabel = tx("common.clearSearch", "Clear search");
  const viewToggleLabel = tx("common.viewToggle", "Change view");
  const resolvedSearchPlaceholder = searchPlaceholder || tx("common.searchPlaceholder", "Search...");
  const filterPopoverRef = React.useRef<HTMLDivElement>(null);
  const filterPanelId = React.useId();
  const secondaryActionClassName = compactControls
    ? "h-8 w-8 border border-transparent bg-transparent p-0 text-slate-600 shadow-none hover:bg-white hover:text-violet-700"
    : "h-10 border border-slate-200 bg-white p-2.5 text-slate-600 shadow-xs hover:bg-slate-50 hover:text-violet-700";

  React.useEffect(() => {
    if (!filtersOpen || !onCloseFilters) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !filterPopoverRef.current?.contains(event.target)) {
        onCloseFilters();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseFilters();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen, onCloseFilters]);

  return (
    <div ref={filterPopoverRef} className={`relative grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs font-sans xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center ${className}`}>
      {/* Search Bar / Left Slot */}
      <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={disabled}
            placeholder={resolvedSearchPlaceholder}
            aria-label={resolvedSearchPlaceholder}
            className="w-full text-xs pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:bg-white rounded-xl transition-all font-medium text-slate-800 disabled:opacity-50"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              disabled={disabled}
              aria-label={clearSearchLabel}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
            >
              <X size={13} />
            </button>
          )}
        </div>
        {leftSlot}
      </div>

      {/* View Toggle and Actions / Right Slot */}
      <div className={`flex min-w-0 flex-wrap items-center justify-start gap-2 xl:justify-end ${controlsClassName}`}>
        {controlsPrefix}

        {/* View mode toggle group */}
        {viewMode && onViewModeChange && viewOptions && viewOptions.length > 0 && (
          <div className={`flex items-center rounded-xl ${compactControls ? "border border-transparent bg-transparent p-0" : "border border-slate-200 bg-slate-100 p-1"}`} role="group" aria-label={viewToggleLabel}>
            {viewOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onViewModeChange(opt.value)}
                disabled={disabled}
                aria-pressed={viewMode === opt.value}
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-xs font-sans font-medium transition-all ${
                  viewMode === opt.value
                    ? "bg-white text-violet-700 font-semibold shadow-xs ring-1 ring-slate-200"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                } disabled:opacity-50`}
                title={opt.label}
              >
                {opt.icon || (opt.value === "table" ? <List size={14} /> : opt.value === "card" ? <Grid size={14} /> : <Layers size={14} />)}
              </button>
            ))}
          </div>
        )}

        {/* Statistics trigger */}
        {showStats && onOpenStats && (
          <button
            type="button"
            onClick={onOpenStats}
            disabled={disabled}
            className={`flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${secondaryActionClassName}`}
            title={statsLabel || "Statistics"}
          >
            <BarChart2 size={15} />
            <span className={compactControls ? "sr-only" : "hidden sm:inline"}>{statsLabel || "Stats"}</span>
          </button>
        )}

        {/* Filters Trigger */}
        {showFilters && onOpenFilters && (
          <div>
            <button
              type="button"
              onClick={onOpenFilters}
              disabled={disabled}
              aria-expanded={filtersPanel ? filtersOpen : undefined}
              aria-haspopup={filtersPanel ? "dialog" : undefined}
              aria-controls={filtersPanel ? filterPanelId : undefined}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all font-sans ${compactControls ? "h-8 w-8 px-0" : "h-10 border px-3 shadow-xs"} ${
                isFiltersActive
                  ? compactControls
                    ? "bg-white text-violet-700 shadow-xs ring-1 ring-violet-200"
                    : "border-violet-200 bg-violet-50 text-violet-700"
                  : compactControls
                    ? "text-slate-600 hover:bg-white hover:text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              } disabled:opacity-50`}
              title={filtersLabel || "Filters"}
            >
              <Filter size={15} />
              <span className={compactControls ? "sr-only" : undefined}>{filtersLabel || "Filters"}</span>
              {compactControls && isFiltersActive ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" /> : null}
            </button>
          </div>
        )}

        {/* Column settings trigger */}
        {showColumns && onOpenColumns && (
          <button
            type="button"
            onClick={onOpenColumns}
            disabled={disabled}
            className={`flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${secondaryActionClassName}`}
            title={columnsLabel || "Columns"}
          >
            <Sliders size={15} />
            <span className={compactControls ? "sr-only" : "hidden md:inline"}>{columnsLabel || "Columns"}</span>
          </button>
        )}

        {rightSlot}
      </div>

      {filtersOpen && filtersPanel ? <div id={filterPanelId} className="contents">{filtersPanel}</div> : null}
    </div>
  );
};
