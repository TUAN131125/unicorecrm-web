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
  const mounted = React.useRef(true);
  const cycle = React.useRef(0);
  const wasOpen = React.useRef(false);
  if (isOpen !== wasOpen.current) { cycle.current += 1; wasOpen.current = isOpen; }
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { guard.setIsDirty(isOpen && dirty); }, [dirty, isOpen, guard.setIsDirty]);
  React.useEffect(() => { if (!isOpen) { guard.setIsConfirmOpen(false); setError(""); } }, [isOpen, guard.setIsConfirmOpen]);
  const close = () => { if (!pending.current) { if (guardChanges) guard.requestClose(); else onClose(); } };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || submitDisabled || !isOpen || !mounted.current) return;
    const submittingCycle = cycle.current;
    pending.current = true;
    setSubmitting(true);
    setError("");
    try { await onSubmit(event); }
    catch (failure) { if (mounted.current && cycle.current === submittingCycle) setError(formatApplicationError(failure, { locale })); }
    finally { pending.current = false; if (mounted.current) setSubmitting(false); }
  };
  const modalProps = {
      variant: "form" as const,
      containPopovers: guardChanges,
      isOpen,
      onClose: close,
      title,
      bodyClassName: bodyClassName || undefined,
      footer: (
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={submitting}>{cancelLabel}</Button>
          <Button type="submit" variant="primary" form={formId} disabled={submitDisabled || submitting}>{submitLabel}</Button>
        </>
      ),
  };
  const form = <form
        id={formId}
        className="crm-form-surface space-y-4 text-left"
        onSubmit={submit}
      >
        {children}
        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      </form>;
  return (
    <>
    {size === "sm" ? <Modal {...modalProps} variant="form" size="sm" footer={(modalProps.footer)}>{form}</Modal> : <Modal {...modalProps} variant="form" size="md" footer={(modalProps.footer)}>{form}</Modal>}
    {guardChanges && <ConfirmDialog
      isOpen={guard.isConfirmOpen} onClose={() => guard.setIsConfirmOpen(false)} onConfirm={() => { if (!pending.current) guard.confirmDiscard(); }}
      title={locale === "vi" ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"}
      message={locale === "vi" ? "Các thay đổi chưa được lưu. Bạn có muốn đóng biểu mẫu?" : "Your changes have not been saved. Close the form?"}
      confirmText={locale === "vi" ? "Bỏ thay đổi" : "Discard changes"}
      cancelText={locale === "vi" ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning"
    />}
    </>
  );
}
