import React, { useState } from "react";
import { useI18n } from "@/i18n";
import { Modal, Button, Select, Textarea } from "@/shared/components/ui";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";

interface ContactBulkChangeOwnerModalProps {
  show: boolean;
  onClose: () => void;
  selectedCount: number;
  onConfirm: (targetOwnerId: string, remark: string) => void;
}

export const ContactBulkChangeOwnerModal: React.FC<ContactBulkChangeOwnerModalProps> = ({
  show,
  onClose,
  selectedCount,
  onConfirm
}) => {
  const { tx } = useI18n();
  const [targetOwnerId, setTargetOwnerId] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!targetOwnerId) {
      setError(tx("contactForm.ownerRequired", "Vui lòng chọn người phụ trách mới"));
      return;
    }
    setError("");
    onConfirm(targetOwnerId, remark);
    setTargetOwnerId("");
    setRemark("");
  };

  return (
    <Modal variant="form"
      isOpen={show}
      onClose={onClose}
      title={tx("contactActions.changeOwner", "Đổi người phụ trách")}
      size="sm"
    >
      <div className="space-y-4 text-left font-sans text-xs">
        <p className="text-slate-600 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50">
          {tx("contacts.bulk.changeOwnerDescription", "Bạn đang thực hiện thay đổi người phụ trách cho các liên hệ được chọn.")}
        </p>

        <div>
          <Select
            label={tx("contactForm.owner", "Hội viên phụ trách mới *")}
            value={targetOwnerId}
            onChange={(e) => {
              setTargetOwnerId(e.target.value);
              setError("");
            }}
            className="rounded-xl border-slate-200"
          >
            <option value="">-- {tx("contactForm.ownerPlaceholder", "Chọn người phụ trách")} --</option>
            {getWorkspaceMemberOptions().map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </Select>
          {error && <p className="text-rose-500 font-medium mt-1 text-[10px]">{error}</p>}
        </div>

        <div>
          <Textarea
            label={tx("contactForm.internalNotes", "Ghi chú bàn giao công việc (Không bắt buộc)")}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={tx("contactForm.followUpNote", "Nội dung bàn giao, kế hoạch chăm sóc tiếp...")}
            rows={3}
            className="rounded-xl border-slate-200"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} type="button">
            {tx("common.cancel", "Hủy")}
          </Button>
          <Button variant="primary" onClick={handleConfirm} type="button">
            {tx("common.done", "Xác nhận")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
