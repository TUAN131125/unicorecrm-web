import React from "react";
import { Button, Input, Modal, SearchableSelect, Select, Textarea } from "@/shared/components/ui";
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

function createDraft(defaults: TaskCreateDefaults | undefined, fallbackAssigneeId: string): TaskCreateDraft {
  return {
    title: defaults?.title ?? "",
    description: defaults?.description ?? "",
    assigneeId: defaults?.assigneeId || fallbackAssigneeId,
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
  const { locale } = useI18n();
  const vi = locale === "vi";
  const access = useEffectiveAccess();
  const session = getAuthSessionSnapshot();
  const currentMemberId = actorId || session?.principal.memberId || access.memberId || access.accountId || "current-user";
  const currentActorName = actorName || session?.principal.displayName || currentMemberId;
  const directory = React.useMemo(() => listWorkspaceMemberDirectory(), [isOpen]);
  const [draft, setDraft] = React.useState<TaskCreateDraft>(() => createDraft(defaults, currentMemberId));
  const [errorMessage, setErrorMessage] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const previousOpen = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !previousOpen.current) {
      setDraft(createDraft(defaults, currentMemberId));
      setErrorMessage("");
      setFieldErrors({});
      setSubmitting(false);
    }
    previousOpen.current = isOpen;
  }, [currentMemberId, defaults, isOpen]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
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
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const taskId = createTaskId();
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
      onCreated?.(outcome.data);
      onClose();
    } catch (error) {
      setErrorMessage(formatApplicationError(error, { locale }));
      onError?.(error);
    } finally {
      setSubmitting(false);
    }
  };

  const canCreate = access.canPerform("tasks", "create");

  return (
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={onClose}
      title={title ?? (vi ? "Tạo công việc" : "Create task")}
      size="md"
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={onClose}>{vi ? "Hủy" : "Cancel"}</Button>
          <Button type="submit" variant="primary" form="canonical-task-create-form" disabled={!canCreate || submitting}>
            {submitLabel ?? (vi ? "Tạo công việc" : "Create task")}
          </Button>
        </>
      )}
    >
      <form id="canonical-task-create-form" className="crm-form-surface grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <div className="sm:col-span-2">
          <Input
            id="task-create-title"
            label={vi ? "Tên công việc" : "Task title"}
            value={draft.title}
            onChange={(event) => { setDraft((current) => ({ ...current, title: event.target.value })); setFieldErrors((current) => ({ ...current, title: "" })); }}
            required
            error={fieldErrors.title}
          />
        </div>
        <SearchableSelect
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
        <Select
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
          <Input
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
          <Textarea
            label={vi ? "Mô tả / kết quả mong đợi" : "Description / expected outcome"}
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            rows={4}
          />
        </div>
        {context?.label ? (
          <p className="sm:col-span-2 text-xs text-slate-500">
            {vi ? "Liên kết với" : "Linked to"}: {context.label}
          </p>
        ) : null}
        {!canCreate ? (
          <p className="sm:col-span-2 text-xs text-slate-600">
            {vi ? "Bạn không có quyền tạo công việc." : "You do not have permission to create tasks."}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="sm:col-span-2 text-xs text-slate-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </Modal>
  );
};
