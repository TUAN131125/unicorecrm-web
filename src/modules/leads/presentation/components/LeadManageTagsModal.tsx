import { useLeadAuxiliaryLifecycle } from "../hooks/useLeadAuxiliaryLifecycle";
import React, { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { Modal, Input, Button } from "@/shared/components/ui";

interface LeadManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void | Promise<unknown>;
  selectedCount: number;
  onSave?: (tag: string) => Promise<boolean>;
  onApply: (tag: string) => void | Promise<unknown>;
}

export const LeadManageTagsModal: React.FC<LeadManageTagsModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onApply,
  onSave,
}) => {
  const { locale } = useI18n();
  const [tagName, setTagName] = useState("");

  const lifecycle = useLeadAuxiliaryLifecycle(isOpen, "LeadManageTagsModal", Boolean(tagName.trim()), () => { setTagName(""); }, onClose);

  useEffect(() => {
    if (!isOpen) setTagName("");
  }, [isOpen]);

  lifecycle.bindSave(async () => tagName.trim() && selectedCount > 0 && onSave ? onSave(tagName.trim()) : false);
  const submit = async () => {
    const normalized = tagName.trim();
    if (!normalized || selectedCount === 0) return;
    if (onSave) { await lifecycle.save(); return; }
    if (await lifecycle.run(() => onApply(normalized))) { setTagName(""); onClose(); }
  };

  return (
    <> <Modal
      variant="form"
      isOpen={isOpen}
      onClose={lifecycle.requestClose}
      title={locale === "vi" ? "Gắn nhãn cho Lead đã chọn" : "Tag selected Leads"}
      size="sm"
    >
      <div className="space-y-4 text-left font-sans">
        {lifecycle.error && <p role="alert">{lifecycle.error}</p>}
        <p className="text-[11px] text-slate-500">
          {locale === "vi"
            ? `Nhãn mới sẽ được gắn vào ${selectedCount} Lead đã chọn. Nhãn hiện có được giữ nguyên.`
            : `The new tag will be added to ${selectedCount} selected Leads. Existing tags are preserved.`}
        </p>
        <Input disabled={lifecycle.pending}
          label={locale === "vi" ? "Tên nhãn" : "Tag name"}
          placeholder={locale === "vi" ? "Ví dụ: Hội thảo tháng 7" : "For example: July webinar"}
          value={tagName}
          onChange={(event) => setTagName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button type="button" variant="secondary" onClick={lifecycle.requestClose}>
            {locale === "vi" ? "Hủy" : "Cancel"}
          </Button>
          <Button type="button" variant="primary" disabled={lifecycle.pending || !tagName.trim() || selectedCount === 0} onClick={submit}>
            {locale === "vi" ? "Gắn nhãn" : "Apply tag"}
          </Button>
        </div>
      </div>
    </Modal>{lifecycle.confirmation}</>
  );
};
