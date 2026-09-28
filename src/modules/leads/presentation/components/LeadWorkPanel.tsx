import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, Calendar, CheckSquare, ChevronDown, FileText, Mail, MessageCircle, MoreHorizontal, Phone } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { RelationshipPanelActionBar } from "@/components/crm/relationship-panel/RelationshipPanelActionBar";
import { ActionDropdown } from "@/components/crm/ActionDropdown";
import type { Task } from "@/modules/tasks";
import type { Lead } from "../../domain/model/lead.types";
import type { useLeadDetailWorkResources } from "../hooks/useLeadDetailWorkResources";

export type LeadQuickAction = "call" | "task" | "meeting" | "email" | "sms" | "note";

interface LeadWorkPanelProps {
  lead: Lead;
  locale: string;
  isVisible: boolean;
  workResources: ReturnType<typeof useLeadDetailWorkResources>;
  ownerName: string;
  sourceName?: string;
  campaignName?: string;
  canHandover: boolean;
  canQualify: boolean;
  onHandover(): void;
  onQualify(): void;
  onOpenWork(): void;
  onOpenTask(task: Task): void;
  onQuickAction(action: LeadQuickAction): void;
}

export function LeadWorkPanel({ lead, locale, isVisible, workResources, ownerName, sourceName, campaignName,
  canHandover, canQualify, onHandover, onQualify, onOpenWork, onOpenTask, onQuickAction }: LeadWorkPanelProps) {
  const reduceMotion = useReducedMotion();
  const [contextOpen, setContextOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const { taskQuery, overdueTasks, nextTask } = workResources;
  const hasData = taskQuery.data !== undefined;
  const followUpOverdue = Boolean(lead.nextFollowUpAt && Date.parse(lead.nextFollowUpAt) < Date.now());
  const owner = ownerName && ownerName !== "—" ? ownerName : text("Chưa xác định", "Unknown");
  const dateLabel = (value: string) => new Date(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });
  const contextRows = [
    [text("Sản phẩm quan tâm", "Products of interest"), lead.interestedProducts.map((product) => product.productNameSnapshot).join(", ")],
    [text("Nguồn", "Source"), sourceName || lead.source],
    [text("Chiến dịch", "Campaign"), campaignName],
    [text("Nhu cầu", "Need"), lead.painPoint],
  ].filter((row) => row[1]);
  const attentionCount = (hasData ? overdueTasks.length : 0) + Number(followUpOverdue);
  const sectionTitle = "flex min-h-8 items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500";

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {isVisible ? (
        <motion.aside
          layout="position"
          key="lead-work-panel"
          aria-label={text("Công việc Lead", "Lead work")}
          data-i18n-skip="true"
          initial={reduceMotion ? false : { opacity: 0, x: 30, scale: 0.985, filter: "blur(3px)" }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 22, scale: 0.99, filter: "blur(2px)" }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 34, mass: 0.78 }}
          className="relative z-10 w-full min-w-0 lg:sticky lg:top-4 lg:h-[calc(100vh-140px)] lg:w-[350px] lg:shrink-0"
        >
          <div id="right-work-panel" className="flex h-full min-h-0 w-full flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm select-none lg:w-[350px]">
            <div className="flex min-h-9 items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-700">{text("Công việc Lead", "Lead work")}</h4>
              {attentionCount > 0 && <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{attentionCount}</span>}
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 crm-scroll-y">
              <section aria-label={text("Cần xử lý", "Needs attention")}>
                <h5 className={sectionTitle}>{text("Cần xử lý", "Needs attention")}</h5>
                {taskQuery.error && (
                  <div role="status" className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs text-amber-800">
                    <p>{hasData ? text("Dữ liệu có thể chưa mới nhất", "Data may be out of date") : text("Không thể tải công việc", "Could not load tasks")}</p>
                    <Button size="xs" variant="ghost" onClick={() => void taskQuery.refresh()}>{text("Thử lại", "Retry")}</Button>
                  </div>
                )}
                {!hasData && !taskQuery.error && <p role="status" className="animate-pulse text-xs text-slate-400">{text("Đang tải công việc…", "Loading tasks…")}</p>}
                {hasData && overdueTasks.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-amber-700">{overdueTasks.length} {text("công việc quá hạn", "overdue tasks")}</p>
                    {overdueTasks.slice(0, 2).map((task) => (
                      <button key={task.id} type="button" onClick={onOpenWork} title={task.title} className="flex w-full items-start gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50">
                        <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                        <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-700">{task.title}</span><span className="block text-[10px] text-slate-400">{dateLabel(task.dueAt)}</span></span>
                      </button>
                    ))}
                    {overdueTasks.length > 2 && <button type="button" onClick={onOpenWork} className="text-[11px] font-semibold text-indigo-600 hover:underline">{text("Xem tất cả", "View all")}</button>}
                  </div>
                )}
                {followUpOverdue && <p className="py-1 text-[11px] text-amber-700">{text("Quá hạn liên hệ lại", "Follow-up overdue")} · {dateLabel(lead.nextFollowUpAt || "")}</p>}
                {hasData && !taskQuery.error && attentionCount === 0 && <p className="text-[11px] text-slate-400">{text("Không có việc quá hạn", "No overdue work")}</p>}
              </section>
              <section aria-label={text("Việc tiếp theo", "Next work")} className="border-t border-slate-100 pt-2">
                <h5 className={sectionTitle}>{text("Việc tiếp theo", "Next work")}</h5>
                {hasData && (nextTask ? (
                  <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
                    <button type="button" onClick={() => onOpenTask(nextTask)} title={nextTask.title} className="line-clamp-2 w-full break-words text-left text-xs font-bold text-slate-800 hover:text-indigo-700">{nextTask.title}</button>
                    <p className="text-[10px] text-slate-500">{dateLabel(nextTask.dueAt)} · {text("Ưu tiên", "Priority")}: {nextTask.priority === "URGENT" ? text("Khẩn cấp", "Urgent") : nextTask.priority === "HIGH" ? text("Cao", "High") : nextTask.priority === "LOW" ? text("Thấp", "Low") : text("Bình thường", "Normal")}</p>
                    {nextTask.description && <p className="line-clamp-2 break-words text-[11px] text-slate-500">{nextTask.description}</p>}
                    <Button size="xs" onClick={() => onOpenTask(nextTask)}>{text("Mở công việc", "Open task")}</Button>
                  </div>
                ) : (
                  <div className="space-y-2"><p className="text-xs text-slate-500">{text("Chưa có công việc tiếp theo", "No next task yet")}</p><Button size="xs" onClick={() => onQuickAction("task")}>{text("+ Tạo công việc", "+ Create task")}</Button></div>
                ))}
              </section>
              <section aria-label={text("Phụ trách", "Owner")} className="border-t border-slate-100 pt-2">
                <h5 className={sectionTitle}>{text("Phụ trách", "Owner")}</h5>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">{ownerName && ownerName !== "—" ? ownerName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("") : "?"}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700" title={owner}>{owner}</span>
                  {canHandover && <Button size="xs" onClick={onHandover}>{text("Bàn giao", "Handover")}</Button>}
                </div>
              </section>
              <section className="border-t border-slate-100 pt-2">
                <button type="button" aria-expanded={contextOpen} onClick={() => setContextOpen((open) => !open)} className={`${sectionTitle} w-full justify-between`}>
                  {text("Ngữ cảnh nhanh", "Quick context")}<ChevronDown size={13} className={contextOpen ? "rotate-180" : ""} />
                </button>
                {contextOpen && <dl className="space-y-2">{contextRows.map(([label, value]) => <div key={label} className="text-[11px]"><dt className="text-slate-400">{label}</dt><dd className="truncate font-medium text-slate-700" title={value}>{value}</dd></div>)}</dl>}
              </section>
            </div>
            <div ref={railRef} className="shrink-0">
              <RelationshipPanelActionBar<LeadQuickAction | "more">
                label={text("Thao tác nhanh", "Quick actions")}
                actions={[
                  { id: "call", label: text("Ghi nhận cuộc gọi", "Log call"), icon: <Phone size={12} className="text-emerald-600" /> },
                  { id: "email", label: text("Ghi nhận Email ngoài CRM", "Log external Email"), icon: <Mail size={12} className="text-indigo-600" /> },
                  { id: "task", label: text("Thêm công việc", "Add task"), icon: <CheckSquare size={12} className="text-amber-600" /> },
                  { id: "note", label: text("Ghi chú nhanh", "Quick note"), icon: <FileText size={12} className="text-slate-600" /> },
                  { id: "more", label: text("Thao tác khác", "More actions"), icon: <MoreHorizontal size={12} /> },
                ]}
                onAction={(action) => { if (action === "more") setMenuAnchor(railRef.current?.querySelector<HTMLButtonElement>("button:last-child") ?? null); else onQuickAction(action); }}
              />
              <ActionDropdown isOpen={Boolean(menuAnchor?.isConnected) && isVisible} anchorRef={menuAnchor} onClose={() => setMenuAnchor(null)} width={240} sections={[
                { id: "work", title: text("Liên hệ & công việc", "Contact & work"), items: [
                  { id: "meeting", label: text("Đặt lịch hẹn", "Schedule meeting"), icon: <Calendar size={13} />, onClick: () => onQuickAction("meeting") },
                  { id: "sms", label: text("Ghi nhận SMS ngoài CRM", "Log external SMS"), icon: <MessageCircle size={13} />, onClick: () => onQuickAction("sms") },
                  ...(lead.leadWorkState === "VERIFYING" && canQualify ? [{ id: "qualify", label: text("Chốt kết quả", "Resolve outcome"), onClick: onQualify }] : []),
                ] },
              ]} />
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
