import React from "react";
import { useI18n } from "@/i18n";
import { Button, Modal, Textarea } from "@/shared/components/ui";

interface LeadArchiveConfirmationModalProps {
  isOpen: boolean;
  bulk: boolean;
  selectedCount: number;
  reason: string;
  pending: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const LeadArchiveConfirmationModal: React.FC<LeadArchiveConfirmationModalProps> = ({
  isOpen,
  bulk,
  selectedCount,
  reason,
  pending,
  onReasonChange,
  onClose,
  onConfirm,
}) => {
  const { locale } = useI18n();
  const title = bulk
    ? (locale === "vi" ? `Xóa ${selectedCount} khách hàng tiềm năng` : `Delete ${selectedCount} Leads`)
    : (locale === "vi" ? "Lưu trữ Lead" : "Archive Lead");

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4 text-left font-sans">
        <p className="text-sm leading-6 text-slate-600">
          {bulk
            ? (locale === "vi"
                ? "Các khách hàng tiềm năng được chọn sẽ không còn xuất hiện trong danh sách đang hoạt động. Dữ liệu và lịch sử vẫn được lưu giữ."
                : "The selected Leads will no longer appear in active lists. Their data and history will be retained.")
            : (locale === "vi"
                ? "Lead sẽ bị ẩn khỏi danh sách đang hoạt động. Hồ sơ và lịch sử vẫn được giữ lại."
                : "The Lead will be hidden from active lists. Its record and history will be retained.")}
        </p>
        <Textarea
          label={bulk && locale === "vi" ? "Lý do *" : (locale === "vi" ? "Lý do lưu trữ *" : bulk ? "Reason *" : "Archive reason *")}
          required
          value={reason}
          maxLength={2000}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={locale === "vi" ? "Nhập lý do để lưu trong lịch sử hồ sơ" : "Enter a reason for the record history"}
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {locale === "vi" ? "Hủy" : "Cancel"}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={pending || !reason.trim() || selectedCount === 0}
          >
            {bulk ? (locale === "vi" ? "Xóa" : "Delete") : (locale === "vi" ? "Lưu trữ" : "Archive")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
