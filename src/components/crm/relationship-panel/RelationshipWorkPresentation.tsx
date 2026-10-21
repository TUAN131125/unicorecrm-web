import type { ReactNode } from "react";
import { AlertCircle, ArrowUpRight } from "lucide-react";

export const workHeadingClass = "flex min-h-8 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500";
export const workHeaderClass = "flex min-h-9 items-center justify-between gap-2 border-b border-slate-100 pb-2";
export const workTitleClass = "text-xs font-semibold uppercase tracking-wide text-slate-700";
export const workBadgeClass = "rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700";
export const workEmptyClass = "py-1 text-xs leading-5 text-slate-500";
export const workNoticeClass = "rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs leading-5 text-slate-600";

export function WorkSection({ title, children, first = false }: { title: string; children: ReactNode; first?: boolean }) {
  return <section aria-label={title} data-work-section className={first ? "space-y-1" : "space-y-1 border-t border-slate-100 pt-2"}>
    <h3 className={workHeadingClass}>{title}</h3>{children}
  </section>;
}

/** Display-only task chrome; identity, selection, time formatting and commands stay with callers. */
export function WorkTaskItem({ title, metadata, onOpen, variant = "attention", description, children }: {
  title: string; metadata: ReactNode; onOpen(): void; variant?: "attention" | "next"; description?: string; children?: ReactNode;
}) {
  const heading = <><span className="min-w-0 flex-1"><span className="block break-words text-xs font-semibold leading-5 text-slate-800 [overflow-wrap:anywhere]">{title}</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{metadata}</span></span><ArrowUpRight size={13} aria-hidden="true" className="mt-1 shrink-0 text-slate-400"/></>;
  if (variant === "attention") return <button type="button" title={title} onClick={onOpen} data-work-task="attention" className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
    <AlertCircle size={14} aria-hidden="true" className="mt-1 shrink-0 text-amber-600"/>{heading}
  </button>;
  return <div data-work-task="next" className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 text-xs text-slate-700">
    <button type="button" title={title} onClick={onOpen} className="flex w-full items-start gap-2 rounded text-left hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">{heading}</button>
    {description && <p className="break-words text-[11px] leading-5 text-slate-500 [overflow-wrap:anywhere]">{description}</p>}{children}
  </div>;
}

export function WorkOwnerDisplay({ label, name, actions }: { label: string; name?: string; actions?: ReactNode }) {
  const initials = name?.trim().split(/\s+/).slice(-2).map(part => part[0]).join("");
  return <div className="flex items-center gap-2 py-1" data-work-owner>
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">{initials || "?"}</span>
    <span className="min-w-0 flex-1 break-words text-xs font-semibold leading-5 text-slate-700 [overflow-wrap:anywhere]" title={label}>{label}</span>{actions}
  </div>;
}
