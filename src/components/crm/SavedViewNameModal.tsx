import React from "react";
import { Button, Input, Modal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";

export interface SavedViewNameModalProps {
  isOpen: boolean;
  onClose(): void;
  mode: "create" | "edit";
  name: string;
  onNameChange(name: string): void;
  onSubmit(event: React.FormEvent): void;
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
  error,
  loading = false,
  formId = "saved-view-name-form",
}: SavedViewNameModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  return (
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={mode === "edit" ? (vi ? "Sửa giao diện" : "Edit saved view") : (vi ? "Tạo giao diện mới" : "Create saved view")}
      footer={(
        <>
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>{vi ? "Hủy" : "Cancel"}</Button>
          <Button variant="primary" size="sm" type="submit" form={formId} loading={loading} disabled={!name.trim()}>
            {mode === "edit" ? (vi ? "Lưu thay đổi" : "Save changes") : (vi ? "Lưu giao diện" : "Save view")}
          </Button>
        </>
      )}
    >
      <form id={formId} onSubmit={onSubmit} className="crm-form-surface space-y-4 text-left">
        <p className="text-xs leading-5 text-slate-500">
          {vi ? "Lưu cấu hình hiển thị hiện tại để sử dụng lại." : "Save the current presentation configuration for reuse."}
        </p>
        <Input
          id={`${formId}-name`}
          autoFocus
          label={vi ? "Tên giao diện" : "View name"}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={vi ? "Nhập tên giao diện" : "Enter view name"}
          error={error}
          required
        />
      </form>
    </Modal>
  );
}
