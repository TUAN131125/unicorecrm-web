import React from "react";
import { Button, ConfirmDialog, Modal } from "@/shared/components/ui";

import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { formatApplicationError } from "@/shared/operations";
import { useI18n } from "@/i18n";

interface RelationshipQuickActionModalProps {
  size?: "sm" | "md";
  guardChanges?: boolean;
  dirty?: boolean;
  isOpen: boolean;
  onClose(): void;
  title: string;
  formId: string;
  submitLabel: string;
  cancelLabel: string;
  onSubmit(event: React.FormEvent<HTMLFormElement>): void | Promise<void>;
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
  size = "md",
  guardChanges = false,
  dirty = false,
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
  const { locale } = useI18n();
  const guard = useUnsavedChangesGuard(onClose);
  const pending = React.useRef(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { guard.setIsDirty(isOpen && dirty); }, [dirty, isOpen, guard.setIsDirty]);
  React.useEffect(() => { if (!isOpen) { guard.setIsConfirmOpen(false); setError(""); } }, [isOpen, guard.setIsConfirmOpen]);
  const close = guardChanges ? () => { if (!pending.current) guard.requestClose(); } : onClose;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setError("");
    try { await onSubmit(event); }
    catch (failure) { setError(formatApplicationError(failure, { locale })); }
    finally { pending.current = false; setSubmitting(false); }
  };
  return (
    <>
    <Modal
      variant="form"
      containPopovers={guardChanges}
      isOpen={isOpen}
      onClose={close}
      title={title}
      size={size}
      bodyClassName={bodyClassName || undefined}
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={guardChanges && submitting}>{cancelLabel}</Button>
          <Button type="submit" variant="primary" form={formId} disabled={submitDisabled || (guardChanges && submitting)}>{submitLabel}</Button>
        </>
      )}
    >
      <form
        id={formId}
        className="crm-form-surface space-y-4 text-left"
        onSubmit={guardChanges ? submit : onSubmit}
      >
        {children}
        {guardChanges && error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      </form>
    </Modal>
    {guardChanges && <ConfirmDialog
      isOpen={guard.isConfirmOpen} onClose={() => guard.setIsConfirmOpen(false)} onConfirm={guard.confirmDiscard}
      title={locale === "vi" ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"}
      message={locale === "vi" ? "Các thay đổi chưa được lưu. Bạn có muốn đóng biểu mẫu?" : "Your changes have not been saved. Close the form?"}
      confirmText={locale === "vi" ? "Bỏ thay đổi" : "Discard changes"}
      cancelText={locale === "vi" ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning"
    />}
    </>
  );
}
