import React from "react";
import { Check, Circle, LockKeyhole, Minus } from "lucide-react";

export interface OperationLifecycleStep {
  key: string;
  label: string;
  description?: string;
  state: "done" | "current" | "next" | "blocked" | "skipped";
}

export const OperationLifecycleRail: React.FC<{ steps: OperationLifecycleStep[] }> = ({ steps }) => (
  <div data-operation-lifecycle="v1" className="space-y-0">
    {steps.map((step, index) => {
      const completeForFlow = step.state === "done" || step.state === "skipped";
      return <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0" data-lifecycle-step-state={step.state}>
        {index < steps.length - 1 && <div className={`absolute left-[15px] top-8 h-[calc(100%-14px)] w-px ${completeForFlow ? "bg-emerald-300" : "bg-slate-200"}`} />}
        <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${step.state === "done" ? "border-emerald-500 bg-emerald-500 text-white" : step.state === "skipped" ? "border-slate-300 bg-slate-100 text-slate-500" : step.state === "current" ? "border-violet-500 bg-violet-50 text-violet-700 shadow-[0_0_0_4px_rgba(139,92,246,0.12)]" : step.state === "blocked" ? "border-rose-300 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-slate-300"}`}>{step.state === "done" ? <Check size={14} strokeWidth={3} /> : step.state === "skipped" ? <Minus size={14} strokeWidth={2.5} /> : step.state === "blocked" ? <LockKeyhole size={13} /> : <Circle size={9} fill="currentColor" />}</div>
        <div className="min-w-0 pt-0.5"><div className={`text-xs font-semibold ${step.state === "current" ? "text-violet-800" : step.state === "done" ? "text-emerald-800" : step.state === "blocked" ? "text-rose-700" : "text-slate-500"}`}>{step.label}</div></div>
      </div>;
    })}
  </div>
);
