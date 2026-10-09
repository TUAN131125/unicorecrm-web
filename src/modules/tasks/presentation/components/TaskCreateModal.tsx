import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import React from "react";
import { normalizeApplicationError } from "@/shared/domain";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { RelationshipQuickActionModal } from "@/components/crm/relationship-panel/RelationshipQuickActionModal";
import { Button, Input, Modal, SearchableSelect, Select, Textarea, OverlayPortalHostContext } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { useEffectiveAccess } from "@/platform/access-control";
import type { RelationshipRef } from "@/platform/identity";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { listWorkspaceMemberDirectory } from "@/platform/member-directory";
import { formatApplicationError } from "@/shared/operations/errorPresentation";
import { createTaskCommand } from "../../public/api";
import type { RecordRef, Task, TaskPriority, TaskSourceRef } from "../../domain/model/task.types";

export interface TaskCreateContext {
  customerId?: string;
  relationshipRef?: RelationshipRef;
  recordRef?: RecordRef;
  sourceRef?: TaskSourceRef;
  dedupeKey?: string;
  label?: string;
}

export interface TaskCreateDefaults {
  title?: string;
  description?: string;
  assigneeId?: string;
  dueAt?: string;
  priority?: TaskPriority;
}

export interface TaskCreateModalProps {
  targetId?: string;
  onBindSave?: (save: (() => Promise<boolean>) | undefined) => void;
  onPendingChange?: (pending: boolean) => void;
  formId?: string;
  guardChanges?: boolean;
  isOpen: boolean;
  onClose: () => void;
  context?: TaskCreateContext;
  defaults?: TaskCreateDefaults;
  title?: string;
  submitLabel?: string;
  actorId?: string;
  actorName?: string;
  onCreated?: (task: Task) => void;
  onError?: (error: unknown) => void;
}

interface TaskCreateDraft {
  title: string;
  description: string;
  assigneeId: string;
  dueAt: string;
  priority: TaskPriority;
}

function createDefaultDueAt(): string {
  const due = new Date();
  due.setDate(due.getDate() + 1);
  due.setHours(17, 0, 0, 0);
  return toLocalDateTimeValue(due.toISOString());
}

function toLocalDateTimeValue(value?: string): string {
  if (!value) return createDefaultDueAt();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return createDefaultDueAt();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function createDraft(defaults: TaskCreateDefaults | undefined, fallbackAssigneeId?: string): TaskCreateDraft {
  return {
    title: defaults?.title ?? "",
    description: defaults?.description ?? "",
    assigneeId: defaults?.assigneeId || fallbackAssigneeId || "",
    dueAt: toLocalDateTimeValue(defaults?.dueAt),
    priority: defaults?.priority ?? "NORMAL",
  };
}

function createTaskId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  guardChanges = true,
  onBindSave,
  onPendingChange,
  targetId,
  formId = "canonical-task-create-form",
  isOpen,
  onClose,
  context,
  defaults,
  title,
  submitLabel,
  actorId,
  actorName,
  onCreated,
  onError,
}) => {
  const portalHost = React.useContext(OverlayPortalHostContext);
  const portalHostRef = React.useRef(portalHost); portalHostRef.current = portalHost;
  const { locale } = useI18n();
  const vi = locale === "vi";
  const access = useEffectiveAccess();
  const session = getAuthSessionSnapshot();
  const currentMemberId = actorId || session?.principal.memberId || access.memberId || undefined;
  const currentActorName = actorName || session?.principal.displayName || currentMemberId;
  const directory = React.useMemo(() => listWorkspaceMemberDirectory(), [isOpen]);
  const [draft, setDraft] = React.useState<TaskCreateDraft>(() => createDraft(defaults, currentMemberId));
  const [errorMessage, setErrorMessage] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const previousOpen = React.useRef(false);
  const initialDraft = React.useRef(draft);
  const pending = React.useRef(false);
  const mounted = React.useRef(true);
  const cycle = React.useRef(0);
  const openRef = React.useRef(isOpen);
  openRef.current = isOpen;
  const registration = React.useRef<object | undefined>(undefined);
  const workspaceId = useWorkspaceContextSnapshot().workspaceId;
  const liveWorkspace = React.useRef(workspaceId);
  liveWorkspace.current = workspaceId;
  const targetKey = targetId ?? JSON.stringify(context?.recordRef ?? context?.relationshipRef ?? context?.sourceRef ?? "new");
  const opening = React.useRef({ workspaceId, targetKey, context: structuredClone(context), onClose, onCreated, onError, taskId: createTaskId() });
  const fingerprint = (value: TaskCreateDraft) => JSON.stringify({ ...value, title: value.title.trim(), description: value.description.trim() });
  const dirty = fingerprint(draft) !== fingerprint(initialDraft.current);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  React.useEffect(() => {
    if (isOpen && !pending.current && (!previousOpen.current || (opening.current.targetKey !== targetKey && !dirty))) {
      cycle.current += 1;
      opening.current = { workspaceId, targetKey, context: structuredClone(context), onClose, onCreated, onError, taskId: createTaskId() };
      initialDraft.current = createDraft(defaults, currentMemberId);
      setDraft(initialDraft.current);
      setErrorMessage("");
      setFieldErrors({});
      setSubmitting(false);
    }
    if (!isOpen || !pending.current) previousOpen.current = isOpen;
  });

  const save = async (): Promise<boolean> => {
    if (portalHostRef.current?.suspended) return false;
    if (pending.current || !mounted.current || !isOpen || !canCreate) return false;
    if (!currentMemberId || !currentActorName) {
      setErrorMessage(vi ? "Không xác định được thành viên Workspace hiện tại." : "The current Workspace member could not be resolved.");
      return false;
    }
    setErrorMessage("");
    const nextErrors: Record<string, string> = {};
    if (!draft.title.trim()) nextErrors.title = vi ? "Vui lòng nhập tên công việc." : "Enter a task title.";
    if (!draft.assigneeId) nextErrors.assigneeId = vi ? "Vui lòng chọn người phụ trách." : "Select an assignee.";
    const dueDate = new Date(draft.dueAt);
    if (!draft.dueAt || Number.isNaN(dueDate.getTime())) nextErrors.dueAt = vi ? "Vui lòng chọn hạn xử lý." : "Select a due date.";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const firstField = ["title", "assigneeId", "dueAt"].find((field) => Boolean(nextErrors[field]));
      requestAnimationFrame(() => {
        const control = firstField ? document.getElementById(`task-create-${firstField}`) : null;
        control?.scrollIntoView({ behavior: "smooth", block: "center" });
        control?.focus({ preventScroll: true });
      });
      return false;
    }
    setFieldErrors({});
    const bound = opening.current;
    if (bound.workspaceId !== liveWorkspace.current) { setErrorMessage(vi ? "Workspace đã thay đổi. Đóng bản nháp và mở lại." : "Workspace changed. Close this draft and reopen it."); return false; }
    pending.current = true;
    onPendingChange?.(true);
    setSubmitting(true);
    const capturedCycle = cycle.current;
    const context = bound.context;
    try {
      const taskId = bound.taskId;
      const outcome = await createTaskCommand({
        id: taskId,
        title: draft.title,
        assigneeId: draft.assigneeId,
        dueAt: dueDate.toISOString(),
        priority: draft.priority,
        ...(draft.description ? { description: draft.description } : {}),
        ...(context?.relationshipRef ? { relationshipRef: context.relationshipRef } : {}),
        ...(context?.recordRef ? { recordRef: context.recordRef } : {}),
        sourceRef: context?.sourceRef ?? { type: "MANUAL", id: context?.recordRef?.recordId ?? taskId },
        ...(context?.dedupeKey ? { dedupeKey: context.dedupeKey } : {}),
        actorId: currentMemberId,
        actorName: currentActorName,
      }, {
        idempotencyKey: `task.create:${taskId}`,
        actor: { id: currentMemberId, name: currentActorName },
      });
      if (!mounted.current || capturedCycle !== cycle.current || bound.workspaceId !== liveWorkspace.current || portalHostRef.current?.suspended) return false;
      initialDraft.current = draft;
      bound.onCreated?.(outcome.data);
      bound.onClose();
      return true;
    } catch (error) {
      if (mounted.current && capturedCycle === cycle.current) {
        const normalized = normalizeApplicationError(error);
        const errors = Object.fromEntries(Object.entries(normalized.fieldErrors ?? {}).map(([field, messages]) => [field, messages.join(" ")]));
        setFieldErrors(errors);
        const first = ["title", "assigneeId", "dueAt"].find(field => errors[field]);
        if (first) requestAnimationFrame(() => document.getElementById(`task-create-${first}`)?.focus());
        setErrorMessage(formatApplicationError(normalized, { locale }));
        bound.onError?.(error);
      }
      return false;
    } finally {
      if (mounted.current && capturedCycle === cycle.current) { pending.current = false; onPendingChange?.(false); setSubmitting(false); }
    }
  };
  React.useEffect(() => {
    const capturedCycle = cycle.current; const lease = { active: true };
    onBindSave?.(() => lease.active && mounted.current && openRef.current && cycle.current === capturedCycle && !pending.current ? save() : Promise.resolve(false));
    return () => { lease.active = false; onBindSave?.(undefined); };
  });
  const submit = async (event: React.FormEvent) => { event.preventDefault(); await save(); };
  const close = () => { if (!pending.current) opening.current.onClose(); };
  React.useEffect(() => {
    if (!isOpen || onBindSave) return;
    const capturedCycle = cycle.current;
    const entryToken = {};
    registration.current = entryToken;
    const currentEntry = () => mounted.current && openRef.current && capturedCycle === cycle.current && registration.current === entryToken;
    const unregisterRecovery = portalHost?.registerDraft?.({ canDiscard: () => currentEntry() && !pending.current, discard: () => { if (currentEntry() && !pending.current) { setDraft(initialDraft.current); opening.current.onClose(); } } });
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (dirty || submitting) window.addEventListener("beforeunload", warn);
    const unregister = registerUnsavedWork({
      id: `${formId}:${opening.current.targetKey}:${capturedCycle}`,
      title: title ?? formId, isDirty: dirty || submitting,
      save: () => currentEntry() && !pending.current ? save() : Promise.resolve(false),
      canDiscard: () => currentEntry() && !pending.current,
      discard: () => { if (currentEntry() && !pending.current) { setDraft(initialDraft.current); opening.current.onClose(); } },
    });
    return () => { unregisterRecovery?.(); unregister(); if (registration.current === entryToken) registration.current = undefined; window.removeEventListener("beforeunload", warn); };
  });

  const canCreate = Boolean(currentMemberId) && access.canPerform("tasks", "create");

  const fields = (
      <fieldset disabled={submitting} className="contents">
        <div className="sm:col-span-2">
          <Input disabled={submitting}
            id="task-create-title"
            label={vi ? "Tên công việc" : "Task title"}
            value={draft.title}
            onChange={(event) => { setDraft((current) => ({ ...current, title: event.target.value })); setFieldErrors((current) => ({ ...current, title: "" })); }}
            required
            error={fieldErrors.title}
          />
        </div>
        <SearchableSelect disabled={submitting}
          id="task-create-assigneeId"
          label={vi ? "Người phụ trách" : "Assignee"}
          value={draft.assigneeId}
          onChange={(value) => { setDraft((current) => ({ ...current, assigneeId: value })); setFieldErrors((current) => ({ ...current, assigneeId: "" })); }}
          error={fieldErrors.assigneeId}
          clearable={false}
          placeholder={vi ? "Chọn người phụ trách" : "Select assignee"}
          searchPlaceholder={vi ? "Tìm tên hoặc email..." : "Search name or email..."}
          options={directory.map((member) => ({
            value: member.memberId,
            label: member.displayName,
            description: member.email,
            keywords: member.email,
          }))}
        />
        <Select disabled={submitting}
          label={vi ? "Mức ưu tiên" : "Priority"}
          value={draft.priority}
          onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))}
        >
          <option value="LOW">{vi ? "Thấp" : "Low"}</option>
          <option value="NORMAL">{vi ? "Bình thường" : "Normal"}</option>
          <option value="HIGH">{vi ? "Cao" : "High"}</option>
          <option value="URGENT">{vi ? "Khẩn cấp" : "Urgent"}</option>
        </Select>
        <div className="sm:col-span-2">
          <Input disabled={submitting}
            id="task-create-dueAt"
            label={vi ? "Hạn xử lý" : "Due at"}
            type="datetime-local"
            value={draft.dueAt}
            onChange={(event) => { setDraft((current) => ({ ...current, dueAt: event.target.value })); setFieldErrors((current) => ({ ...current, dueAt: "" })); }}
            required
            error={fieldErrors.dueAt}
          />
        </div>
        <div className="sm:col-span-2">
          <Textarea disabled={submitting}
            label={vi ? "Mô tả / kết quả mong đợi" : "Description / expected outcome"}
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            rows={4}
          />
        </div>
        {opening.current.context?.label ? (
          <p className="sm:col-span-2 text-xs text-slate-500">
            {vi ? "Liên kết với" : "Linked to"}: {opening.current.context?.label}
          </p>
        ) : null}
        {!currentMemberId ? (
          <p className="sm:col-span-2 text-xs text-slate-600">
            {vi ? "Không xác định được thành viên Workspace hiện tại." : "The current Workspace member could not be resolved."}
          </p>
        ) : !canCreate ? (
          <p className="sm:col-span-2 text-xs text-slate-600">
            {vi ? "Bạn không có quyền tạo công việc." : "You do not have permission to create tasks."}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="sm:col-span-2 text-xs text-slate-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </fieldset>
  );
  if (guardChanges) return (
    <RelationshipQuickActionModal guardChanges isOpen={isOpen} onClose={close}
      dirty={dirty}
      title={title ?? (vi ? "Tạo công việc" : "Create task")}
      formId={formId} cancelLabel={vi ? "Hủy" : "Cancel"}
      submitLabel={submitLabel ?? (vi ? "Tạo công việc" : "Create task")}
      submitDisabled={!canCreate || submitting} onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">{fields}</div>
    </RelationshipQuickActionModal>
  );

  return (
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={close}
      title={title ?? (vi ? "Tạo công việc" : "Create task")}
      size="md"
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={close}>{vi ? "Hủy" : "Cancel"}</Button>
          <Button type="submit" variant="primary" form={formId} disabled={!canCreate || submitting}>
            {submitLabel ?? (vi ? "Tạo công việc" : "Create task")}
          </Button>
        </>
      )}
    >
      <form id={formId} className="crm-form-surface grid gap-4 sm:grid-cols-2" onSubmit={submit}>{fields}</form>
    </Modal>
  );
};
