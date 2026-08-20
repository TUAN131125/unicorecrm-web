import React, { useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";

import { Modal, Select, Button } from "@/shared/components/ui";

interface LeadBulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onConfirm: (data: { status: string }) => void;
}

export const LeadBulkUpdateModal: React.FC<LeadBulkUpdateModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onConfirm,
}) => {
  const { t, locale } = useI18n();
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState("");

  useEffect(() => {
    if (isOpen) setBulkUpdateStatus("");
  }, [isOpen]);

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} title={locale === "vi" ? "Cập nhật hàng loạt" : "Bulk Update"} size="sm">
      <div className="space-y-4 text-left font-sans">
        <p className="text-[11px] text-slate-500">
          {locale === "vi"
            ? `Đang thay đổi cho ${selectedCount} tiềm năng đang được chọn.`
            : `Modifying settings for ${selectedCount} currently selected leads.`}
        </p>
        <Select
          label={locale === "vi" ? "Trạng thái mới" : "New Status"}
          value={bulkUpdateStatus}
          onChange={(event) => setBulkUpdateStatus(event.target.value)}
          className="rounded-xl border-slate-200 text-xs"
        >
          <option value="">{locale === "vi" ? "-- Giữ nguyên --" : "-- Keep original --"}</option>
          <option value={LeadWorkState.CONTACTING}>{locale === "vi" ? "Đang liên hệ" : "Contacting"}</option>
          <option value={LeadWorkState.VERIFYING}>{locale === "vi" ? "Đang xác minh" : "Verifying"}</option>
        </Select>
        <p className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-[10px] leading-4 text-violet-800">
          {locale === "vi"
            ? "Chỉ cho phép chuyển tiến tới Đang liên hệ hoặc Đang xác minh. Đổi người sở hữu phải dùng Bàn giao."
            : "Only forward transitions to Contacting or Verifying are allowed. Ownership changes must use Handover."}
        </p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel", "Hủy")}</Button>
          <Button variant="primary" onClick={() => onConfirm({ status: bulkUpdateStatus })} disabled={!bulkUpdateStatus}>
            {locale === "vi" ? "Cập nhật" : "Update"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
