import React from "react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getAuthSessionSnapshot, useAuthSessionSnapshot } from "@/platform/identity-auth";
import { normalizeApplicationError } from "@/shared/domain";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { OverlayPortalHostContext } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { useEffectiveAccess, getAccessGovernanceState, isAccessGovernanceRuntimeConfigured } from "@/platform/access-control";
import { listWorkspaceMemberDirectory } from "@/platform/member-directory";
import { formatApplicationError } from "@/shared/operations/errorPresentation";
import { createTaskCommand, getTaskApiRuntime } from "../../public/api";
import { getTaskReadAuthorityScope } from "../../application/vertical-slice/taskAuthoritativeQueries";
import { freezeTaskCreateIntent, taskCreateDefinitelyRejected, type TaskCreateIntent } from "../model/taskCreateIntent";
import type { TaskPriority } from "../../domain/model/task.types";
import type { TaskCreateModalProps, TaskCreateDefaults } from "../components/TaskCreateModal";

export function useTaskCreateAuthority() {
  useWorkspaceContextSnapshot(); useAuthSessionSnapshot(); useEffectiveAccess();
  return getTaskReadAuthorityScope();
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

export function useTaskCreateController({
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
}: TaskCreateModalProps) {
  const portalHost = React.useContext(OverlayPortalHostContext);
  const portalHostRef = React.useRef(portalHost); portalHostRef.current = portalHost;
  const { locale } = useI18n();
  const vi = locale === "vi";
  const access = useEffectiveAccess();
  const session = getAuthSessionSnapshot();
  const workspace = useWorkspaceContextSnapshot();
  const currentMemberId = actorId || session?.principal.memberId || access.memberId || undefined;
  const currentActorName = actorName || session?.principal.displayName || currentMemberId;
  const snapshot = isAccessGovernanceRuntimeConfigured() ? getAccessGovernanceState().snapshot : undefined;
  const authorizedDirectory = snapshot?.workspaceId === workspace.workspaceId
    && snapshot.authorization.accountId === session?.principal.accountId ? snapshot.directory : undefined;
  const activeMembers = new Set(authorizedDirectory?.members.filter(member => member.status === "active").map(member => member.memberId));
  const directory = getTaskApiRuntime().mode === "connected"
    ? (authorizedDirectory?.memberDetails.filter(member => activeMembers.has(member.memberId)) ?? [])
    : listWorkspaceMemberDirectory();
  // CRM must remain usable without the optional People administration directory. The signed-in
  // principal supplies its own label; any supplied default keeps its ID, subject to backend validation.
  if (session && access.memberId === session.principal.memberId && !directory.some(member => member.memberId === session.principal.memberId))
    directory.push({ memberId: session.principal.memberId, displayName: session.principal.displayName, accountSource: "unknown" });
  if (defaults?.assigneeId && !directory.some(member => member.memberId === defaults.assigneeId))
    directory.push({ memberId: defaults.assigneeId, displayName: defaults.assigneeId, accountSource: "unknown" });
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
  const workspaceId = workspace.workspaceId;
  const authority = useTaskCreateAuthority();
  const intent = React.useRef<TaskCreateIntent | undefined>(undefined);
  const uncertainIntent = React.useRef(false);
  const [uncertain, setUncertain] = React.useState(false);
  const abort = React.useRef<AbortController | undefined>(undefined);
  React.useEffect(() => () => abort.current?.abort(), []);
  const liveWorkspace = React.useRef(workspaceId);
  liveWorkspace.current = workspaceId;
  const targetKey = targetId ?? JSON.stringify(context?.recordRef ?? context?.relationshipRef ?? context?.sourceRef ?? "new");
  const opening = React.useRef({ workspaceId, targetKey, context: structuredClone(context), onClose, onCreated, onError, taskId: createTaskId() });
  const fingerprint = (value: TaskCreateDraft) => JSON.stringify({ ...value, title: value.title.trim(), description: value.description.trim() });
  const dirty = fingerprint(draft) !== fingerprint(initialDraft.current);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  React.useEffect(() => {
    if (isOpen && !pending.current && !intent.current && (!previousOpen.current || (opening.current.targetKey !== targetKey && !dirty))) {
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
    const capturedAuthority = authority;
    const context = bound.context;
    abort.current = new AbortController();
    try {
      const taskId = bound.taskId;
      const submitted = intent.current ?? freezeTaskCreateIntent({
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
      intent.current = submitted;
      const outcome = await createTaskCommand(submitted.command, submitted.metadata, { signal: abort.current.signal });
      if (!mounted.current || capturedCycle !== cycle.current || bound.workspaceId !== liveWorkspace.current || capturedAuthority !== getTaskReadAuthorityScope() || portalHostRef.current?.suspended) return false;
      intent.current = undefined; uncertainIntent.current = false; setUncertain(false);
      initialDraft.current = draft;
      // The command is already confirmed. A consumer callback failure cannot become another create.
      try { bound.onCreated?.(outcome.data); bound.onClose(); }
      catch (error) { bound.onError?.(error); }
      return true;
    } catch (error) {
      if (mounted.current && capturedCycle === cycle.current && capturedAuthority === getTaskReadAuthorityScope()) {
        const normalized = normalizeApplicationError(error);
        const definitelyRejected = taskCreateDefinitelyRejected(normalized.code, uncertainIntent.current);
        if (definitelyRejected) { intent.current = undefined; uncertainIntent.current = false; setUncertain(false); }
        else { uncertainIntent.current = true; setUncertain(true); }
        if (["ACCESS_DENIED", "RESOURCE_NOT_FOUND"].includes(normalized.code) && bound.context) {
          const { label: protectedLabel, ...contextWithoutLabel } = bound.context;
          void protectedLabel;
          bound.context = contextWithoutLabel;
        }
        const errors = Object.fromEntries(Object.entries(normalized.fieldErrors ?? {}).map(([field, messages]) => [field, messages.join(" ")]));
        setFieldErrors(errors);
        const first = ["title", "assigneeId", "dueAt"].find(field => errors[field]);
        if (first) requestAnimationFrame(() => document.getElementById(`task-create-${first}`)?.focus());
        setErrorMessage(definitelyRejected ? formatApplicationError(normalized, { locale }) : (vi ? "Chưa xác nhận kết quả tạo. Thử lại giữ nguyên yêu cầu để khôi phục Task, không tạo yêu cầu mới." : "Creation acknowledgement is unknown. Retry the unchanged request to recover the Task."));
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
  const close = () => { if (!pending.current && !intent.current) opening.current.onClose(); };
  React.useEffect(() => {
    if (!isOpen || onBindSave) return;
    const capturedCycle = cycle.current;
    const entryToken = {};
    registration.current = entryToken;
    const currentEntry = () => mounted.current && openRef.current && capturedCycle === cycle.current && registration.current === entryToken;
    const unregisterRecovery = portalHost?.registerDraft?.({ canDiscard: () => currentEntry() && !pending.current && !intent.current, discard: () => { if (currentEntry() && !pending.current && !intent.current) { setDraft(initialDraft.current); opening.current.onClose(); } } });
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (dirty || submitting || uncertain) window.addEventListener("beforeunload", warn);
    const unregister = registerUnsavedWork({
      id: `${formId}:${opening.current.targetKey}:${capturedCycle}`,
      title: title ?? formId, isDirty: dirty || submitting || uncertain,
      save: () => currentEntry() && !pending.current ? save() : Promise.resolve(false),
      canDiscard: () => currentEntry() && !pending.current && !intent.current,
      discard: () => { if (currentEntry() && !pending.current && !intent.current) { setDraft(initialDraft.current); opening.current.onClose(); } },
    });
    return () => { unregisterRecovery?.(); unregister(); if (registration.current === entryToken) registration.current = undefined; window.removeEventListener("beforeunload", warn); };
  });

  const canCreate = Boolean(currentMemberId) && access.canPerform("tasks", "create");

  return { portalHost, locale, vi, access, currentMemberId, directory, draft, setDraft, errorMessage, fieldErrors, setFieldErrors, submitting, opening, dirty: dirty || uncertain, submit, close, canCreate, uncertain };
}
