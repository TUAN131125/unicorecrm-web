import React from "react";
import { Check, Circle, ExternalLink } from "lucide-react";
import { CHECKLISTS } from "@/guidance/application/guidanceRegistry";
import { hasAllCapabilities, hasAnyCapability, localize } from "@/guidance/domain/guidance.rules";
import { useGuidance } from "./GuidanceContext";

export const GuidanceChecklist: React.FC = () => {
  const guidance = useGuidance();
  const visible = CHECKLISTS
    .filter((checklist) => hasAnyCapability(checklist.requiredAnyCapabilities, guidance.can))
    .map((checklist) => ({ ...checklist, items: checklist.items.filter((item) => hasAllCapabilities(item.requiredCapabilities, guidance.can)) }))
    .filter((checklist) => checklist.items.length > 0);

  if (visible.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="guidance-checklist-title">
      <div>
        <h3 id="guidance-checklist-title" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{guidance.locale === "vi" ? "Bắt đầu nhanh" : "Getting started"}</h3>
        <p className="mt-1 text-xs font-medium text-slate-500">{guidance.locale === "vi" ? "Checklist chỉ hiển thị các bước bạn có quyền thực hiện." : "The checklist only shows steps you are allowed to perform."}</p>
      </div>
      {visible.map((checklist) => {
        const completed = new Set(guidance.progress.completedChecklistItems[checklist.id] || []);
        const percent = Math.round((completed.size / checklist.items.length) * 100);
        return (
          <div key={checklist.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{localize(checklist.title, guidance.locale)}</div>
                <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">{localize(checklist.description, guidance.locale)}</p>
              </div>
              <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">{percent}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${percent}%` }} /></div>
            <div className="mt-3 space-y-1.5">
              {checklist.items.map((item) => {
                const done = completed.has(item.id);
                return (
                  <div key={item.id} className={`rounded-xl border px-3 py-3 ${done ? "border-emerald-100 bg-emerald-50/60" : "border-slate-100 bg-slate-50/70"}`}>
                    <div className="flex items-start gap-2.5">
                      <button type="button" onClick={() => guidance.toggleChecklistItem(checklist.id, item.id)} aria-label={done ? (guidance.locale === "vi" ? "Đánh dấu chưa hoàn thành" : "Mark incomplete") : (guidance.locale === "vi" ? "Đánh dấu hoàn thành" : "Mark complete")} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-600 text-white" : "text-slate-300 hover:text-violet-600"}`}>{done ? <Check size={12} /> : <Circle size={17} />}</button>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-semibold ${done ? "text-emerald-800" : "text-slate-800"}`}>{localize(item.title, guidance.locale)}</div>
                        <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">{localize(item.description, guidance.locale)}</p>
                      </div>
                      {item.route && <button type="button" onClick={() => guidance.navigateTo(item.route!, item.productSpace)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-violet-700" aria-label={guidance.locale === "vi" ? "Mở màn hình" : "Open screen"}><ExternalLink size={13} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
};
