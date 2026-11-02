import type { RelationshipRef } from "@/platform/identity";
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

