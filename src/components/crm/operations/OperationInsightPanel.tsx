import React from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button, type ButtonVariant } from "@/shared/components/ui";

export interface OperationInsightItem {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

const toneClass = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export const OperationInsightPanel: React.FC<{
  title: string;
  description?: string;
  score?: number;
  scoreLabel?: string;
  items: OperationInsightItem[];
  blockers?: string[];
  nextAction?: { title?: string; label: string; description?: string; actionLabel?: string; onClick?: () => void; variant?: ButtonVariant };
  children?: React.ReactNode;
}> = ({ title, description, score, scoreLabel = "Readiness", items, blockers = [], nextAction, children }) => {
  const reduceMotion = useReducedMotion();
  const scoreTone = typeof score === "number" && score >= 85 ? "text-emerald-700" : typeof score === "number" && score >= 60 ? "text-amber-700" : "text-rose-700";
  return <aside data-operation-insight-panel="v1" className="space-y-4 lg:sticky lg:top-4 lg:self-start">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Sparkles size={15} className="text-violet-600" />{title}</div>
        {description && <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-slate-500">{description}</p>}
      </div>
      <div className="space-y-4 p-5">
        {typeof score === "number" && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{scoreLabel}</div><div className={`mt-1 text-3xl font-black ${scoreTone}`}>{Math.round(score)}%</div></div><div className="text-right text-[11px] font-semibold text-slate-500">{score >= 85 ? "Sẵn sàng vận hành" : score >= 60 ? "Cần bổ sung" : "Đang bị chặn"}</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><motion.div initial={reduceMotion ? false : { width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, score))}%` }} className={`h-full rounded-full ${score >= 85 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-rose-500"}`} /></div></div>}
        <div className="grid gap-2">{items.map((item) => <div key={item.label} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs ${toneClass[item.tone ?? "neutral"]}`}><span className="font-semibold opacity-75">{item.label}</span><span className="text-right font-black">{item.value}</span></div>)}</div>
        {blockers.length > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3"><div className="flex items-center gap-2 text-xs font-black text-rose-800"><AlertTriangle size={14} />Blocker cần xử lý</div><div className="mt-2 space-y-1.5">{blockers.slice(0, 5).map((blocker) => <div key={blocker} className="flex gap-2 text-[11px] font-semibold leading-relaxed text-rose-700"><span>•</span><span>{blocker}</span></div>)}</div></div>}
        {blockers.length === 0 && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800"><CheckCircle2 size={14} />Không có blocker bắt buộc</div>}
        {nextAction && <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-500">{nextAction.title ?? "Bước tiếp theo"}</div><div className="mt-1 text-sm font-black text-violet-950">{nextAction.label}</div>{nextAction.description && <p className="mt-1 text-[11px] font-medium leading-relaxed text-violet-800/80">{nextAction.description}</p>}{nextAction.onClick && <Button type="button" variant={nextAction.variant ?? "primary"} size="sm" className="mt-3 w-full whitespace-nowrap" onClick={nextAction.onClick}>{nextAction.actionLabel ?? "Thực hiện"}</Button>}</div>}
        {children}
      </div>
    </section>
  </aside>;
};
