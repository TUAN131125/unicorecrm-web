import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export type OperationMetricTone = "slate" | "violet" | "sky" | "emerald" | "amber" | "rose";

export interface OperationMetricItem {
  key: string;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: OperationMetricTone;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  onClick?: () => void;
}

const tones: Record<OperationMetricTone, { shell: string; icon: string; value: string; accent: string }> = {
  slate: { shell: "border-slate-200 bg-white", icon: "bg-slate-100 text-slate-600", value: "text-slate-950", accent: "bg-slate-400" },
  violet: { shell: "border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white", icon: "bg-violet-100 text-violet-700", value: "text-violet-950", accent: "bg-violet-500" },
  sky: { shell: "border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white", icon: "bg-sky-100 text-sky-700", value: "text-sky-950", accent: "bg-sky-500" },
  emerald: { shell: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white", icon: "bg-emerald-100 text-emerald-700", value: "text-emerald-950", accent: "bg-emerald-500" },
  amber: { shell: "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white", icon: "bg-amber-100 text-amber-700", value: "text-amber-950", accent: "bg-amber-500" },
  rose: { shell: "border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white", icon: "bg-rose-100 text-rose-700", value: "text-rose-950", accent: "bg-rose-500" },
};

export const OperationMetricGrid: React.FC<{ items: OperationMetricItem[]; className?: string }> = ({ items, className = "" }) => {
  const reduceMotion = useReducedMotion();
  return (
    <div data-operation-metrics="v1" className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6 ${className}`}>
      {items.map((item, index) => {
        const tone = tones[item.tone ?? "slate"];
        const Component = item.onClick ? "button" : "div";
        return (
          <motion.div
            key={item.key}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : index * 0.035 }}
          >
            <Component
              type={item.onClick ? "button" : undefined}
              onClick={item.onClick}
              className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone.shell} ${item.onClick ? "cursor-pointer" : ""}`}
            >
              <span className={`absolute inset-x-0 top-0 h-0.5 ${tone.accent}`} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{item.label}</div>
                  <div className={`mt-2 crm-text-wrap text-2xl font-black tracking-tight ${tone.value}`}>{item.value}</div>
                </div>
                {item.icon && <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>{item.icon}</div>}
              </div>
              <div className="mt-3 flex min-h-5 items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
                <span className="crm-text-wrap">{item.hint ?? "Cập nhật theo dữ liệu hiện tại"}</span>
                {item.trend && <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-extrabold text-slate-500">{item.trend === "up" ? <ArrowUpRight size={12} /> : item.trend === "down" ? <ArrowDownRight size={12} /> : <Minus size={12} />}{item.trendLabel}</span>}
              </div>
            </Component>
          </motion.div>
        );
      })}
    </div>
  );
};
