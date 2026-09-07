import React from "react";
import { useI18n } from "@/i18n";
import { Button, Modal } from "@/shared/components/ui";

interface LeadArchiveConfirmationModalProps {
  isOpen: boolean;
  bulk: boolean;
  selectedCount: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LeadArchiveConfirmationModal: React.FC<LeadArchiveConfirmationModalProps> = ({
  isOpen,
  bulk,
  selectedCount,
  pending,
  onClose,
  onConfirm,
}) => {
  const { locale } = useI18n();
  const title = bulk
    ? (locale === "vi" ? `Lưu trữ ${selectedCount} khách hàng tiềm năng` : `Archive ${selectedCount} Leads`)
    : (locale === "vi" ? "Lưu trữ khách hàng tiềm năng" : "Archive Lead");

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4 text-left font-sans">
        <p className="text-sm leading-6 text-slate-600">
          {bulk
            ? (locale === "vi"
                ? "Các khách hàng tiềm năng được chọn sẽ không còn xuất hiện trong danh sách đang hoạt động. Hồ sơ và lịch sử vẫn được lưu giữ."
                : "The selected Leads will no longer appear in active lists. Their data and history will be retained.")
            : (locale === "vi"
                ? "Khách hàng tiềm năng này sẽ không còn xuất hiện trong danh sách đang hoạt động. Hồ sơ và lịch sử vẫn được lưu giữ."
                : "This Lead will no longer appear in active lists. Its record and history will be retained.")}
        </p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {locale === "vi" ? "Hủy" : "Cancel"}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={pending || selectedCount === 0}
          >
            {locale === "vi" ? "Lưu trữ" : "Archive"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
