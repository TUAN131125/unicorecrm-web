import type { Contact } from "../../../domain/model/contact.types";
import React, { useState } from "react";
import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { registerUnsavedWork, getDirtyUnsavedWork } from "@/platform/unsaved-work";
import { formatApplicationError } from "@/shared/operations";
import { acquireContactInteraction, releaseContactInteraction } from "../../model/contactInteractionOwnership";
import { CheckSquare, Calendar, User, CheckCircle2, Clock, Plus } from "lucide-react";
import { useI18n } from "@/i18n";
import { Modal, Button, Input, DetailTabActionButton, OverlayPortalHostContext } from "@/shared/components/ui";
import { getContactReadAuthorityScope } from "../../../application/vertical-slice/contactReadAuthorityScope";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";

interface TaskMocks {
  id: string;
  title: string;
  dueDate?: string;
  dueTime?: string;
  completedDate?: string;
  status: "pending" | "in_progress" | "completed";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignee: string;
  description?: string;
}

interface ContactActiveTasksTabProps {
  tasks: TaskMocks[];
  onCreateTask: () => void;
  onScheduleMeeting: () => void;
  onOpenModule: () => void;
  onCompleteTask: (id: string) => void;
  onRescheduleTask?: (id: string, newDate: string, options?: { idempotencyKey: string }) => void | boolean | Promise<void | boolean>;
  contactTargetId?: string;
  contact?: Contact;
  isArchived?: boolean;
  onModalStateChange?: (open: boolean) => void;
}

export const ContactActiveTasksTab: React.FC<ContactActiveTasksTabProps> = ({
  tasks = [],
  onCreateTask,
  onScheduleMeeting,
  onOpenModule,
  onCompleteTask,
  onRescheduleTask,
  contactTargetId,
  contact,
  isArchived = false,
  onModalStateChange
}) => {
  const { tx, locale } = useI18n();
  const portalHost = React.useContext(OverlayPortalHostContext);
  const portalHostRef = React.useRef(portalHost); portalHostRef.current = portalHost;
  const sourceKey = contactTargetId ?? contact?.id;
  const { workspaceId } = useWorkspaceContextSnapshot();
  type Intent = { authorityScope: string; task: TaskMocks; contactTargetId: string | undefined; workspaceId: string; initialDate: string; cycle: number; intentId: string; submit: NonNullable<ContactActiveTasksTabProps["onRescheduleTask"]>; notify: ContactActiveTasksTabProps["onModalStateChange"] };
  const [intent, setIntent] = useState<Intent>();
  const [date, setDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmClose, setConfirmClose] = useState(false);
  const intentRef = React.useRef(intent); intentRef.current = intent;
  const draftRef = React.useRef(date); draftRef.current = date;
  const pendingRef = React.useRef(false);
  const mounted = React.useRef(true);
  const cycle = React.useRef(0);
  const owner = React.useRef(Symbol("contact-task-reschedule"));
  const errorFocusCycle = React.useRef<number | undefined>(undefined);
  const formRef = React.useRef<HTMLFormElement>(null);
  const dirty = Boolean(intent && intent.initialDate !== date.trim());
  const finish = React.useCallback(() => {
    const opening = intentRef.current;
    errorFocusCycle.current = undefined;
    intentRef.current = undefined;
    releaseContactInteraction(owner.current);
    setIntent(undefined); setDate(""); setError(undefined); setConfirmClose(false);
    opening?.notify?.(false);
  }, []);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; releaseContactInteraction(owner.current); intentRef.current?.notify?.(false); }; }, []);
  React.useEffect(() => {
    if (intent && (intent.contactTargetId !== sourceKey || intent.workspaceId !== workspaceId) && !dirty && !pendingRef.current) finish();
  }, [intent, sourceKey, workspaceId, dirty, pending, finish]);
  const requestClose = () => { if (pendingRef.current || portalHostRef.current?.suspended) return; if (dirty) setConfirmClose(true); else finish(); };
  React.useEffect(() => {
    if (error && !pending && errorFocusCycle.current === intentRef.current?.cycle) { formRef.current?.querySelector<HTMLElement>("#contact-task-reschedule-date")?.focus(); errorFocusCycle.current = undefined; }
  }, [error, pending]);
  const save = async (): Promise<boolean> => {
    const opening = intentRef.current;
    if (!opening || !mounted.current || pendingRef.current) return false;
    if (portalHostRef.current?.suspended) return false;
    if (opening.workspaceId !== getWorkspaceContextSnapshot().workspaceId) { setError(tx("contactDetail.tasks.workspaceChanged", "Không gian làm việc đã thay đổi. Quay lại không gian đã mở để tiếp tục.")); return false; }
    if (opening.authorityScope !== getContactReadAuthorityScope()) return false;
    const suppliedDate = draftRef.current.trim();
    const parsedDate = new Date(`${suppliedDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(suppliedDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== suppliedDate) {
      setError(tx("contactDetail.tasks.invalidDate", "Chọn ngày hợp lệ.")); formRef.current?.querySelector<HTMLElement>("#contact-task-reschedule-date")?.focus(); return false;
    }
    if (suppliedDate === opening.initialDate) return false;
    pendingRef.current = true; setPending(true); setError(undefined);
    try {
      const result = await opening.submit(opening.task.id, suppliedDate, { idempotencyKey: opening.intentId });
      if (!mounted.current || intentRef.current?.cycle !== opening.cycle || opening.workspaceId !== getWorkspaceContextSnapshot().workspaceId || portalHostRef.current?.suspended || opening.authorityScope !== getContactReadAuthorityScope()) return false;
      if (result === false) { setError(tx("contactDetail.tasks.rescheduleUnavailable", "Không thể cập nhật lịch công việc lúc này.")); return false; }
      finish(); return true;
    } catch (caught) {
      if (mounted.current && intentRef.current?.cycle === opening.cycle) { setError(formatApplicationError(caught, { locale })); errorFocusCycle.current = opening.cycle; }
      return false;
    } finally {
      pendingRef.current = false;
      if (mounted.current && (!intentRef.current || intentRef.current.cycle === opening.cycle)) setPending(false);
    }
  };
  const saveRef = React.useRef(save); saveRef.current = save;
  React.useEffect(() => {
    if (!intent) return;
    const captured = intent;
    const canDiscard = () => mounted.current && intentRef.current?.cycle === captured.cycle && !pendingRef.current;
    const unregisterRecovery = portalHost?.registerDraft?.({ canDiscard, discard: finish });
    const unregister = registerUnsavedWork({ id: `contact-task-reschedule:${captured.workspaceId}:${captured.contactTargetId ?? "context"}:${captured.task.id}:${captured.cycle}`,
      title: tx("contactDetail.actions.rescheduleTitle", "Điều chỉnh hạn xử lý"), isDirty: dirty || pending,
      canDiscard, discard: finish,
      save: async () => { if (!canDiscard() || captured.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false; return saveRef.current(); },
    });
    const unload = (event: BeforeUnloadEvent) => { if (dirty || pendingRef.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", unload);
    return () => { unregisterRecovery?.(); unregister(); window.removeEventListener("beforeunload", unload); };
  }, [intent, dirty, pending, tx, finish, portalHost]);

  const activeTasks = tasks.filter(t => t.status !== "completed");

  const getPriorityColor = (p: string) => {
    switch (p.toUpperCase()) {
      case "URGENT": return "text-rose-700 bg-rose-50 border-rose-100";
      case "HIGH": return "text-amber-700 bg-amber-50 border-amber-100";
      case "MEDIUM": return "text-indigo-700 bg-indigo-50 border-indigo-100";
      default: return "text-slate-600 bg-slate-50 border-slate-100";
    }
  };

  const handleReschedule = (tkId: string, currentDueDate?: string) => {
    if (isArchived || !onRescheduleTask || intentRef.current || pendingRef.current) return;
    const task = tasks.find(item => item.id === tkId); if (!task) return;
    if (getDirtyUnsavedWork().some(entry => entry.id.startsWith("contact-")) || !acquireContactInteraction(owner.current, contact)) return;
    const initialDate = currentDueDate?.slice(0,10) || new Date().toISOString().slice(0,10);
    const next: Intent = { authorityScope: getContactReadAuthorityScope(), task: structuredClone(task), initialDate, contactTargetId: sourceKey, workspaceId: getWorkspaceContextSnapshot().workspaceId, cycle: ++cycle.current, intentId: `contact-task-reschedule-${crypto.randomUUID()}`, submit: onRescheduleTask, notify: onModalStateChange };
    intentRef.current = next; setIntent(next); setDate(initialDate); setError(undefined); setConfirmClose(false); next.notify?.(true);
  };

  return (
    <div id="contact-active-tasks-tab" className="space-y-6 animate-fade-in text-[11px] text-slate-700 text-left">
      
      <RelationshipWorkspaceHeader
        title={`${tx("contactDetail.tabs.activeTasks", "Công việc đang thực hiện")} (${activeTasks.length})`}
        actions={<RelationshipModuleActions secondaryLabel={tx("contactDetail.tasks.openModule", "Mở Công việc")} primaryLabel={!isArchived ? tx("contactDetail.tasks.actions.create", "Tạo công việc") : undefined} onSecondary={onOpenModule} onPrimary={!isArchived ? onCreateTask : undefined} />}
      />

      {activeTasks.length === 0 ? (
        <div className="flex min-h-[160px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
          <CheckSquare size={24} className="mb-2 text-slate-300" />
          <span className="font-semibold">{tx("contactDetail.empty.noActiveTasks", "Không có công việc nào đang thực hiện.")}</span>
          <p className="text-[10px] text-slate-400 mt-1 font-sans">{tx("contactDetail.empty.activeTasksHint", "Các công việc được giao mới sẽ xuất hiện ở đây.")}</p>
          {!isArchived && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <DetailTabActionButton actionIntent="create" onClick={onCreateTask} icon={<Plus size={14} />}>
                {tx("contactDetail.tasks.actions.create", "Tạo công việc")}
              </DetailTabActionButton>
              <DetailTabActionButton actionIntent="create" onClick={onScheduleMeeting} icon={<Calendar size={14} />}>
                {tx("contactDetail.tasks.actions.scheduleMeeting", "Lên lịch hẹn")}
              </DetailTabActionButton>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
          {activeTasks.map(tk => (
            <div key={tk.id} className="bg-white border border-slate-200 hover:border-indigo-200 rounded-xl p-4 shadow-sm flex flex-col justify-between transition">
              <div className="space-y-2 text-left">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-800 text-[11px] leading-relaxed">{tk.title}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-semibold border uppercase shrink-0 ${getPriorityColor(tk.priority)}`}>
                    {tk.priority}
                  </span>
                </div>
                {tk.description && (
                  <p className="text-[10px] text-slate-500 crm-text-wrap leading-relaxed">{tk.description}</p>
                )}
                <p className="text-[10px] text-slate-400 font-semibold font-mono">
                  {tx("contactDetail.table.dueDate", "Hạn chót")}: {tk.dueDate || tx("common.none", "Không có")} {tk.dueTime && `@ ${tk.dueTime}`} • {tx("common.owner", "Người nhận")}: {tk.assignee}
                </p>
              </div>
              
              <div className="flex justify-end items-center gap-2 mt-4 pt-2.5 border-t border-slate-100 flex-wrap">
                {onRescheduleTask && !isArchived && (
                  <button
                    type="button"
                    onClick={() => handleReschedule(tk.id, tk.dueDate)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg text-[9px] font-semibold transition cursor-pointer select-none"
                  >
                    <Calendar size={10} />
                    <span>{tx("contactDetail.tasks.actions.reschedule", "Đổi lịch")}</span>
                  </button>
                )}

                {!isArchived && (
                  <button
                    type="button"
                    onClick={() => onCompleteTask(tk.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[9px] font-semibold transition cursor-pointer select-none border border-emerald-200"
                  >
                    <Clock size={10} />
                    <span>{tx("contactDetail.actions.complete", "Hoàn thành")}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {intent && <Modal variant="form" isOpen onClose={requestClose} title={tx("contactDetail.actions.rescheduleTitle", "Điều chỉnh hạn xử lý")} size="sm">
        <form ref={formRef} noValidate data-contact-target-id={intent.contactTargetId} data-task-target-id={intent.task.id} className="space-y-4 text-left" onSubmit={event => { event.preventDefault(); void save(); }}>
          <Input id="contact-task-reschedule-date" label={tx("contactDetail.actions.dueDateLabel", "Hạn xử lý mới")} type="date" value={date} disabled={pending} onChange={event => setDate(event.target.value)} className="text-[11px] font-mono" />
          {error && <p role="alert" className="text-[10px] text-rose-700">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" disabled={pending} onClick={requestClose}>{tx("common.cancel", "Hủy bỏ")}</Button>
            <Button type="submit" variant="primary" disabled={pending || !dirty}>{tx("common.save", "Cập nhật")}</Button>
          </div>
        </form>
      </Modal>}
      <Modal isOpen={confirmClose} onClose={() => setConfirmClose(false)} size="sm" title={tx("common.discardChanges", "Bỏ thay đổi?")}>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setConfirmClose(false)}>{tx("common.keepEditing", "Tiếp tục chỉnh sửa")}</Button><Button type="button" variant="danger" disabled={pending} onClick={() => { if (!pendingRef.current) finish(); }}>{tx("common.discard", "Bỏ thay đổi")}</Button></div>
      </Modal>

    </div>
  );
};
