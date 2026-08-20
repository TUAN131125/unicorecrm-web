import React from "react";
import { Button, Modal } from "@/shared/components/ui";

interface RelationshipQuickActionModalProps {
  isOpen: boolean;
  onClose(): void;
  title: string;
  formId: string;
  submitLabel: string;
  cancelLabel: string;
  onSubmit(event: React.FormEvent<HTMLFormElement>): void;
  children: React.ReactNode;
  submitDisabled?: boolean;
  bodyClassName?: string;
}

/**
 * Canonical quick-action form used by relationship records.
 * Lead, Organization, Contact and Customer actions share the same width,
 * field rhythm and fixed footer so switching records never changes the
 * interaction model.
 */
export function RelationshipQuickActionModal({
  isOpen,
  onClose,
  title,
  formId,
  submitLabel,
  cancelLabel,
  onSubmit,
  children,
  submitDisabled = false,
  bodyClassName = "",
}: RelationshipQuickActionModalProps) {
  return (
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      bodyClassName={bodyClassName}
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={onClose}>{cancelLabel}</Button>
          <Button type="submit" variant="primary" form={formId} disabled={submitDisabled}>{submitLabel}</Button>
        </>
      )}
    >
      <form
        id={formId}
        className="crm-form-surface space-y-4 text-left"
        onSubmit={onSubmit}
      >
        {children}
      </form>
    </Modal>
  );
}
