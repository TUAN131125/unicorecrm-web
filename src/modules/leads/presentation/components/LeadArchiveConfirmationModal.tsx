import React from "react";
import { useI18n } from "@/i18n";
import { ConfirmDialog } from "@/shared/components/ui";

interface LeadArchiveConfirmationModalProps {
  isOpen: boolean;
  bulk: boolean;
  selectedCount: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: (isCurrent: () => boolean) => void | Promise<unknown>;
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
    <ConfirmDialog isOpen={isOpen} onClose={onClose} onConfirm={onConfirm} title={title}
      loading={pending} confirmDisabled={selectedCount === 0} variant="danger"
      confirmText={locale === "vi" ? "Lưu trữ" : "Archive"}
      cancelText={locale === "vi" ? "Hủy" : "Cancel"}
      message={bulk
            ? (locale === "vi"
                ? "Các khách hàng tiềm năng được chọn sẽ không còn xuất hiện trong danh sách đang hoạt động. Hồ sơ và lịch sử vẫn được lưu giữ."
                : "The selected Leads will no longer appear in active lists. Their data and history will be retained.")
            : (locale === "vi"
                ? "Khách hàng tiềm năng này sẽ không còn xuất hiện trong danh sách đang hoạt động. Hồ sơ và lịch sử vẫn được lưu giữ."
                : "This Lead will no longer appear in active lists. Its record and history will be retained.")}
    />
  );
};
