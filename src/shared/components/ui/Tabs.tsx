import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/classnames/cn";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  scrollClassName?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  className,
  scrollClassName = "crm-scroll-x",
}) => {
  const reduceMotion = useReducedMotion();
  const motionId = `tabs-${React.useId().replace(/:/g, "")}`;

  const selectTab = (id: string) => {
    if (id === activeId) return;
    onChange(id);
  };

  return (
    <div className={cn("border-b border-slate-200 flex gap-1 select-none", scrollClassName, className)}>
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            aria-selected={isActive}
            className={cn(
              "group relative isolate px-4 py-3 font-bold text-xs border-b-2 border-transparent flex min-w-0 max-w-full items-center gap-1.5 whitespace-normal text-center cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/35",
              isActive
                ? "text-indigo-700"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            )}
          >
            {isActive && (
              <>
                <motion.span
                  layoutId={`${motionId}-surface`}
                  className="pointer-events-none absolute inset-x-1 inset-y-1 -z-10 rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40, mass: 0.65 }}
                />
                <motion.span
                  layoutId={`${motionId}-indicator`}
                  className="pointer-events-none absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-indigo-600"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 560, damping: 44, mass: 0.55 }}
                />
              </>
            )}
            <span className={cn("relative transition-transform duration-150", isActive ? "text-indigo-600" : "text-slate-400 group-hover:-translate-y-px")}>{tab.icon}</span>
            <span className="relative crm-text-wrap">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={cn(
                "relative inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none shrink-0 transition-colors duration-150",
                isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export interface ResponsiveTabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  overflowLabel?: string;
  className?: string;
  overflowMode?: "dropdown" | "scroll";
  motionId?: string;
  /**
   * Forces a pre-paint width measurement when a sibling layout region changes,
   * such as an interaction panel opening or closing beside the tab workspace.
   */
  reflowKey?: string | number | boolean;
}

export const ResponsiveTabs: React.FC<ResponsiveTabsProps> = ({
  items,
  activeId,
  onChange,
  overflowLabel = "Khác",
  className,
  overflowMode = "dropdown",
  motionId,
  reflowKey,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measurementRailRef = React.useRef<HTMLDivElement>(null);
  const overflowMeasurementRef = React.useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = React.useState(items.length);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const generatedMotionId = `responsive-tabs-${React.useId().replace(/:/g, "")}`;
  const resolvedMotionId = motionId ?? generatedMotionId;
  const isScrollable = overflowMode === "scroll";
  const measurementKey = React.useMemo(
    () => items.map((item) => `${item.id}:${item.label}:${item.badge ?? ""}:${item.icon ? 1 : 0}`).join("|"),
    [items],
  );

  const selectTab = (id: string) => {
    if (id === activeId) return;
    onChange(id);
  };

  const measureLayout = React.useCallback(() => {
    if (isScrollable) {
      setVisibleCount((current) => current === items.length ? current : items.length);
      return;
    }

    const container = containerRef.current;
    const measurementRail = measurementRailRef.current;
    if (!container || !measurementRail) return;

    const containerStyle = window.getComputedStyle(container);
    const horizontalInsets = [
      containerStyle.paddingLeft,
      containerStyle.paddingRight,
      containerStyle.borderLeftWidth,
      containerStyle.borderRightWidth,
    ].reduce((sum, value) => sum + (Number.parseFloat(value || "0") || 0), 0);
    const availableWidth = Math.max(
      0,
      Math.floor(container.getBoundingClientRect().width - horizontalInsets) - 4,
    );
    const itemWidths = Array.from(
      measurementRail.querySelectorAll<HTMLElement>('[data-responsive-tab-measure="item"]'),
      (node) => Math.ceil(node.getBoundingClientRect().width),
    );

    if (itemWidths.length !== items.length || availableWidth <= 0) return;

    const measuredGap = Number.parseFloat(window.getComputedStyle(measurementRail).columnGap || "0") || 0;
    const totalWidth = itemWidths.reduce((sum, width) => sum + width, 0)
      + measuredGap * Math.max(0, itemWidths.length - 1);
    let nextVisibleCount = items.length;

    if (totalWidth > availableWidth) {
      const overflowWidth = Math.ceil(overflowMeasurementRef.current?.getBoundingClientRect().width ?? 96);
      const widthForTabs = Math.max(0, availableWidth - overflowWidth);
      let consumedWidth = 0;
      nextVisibleCount = 0;

      for (const itemWidth of itemWidths) {
        const nextWidth = itemWidth + (nextVisibleCount > 0 ? measuredGap : 0);
        if (consumedWidth + nextWidth > widthForTabs) break;
        consumedWidth += nextWidth;
        nextVisibleCount += 1;
      }

      // Keep the first workspace directly reachable even on very narrow surfaces.
      nextVisibleCount = Math.max(1, nextVisibleCount);
    }

    setVisibleCount((current) => current === nextVisibleCount ? current : nextVisibleCount);
  }, [isScrollable, items.length]);

  // Measure after the panel and main workspace have committed, but before paint.
  // This prevents a transient wrapped tab row while the interaction panel opens.
  React.useLayoutEffect(() => {
    measureLayout();
  }, [measureLayout, measurementKey, overflowLabel, reflowKey]);

  React.useEffect(() => {
    if (isScrollable) return;
    const container = containerRef.current;
    const measurementRail = measurementRailRef.current;
    if (!container || !measurementRail || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      // ResizeObserver runs in the pre-paint resize phase. Commit immediately;
      // delaying this measurement lets the rail wrap before tabs enter "Khác".
      measureLayout();
    });
    observer.observe(container);
    observer.observe(measurementRail);
    return () => observer.disconnect();
  }, [isScrollable, measureLayout]);

  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = () => setDropdownOpen(false);
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [dropdownOpen]);

  const safeVisibleCount = isScrollable ? items.length : Math.min(visibleCount, items.length);
  const visibleItems = items.slice(0, safeVisibleCount);
  const overflowItems = isScrollable ? [] : items.slice(safeVisibleCount);
  const isOverflowActive = overflowItems.some((item) => item.id === activeId);

  return (
    <div
      ref={containerRef}
      data-responsive-tabs="v3"
      className={cn("border-b border-slate-200 flex min-w-0 flex-nowrap items-center select-none relative w-full rounded-t-xl", className)}
    >
      {/* Exact off-screen measurements keep locale, icons and badges in the fit calculation. */}
      {!isScrollable && (
        <div
          ref={measurementRailRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute -left-[10000px] top-0 flex w-max flex-nowrap items-center md:gap-1.5"
        >
          {items.map((tab) => (
            <div
              key={`measure-${tab.id}`}
              data-responsive-tab-measure="item"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-3 text-xs font-bold"
            >
              <span className="shrink-0">{tab.icon}</span>
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== "" && (
                <span className="inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none">
                  {tab.badge}
                </span>
              )}
            </div>
          ))}
          <div
            ref={overflowMeasurementRef}
            data-responsive-tab-measure="overflow"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-3 text-xs font-bold"
          >
            <MoreHorizontal size={12} className="shrink-0" />
            <span>{overflowLabel}</span>
            <ChevronDown size={12} className="shrink-0" />
          </div>
        </div>
      )}

      {/* The visible rail never wraps. During a resize it clips for at most the
          current pre-paint measurement cycle instead of changing row height. */}
      <div
        data-responsive-tabs-visible-rail="true"
        className={cn(
          "flex min-w-0 flex-1 flex-nowrap md:gap-1.5",
          isScrollable
            ? "overflow-x-auto whitespace-nowrap scrollbar-none crm-scroll-x"
            : "overflow-hidden whitespace-nowrap",
        )}
      >
        {visibleItems.map((tab, idx) => {
          const isActive = tab.id === activeId;
          const isFirst = idx === 0;
          const isLastAndNoOverflow = idx === visibleItems.length - 1 && overflowItems.length === 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={cn(
                "group relative isolate flex shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-center text-xs font-bold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
                isActive
                  ? "border-transparent text-indigo-700"
                  : "border-transparent text-slate-500 hover:bg-slate-100/50 hover:text-slate-800",
                isFirst && "rounded-tl-xl",
                isLastAndNoOverflow && "rounded-tr-xl",
              )}
            >
              {isActive ? (
                <>
                  <motion.span
                    layoutId={`${resolvedMotionId}-surface`}
                    className="pointer-events-none absolute inset-0 -z-10 rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-[0_-1px_8px_rgba(15,23,42,0.04)]"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38, mass: 0.7 }}
                  />
                  <motion.span
                    layoutId={`${resolvedMotionId}-indicator`}
                    className="pointer-events-none absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-indigo-600"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }}
                  />
                </>
              ) : null}
              <span className={cn("shrink-0 transition-transform duration-200 group-hover:-translate-y-px", isActive ? "text-indigo-600" : "text-slate-400")}>{tab.icon}</span>
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== "" && (
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                    isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {overflowItems.length > 0 && (
        <div className="relative z-[1001] flex shrink-0 items-center">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDropdownOpen((previous) => !previous);
            }}
            className={cn(
              "relative isolate flex shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-tr-xl border-b-2 px-4 py-3 text-center text-xs font-bold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
              isOverflowActive
                ? "border-transparent text-indigo-700"
                : "border-transparent text-slate-500 hover:bg-slate-100/50 hover:text-slate-800",
            )}
          >
            {isOverflowActive ? (
              <>
                <motion.span
                  layoutId={`${resolvedMotionId}-surface`}
                  className="pointer-events-none absolute inset-0 -z-10 rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-[0_-1px_8px_rgba(15,23,42,0.04)]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38, mass: 0.7 }}
                />
                <motion.span
                  layoutId={`${resolvedMotionId}-indicator`}
                  className="pointer-events-none absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-indigo-600"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }}
                />
              </>
            ) : null}
            <MoreHorizontal size={12} className="shrink-0" />
            <span className="whitespace-nowrap">{overflowLabel}</span>
            <ChevronDown size={12} className={cn("shrink-0 transition-transform duration-200", dropdownOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full z-[1002] mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-xl focus:outline-none"
              >
                {overflowItems.map((tab) => {
                  const isActive = tab.id === activeId;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        selectTab(tab.id);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-xs font-bold transition-all hover:bg-slate-50",
                        isActive ? "bg-indigo-50/40 text-indigo-600" : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      <div className="flex max-w-[85%] items-center gap-1.5 crm-text-wrap">
                        <span className={cn(isActive ? "text-indigo-600" : "text-slate-400")}>{tab.icon}</span>
                        <span className="crm-text-wrap">{tab.label}</span>
                      </div>
                      {tab.badge !== undefined && tab.badge !== "" && (
                        <span
                          className={cn(
                            "inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                            isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
