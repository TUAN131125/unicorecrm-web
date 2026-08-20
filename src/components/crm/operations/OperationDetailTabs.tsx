import React from "react";
import { motion, useReducedMotion } from "motion/react";

export interface OperationDetailTabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  alert?: boolean;
}

export const OperationDetailTabs: React.FC<{
  items: OperationDetailTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}> = ({ items, activeKey, onChange, ariaLabel = "Detail tabs" }) => {
  const reduceMotion = useReducedMotion();
  const motionId = `operation-detail-tab-${React.useId().replace(/:/g, "")}`;

  const selectTab = (key: string) => {
    if (key === activeKey) return;
    onChange(key);
  };

  return (
    <nav
      data-operation-detail-tabs="v2"
      className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={ariaLabel}
    >
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => selectTab(item.key)}
              aria-selected={active}
              className={`group relative isolate inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-bold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35 ${active ? "text-violet-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              {active && (
                <motion.span
                  layoutId={motionId}
                  className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-violet-200 bg-violet-50 shadow-sm"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40, mass: 0.65 }}
                />
              )}
              <span className={`relative inline-flex items-center gap-2 transition-transform duration-150 ${active ? "" : "group-hover:-translate-y-px"}`}>
                {item.icon}
                {item.label}
                {typeof item.count === "number" && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black transition-colors duration-150 ${item.alert ? "bg-rose-100 text-rose-700" : active ? "bg-violet-200 text-violet-800" : "bg-slate-100 text-slate-500"}`}>
                    {item.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
