import React from "react";
import { Button, ConfirmDialog, Input, Modal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";

import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { formatApplicationError } from "@/shared/operations";

export interface SavedViewNameModalProps {
  isOpen: boolean;
  onClose(): void;
  mode: "create" | "edit";
  name: string;
  onNameChange(name: string): void;
  onSubmit(event: React.FormEvent): void | Promise<void>;
  /** Owner validates and awaits persistence; true is explicit persisted-result proof. */
  onSave?(name: string): Promise<boolean>;
  /** Optional saved-view identity supplied by controllers owning edit intent. */
  targetId?: string;
  error?: string;
  loading?: boolean;
  formId?: string;
}

export function SavedViewNameModal({
  isOpen,
  onClose,
  mode,
  name,
  onNameChange,
  onSubmit,
  onSave,
  error,
  loading = false,
  formId = "saved-view-name-form",
  targetId,
}: SavedViewNameModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const workspaceId = useWorkspaceContextSnapshot().workspaceId;
  const opening = React.useRef<{ workspaceId: string; name: string; mode: "create" | "edit"; targetId: string | undefined;
    onSave: SavedViewNameModalProps["onSave"]; onClose: () => void } | undefined>(undefined);
  const wasOpen = React.useRef(false);
  const cycle = React.useRef(0);
  const pending = React.useRef(false);
  const mounted = React.useRef(true);
  const openRef = React.useRef(isOpen); openRef.current = isOpen;
  const liveIdentity = React.useRef({ mode, targetId }); liveIdentity.current = { mode, targetId };
  const registration = React.useRef<object | undefined>(undefined);
  const [submitting, setSubmitting] = React.useState(false);
  const [failure, setFailure] = React.useState("");
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => {
    if (isOpen && !wasOpen.current) { cycle.current += 1; opening.current = { workspaceId, name, mode, targetId, onSave, onClose }; setFailure(""); }
    if (!isOpen && wasOpen.current) { cycle.current += 1; guard.setIsConfirmOpen(false); }
    wasOpen.current = isOpen;
  }, [isOpen, name, mode, targetId, workspaceId, onSave, onClose]);
  const guard = useUnsavedChangesGuard(() => { onNameChange(opening.current?.name ?? ""); onClose(); });
  const dirty = isOpen && name.trim() !== (opening.current?.name.trim() ?? name.trim());
  React.useEffect(() => { guard.setIsDirty(dirty); }, [dirty, guard.setIsDirty]);
  React.useEffect(() => {
    if (isOpen && opening.current?.workspaceId !== workspaceId && !dirty && !pending.current && !loading) onClose();
  }, [isOpen, workspaceId, dirty, loading, onClose]);
  const close = () => { if (!pending.current && !loading) guard.requestClose(); };
  React.useEffect(() => {
    if (!isOpen) return;
    const registeredCycle = cycle.current;
    const token = {}; registration.current = token;
    const unregister = registerUnsavedWork({ id: `saved-view:${formId}:${registeredCycle}`, title: vi ? "Tên giao diện" : "View name", isDirty: dirty || loading || submitting,
      save: () => registration.current === token && cycle.current === registeredCycle ? save() : Promise.resolve(false),
      canDiscard: () => mounted.current && cycle.current === registeredCycle && !pending.current && !loading,
      discard: () => { if (mounted.current && cycle.current === registeredCycle && !pending.current && !loading) guard.confirmDiscard(); },
    });
    return () => { unregister(); if (registration.current === token) registration.current = undefined; };
  });
  React.useEffect(() => {
    if (!dirty && !loading && !submitting) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, loading, submitting]);
  React.useEffect(() => { if (isOpen && (error || failure)) document.getElementById(`${formId}-name`)?.focus(); }, [isOpen, error, failure, formId]);
  async function save(): Promise<boolean> {
    if (!opening.current?.onSave || !openRef.current || !mounted.current || pending.current || loading) return false;
    if (opening.current?.workspaceId !== getWorkspaceContextSnapshot().workspaceId || opening.current.mode !== mode || opening.current.targetId !== targetId) return false;
    if (!name.trim()) { setFailure(vi ? "Hãy nhập tên giao diện." : "Enter a view name."); document.getElementById(`${formId}-name`)?.focus(); return false; }
    const captured = cycle.current;
    pending.current = true; setSubmitting(true); setFailure("");
    try {
      const command = opening.current.onSave(name.trim());
      if (!command || typeof command.then !== "function") return false;
      const saved = await command;
      if (saved !== true || !mounted.current || !openRef.current || cycle.current !== captured || opening.current.workspaceId !== getWorkspaceContextSnapshot().workspaceId
        || opening.current.mode !== liveIdentity.current.mode || opening.current.targetId !== liveIdentity.current.targetId) return false;
      opening.current.name = name;
      openRef.current = false;
      guard.setIsDirty(false);
      opening.current.onClose();
      return true;
    } catch (caught) { if (mounted.current && cycle.current === captured) setFailure(formatApplicationError(caught, { locale })); return false; }
    finally { pending.current = false; if (mounted.current) setSubmitting(false); }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (opening.current?.onSave) { await save(); return; }
    if (pending.current || loading || !isOpen || !mounted.current) return;
    if (opening.current?.workspaceId !== getWorkspaceContextSnapshot().workspaceId) { setFailure(vi ? "Hãy trở lại workspace đang mở để lưu." : "Return to the opening workspace to save."); return; }
    if (!name.trim()) { setFailure(vi ? "Hãy nhập tên giao diện." : "Enter a view name."); return; }
    if (opening.current?.mode !== mode || opening.current?.targetId !== targetId) { setFailure(vi ? "Giao diện đang mở đã thay đổi. Hãy đóng và mở lại." : "The opening view changed. Close and reopen the form."); return; }
    const submittingCycle = cycle.current;
    pending.current = true; setSubmitting(true); setFailure("");
    try { await onSubmit(event); }
    catch (caught) { if (mounted.current && cycle.current === submittingCycle) setFailure(formatApplicationError(caught, { locale })); }
    finally { pending.current = false; if (mounted.current) setSubmitting(false); }
  };
  return (
    <>
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={close}
      size="sm"
      title={mode === "edit" ? (vi ? "Sửa giao diện" : "Edit saved view") : (vi ? "Tạo giao diện mới" : "Create saved view")}
      footer={(
        <>
          <Button variant="secondary" size="sm" type="button" onClick={close} disabled={loading || submitting}>{vi ? "Hủy" : "Cancel"}</Button>
          <Button variant="primary" size="sm" type="submit" form={formId} loading={loading || submitting} disabled={!name.trim() || loading || submitting}>
            {mode === "edit" ? (vi ? "Lưu thay đổi" : "Save changes") : (vi ? "Lưu giao diện" : "Save view")}
          </Button>
        </>
      )}
    >
      <form id={formId} onSubmit={submit} className="crm-form-surface space-y-4 text-left">
        <p className="text-xs leading-5 text-slate-500">
          {vi ? "Lưu cấu hình hiển thị hiện tại để sử dụng lại." : "Save the current presentation configuration for reuse."}
        </p>
        <Input
          id={`${formId}-name`}
          autoFocus
          label={vi ? "Tên giao diện" : "View name"}
          disabled={loading || submitting}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={vi ? "Nhập tên giao diện" : "Enter view name"}
          error={failure || error}
          required
        />
      </form>
    </Modal>
    <ConfirmDialog isOpen={guard.isConfirmOpen} onClose={() => guard.setIsConfirmOpen(false)} onConfirm={() => { if (!pending.current && !loading) guard.confirmDiscard(); }} title={vi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"} message={vi ? "Tên giao diện chưa được lưu." : "The view name has not been saved."} confirmText={vi ? "Bỏ thay đổi" : "Discard changes"} cancelText={vi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" />
    </>
  );
}
