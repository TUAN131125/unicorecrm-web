import React from "react";
import { CalendarClock } from "lucide-react";
import { formatDateTime } from "@/shared/lib/format/date";
import { DealFollowUpTasks } from "../components/DealFollowUpTasks";
import { DealDetailField } from "./DealDetailField";
import type { DealDetailController } from "./dealDetailView.types";
import { Button } from "@/shared/components/ui";
import { useEffectiveAccess } from "@/platform/access-control";

export function DealDetailNextActionPanel({ controller: c }: { controller: DealDetailController }) {
  const vi = c.locale === "vi";
  const access = useEffectiveAccess();
  const overdue = !c.isTerminal && Boolean(c.deal.nextActionAt && Date.parse(c.deal.nextActionAt) < Date.now());
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-guidance-id="deals.detail.next-action">
    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarClock size={16} className="text-violet-600" />{vi ? "Công việc tiếp theo" : "Next action"}</h2>
    <DealDetailField field="nextActionSummary"><p className="break-words text-xs leading-5 text-slate-600">{c.deal.nextActionSummary || (vi ? "Chưa có kế hoạch chăm sóc tiếp theo." : "No next follow-up planned.")}</p></DealDetailField>
    <DealDetailField field="nextActionAt">{c.deal.nextActionAt && <p className={`text-xs font-medium ${overdue ? "text-rose-600" : "text-slate-500"}`}>{formatDateTime(c.deal.nextActionAt, c.locale, { timeZone: c.timeZone })}{overdue ? (vi ? " · Quá hạn" : " · Overdue") : ""}</p>}</DealDetailField>
    <DealDetailField field="nextActionRef">{c.deal.nextActionRef?.type === "TASK" && c.deal.nextActionRef.id && access.canPerform("tasks", "read") && <Button size="sm" fullWidth onClick={() => c.navigate(`/tasks/${encodeURIComponent(c.deal.nextActionRef?.id ?? "")}`)}>{vi ? "Mở công việc kế tiếp" : "Open next-action task"}</Button>}</DealDetailField>
    {!c.connected && <DealDetailField field="riskBadge">{c.deal.riskBadge && <p role="status" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{c.deal.riskBadge}</p>}</DealDetailField>}
    <DealFollowUpTasks deal={c.deal} locale={c.locale} compact />
  </section>;
}
