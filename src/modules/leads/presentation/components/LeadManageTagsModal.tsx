import React, { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { Modal, Input, Button } from "@/shared/components/ui";

interface LeadManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (tag: string) => void;
}

export const LeadManageTagsModal: React.FC<LeadManageTagsModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onApply,
}) => {
  const { locale } = useI18n();
  const [tagName, setTagName] = useState("");

  useEffect(() => {
    if (!isOpen) setTagName("");
  }, [isOpen]);

  const submit = () => {
    const normalized = tagName.trim();
    if (!normalized || selectedCount === 0) return;
    onApply(normalized);
    setTagName("");
    onClose();
  };

  return (
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={onClose}
      title={locale === "vi" ? "Gắn nhãn cho Lead đã chọn" : "Tag selected Leads"}
      size="sm"
    >
      <div className="space-y-4 text-left font-sans">
        <p className="text-[11px] text-slate-500">
          {locale === "vi"
            ? `Nhãn mới sẽ được gắn vào ${selectedCount} Lead đã chọn. Nhãn hiện có được giữ nguyên.`
            : `The new tag will be added to ${selectedCount} selected Leads. Existing tags are preserved.`}
        </p>
        <Input
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
          <Button type="button" variant="secondary" onClick={onClose}>
            {locale === "vi" ? "Hủy" : "Cancel"}
          </Button>
          <Button type="button" variant="primary" disabled={!tagName.trim() || selectedCount === 0} onClick={submit}>
            {locale === "vi" ? "Gắn nhãn" : "Apply tag"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
