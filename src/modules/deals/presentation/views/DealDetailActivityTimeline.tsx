import React from "react";
import { MessageSquare } from "lucide-react";
import { NoteActivityCreateModal } from "@/modules/tasks";
import { Button as ActionButton } from "@/shared/components/ui";
import { formatDateTime } from "@/shared/lib/format/date";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { useDealActivities } from "../hooks/useDealActivities";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailActivityTimeline({ controller: c }: { controller: DealDetailController }) {
  const vi = c.locale === "vi";
  const history = useDealActivities(c.deal.id, c.locale);
  const manual = c.activeFilter === "all" ? history.items : c.activeFilter === "note" ? history.items.filter(item => item.type === "NOTE") : [];
  const entries = [...new Map([
    ...c.activitiesList.map(item => ({ id: item.id, title: item.title, body: item.description, occurredAt: item.createdAt, author: item.author })),
    ...manual.map(item => ({ id: item.id, title: item.subject, body: item.body, occurredAt: item.occurredAt, author: resolveWorkspaceMemberLabel(item.actorId, c.locale) })),
  ].map(item => [item.id, item])).values()].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return <section data-deal-detail-activity="balanced" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-slate-900">{c.t("deals.detail.activitiesTitle")}</h2>
      {history.canCreate && <ActionButton size="sm" onClick={() => c.setIsDirectNoteModalOpen(true)}>{vi ? "Ghi chú" : "Add note"}</ActionButton>}</div>
    <NoteActivityCreateModal isOpen={c.isDirectNoteModalOpen && history.canCreate} targetId={c.deal.id} recordingOnly onClose={() => c.setIsDirectNoteModalOpen(false)} formId="deal-timeline-note-form"
      defaults={{ title: vi ? `Ghi chú ${c.deal.name}` : `Deal note: ${c.deal.name}` }} onSubmit={async () => {}} onSave={async draft => { const saved = await c.handleAddDirectNote(draft); if (saved) history.reload(); return saved; }} />
    <div id="timeline-filters" className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">{([['all', 'all'], ['note', 'notes'], ['stage', 'stage'], ['quote', 'quotes'], ['outcome', 'outcomes']] as const).map(([filter, label]) => <button key={filter} type="button" aria-pressed={c.activeFilter === filter} onClick={() => c.setActiveFilter(filter)} className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${c.activeFilter === filter ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-500"}`}>{c.t(`deals.activities.filters.${label}`)}</button>)}</div>
    {!history.enabled ? <p className="text-sm text-slate-500">{vi ? "Bạn không có quyền xem hoạt động liên quan." : "You cannot read related activities."}</p>
      : history.loading ? <p role="status" className="text-sm text-slate-500">{vi ? "Đang tải hoạt động…" : "Loading activities…"}</p>
      : history.error ? <div role="alert" className="space-y-2 rounded-lg bg-rose-50 p-3 text-rose-800"><p>{history.error}</p><ActionButton size="xs" onClick={history.reload}>{vi ? "Thử lại" : "Retry"}</ActionButton></div>
      : manual.length === 0 && c.activitiesList.length === 0 ? <p className="py-5 text-sm text-slate-500">{c.t("deals.detail.emptyActivities")}</p> : null}
    <ol className="space-y-4">{entries.map(item => <li key={item.id} data-deal-activity-id={item.id} className="flex min-w-0 gap-3"><span className="mt-1 rounded-full bg-violet-50 p-2 text-violet-600"><MessageSquare size={14} /></span><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{item.body}</p><time className="mt-1 block text-[10px] text-slate-400" dateTime={item.occurredAt}>{formatDateTime(item.occurredAt, c.locale, { timeZone: c.timeZone })} · {item.author}</time></div></li>)}</ol>
    {history.next && <ActionButton size="sm" onClick={history.nextPage}>{vi ? "Trang tiếp" : "Next page"}</ActionButton>}
  </section>;
}
