import React from "react";
import { motion } from "motion/react";
import { Bookmark, ChevronRight } from "lucide-react";

export interface OperationSavedViewItem {
  key: string;
  label: string;
  count?: number;
  description?: string;
  tone?: "slate" | "violet" | "sky" | "emerald" | "amber" | "rose";
}

const activeTone: Record<NonNullable<OperationSavedViewItem["tone"]>, string> = {
  slate: "border-slate-300 bg-slate-900 text-white",
  violet: "border-violet-300 bg-violet-600 text-white",
  sky: "border-sky-300 bg-sky-600 text-white",
  emerald: "border-emerald-300 bg-emerald-600 text-white",
  amber: "border-amber-300 bg-amber-500 text-white",
  rose: "border-rose-300 bg-rose-600 text-white",
};

export const OperationSavedViews: React.FC<{
  items: OperationSavedViewItem[];
  activeKey: string;
  onChange: (key: string) => void;
  title?: string;
}> = ({ items, activeKey, onChange, title = "Saved views" }) => (
  <div data-operation-saved-views="v1" className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex shrink-0 items-center gap-2 px-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
        <Bookmark size={13} />{title}<ChevronRight size={12} />
      </div>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <motion.button
            layout
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            title={item.description}
            className={`group inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${active ? activeTone[item.tone ?? "violet"] : "border-transparent bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"}`}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? "bg-white/20 text-white" : "bg-white text-slate-500 shadow-sm"}`}>{item.count}</span>}
          </motion.button>
        );
      })}
    </div>
  </div>
);
