import React from "react";
import { RelationshipQuickActionModal } from "@/components/crm/relationship-panel/RelationshipQuickActionModal";
import { Button, Input, Modal, SearchableSelect, Select, Textarea } from "@/shared/components/ui";
import type { RelationshipRef } from "@/platform/identity";
import type { RecordRef, Task, TaskPriority, TaskSourceRef } from "../../domain/model/task.types";
import { useTaskCreateAuthority, useTaskCreateController } from "../hooks/useTaskCreateController";

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

export const TaskCreateModal: React.FC<TaskCreateModalProps> = (props) => {
  const authority = useTaskCreateAuthority();
  return <TaskCreateSession key={authority ?? "unresolved"} {...props} />;
};

const TaskCreateSession: React.FC<TaskCreateModalProps> = (props) => {
  const { guardChanges = true, formId = "canonical-task-create-form", isOpen, title, submitLabel } = props;
  const { vi, currentMemberId, directory, draft, setDraft, errorMessage, fieldErrors, setFieldErrors,
    submitting, opening, dirty, submit, close, canCreate, uncertain } = useTaskCreateController(props);
  const fields = (
      <fieldset disabled={submitting || uncertain} className="contents">
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
      submitLabel={uncertain ? (vi ? "Thử lại cùng yêu cầu" : "Retry same request") : submitLabel ?? (vi ? "Tạo công việc" : "Create task")}
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
            {uncertain ? (vi ? "Thử lại cùng yêu cầu" : "Retry same request") : submitLabel ?? (vi ? "Tạo công việc" : "Create task")}
          </Button>
        </>
      )}
    >
      <form id={formId} className="crm-form-surface grid gap-4 sm:grid-cols-2" onSubmit={submit}>{fields}</form>
    </Modal>
  );
};
