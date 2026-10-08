import { useLeadAuxiliaryLifecycle } from "../hooks/useLeadAuxiliaryLifecycle";
import React, { useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";

import { Modal, Select, Button } from "@/shared/components/ui";

interface LeadBulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void | Promise<unknown>;
  selectedCount: number;
  onSave?: (data: { status: string }) => Promise<boolean>;
  onConfirm: (data: { status: string }) => void | Promise<unknown>;
}

export const LeadBulkUpdateModal: React.FC<LeadBulkUpdateModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onConfirm,
  onSave,
}) => {
  const { t, locale } = useI18n();
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState("");

  const lifecycle = useLeadAuxiliaryLifecycle(isOpen, "LeadBulkUpdateModal", Boolean(bulkUpdateStatus), () => { setBulkUpdateStatus(""); }, onClose);

  useEffect(() => {
    if (isOpen) setBulkUpdateStatus("");
  }, [isOpen]);

  lifecycle.bindSave(async () => selectedCount > 0 && (bulkUpdateStatus === LeadWorkState.CONTACTING || bulkUpdateStatus === LeadWorkState.VERIFYING) && onSave
    ? onSave({ status: bulkUpdateStatus }) : false);

  return (
    <> <Modal variant="form" isOpen={isOpen} onClose={lifecycle.requestClose} title={locale === "vi" ? "Cập nhật hàng loạt" : "Bulk Update"} size="sm">
      <div className="space-y-4 text-left font-sans">
        {lifecycle.error && <p role="alert">{lifecycle.error}</p>}
        <p className="text-[11px] text-slate-500">
          {locale === "vi"
            ? `Đang thay đổi cho ${selectedCount} tiềm năng đang được chọn.`
            : `Modifying settings for ${selectedCount} currently selected leads.`}
        </p>
        <Select disabled={lifecycle.pending}
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
          <Button variant="secondary" onClick={lifecycle.requestClose}>{t("common.cancel", "Hủy")}</Button>
          <Button variant="primary" onClick={() => { void (onSave ? lifecycle.save() : lifecycle.run(() => onConfirm({ status: bulkUpdateStatus }))); }} disabled={lifecycle.pending || !bulkUpdateStatus}>
            {locale === "vi" ? "Cập nhật" : "Update"}
          </Button>
        </div>
      </div>
    </Modal>{lifecycle.confirmation}</>
  );
};
