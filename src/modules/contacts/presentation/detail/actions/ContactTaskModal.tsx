import React from "react";
import {
  TaskCreateModal,
  type Task,
  type TaskCreateContext,
  type TaskCreateDefaults,
} from "@/modules/tasks";

interface ContactTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: TaskCreateContext;
  defaults?: TaskCreateDefaults;
  onCreated?: (task: Task) => void;
}

export const ContactTaskModal: React.FC<ContactTaskModalProps> = ({
  isOpen,
  onClose,
  context,
  defaults,
  onCreated,
}) => (
  <TaskCreateModal
    isOpen={isOpen}
    onClose={onClose}
    context={context}
    defaults={defaults}
    onCreated={onCreated}
  />
);
