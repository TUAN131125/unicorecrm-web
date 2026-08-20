import React, { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { Modal, Select, Textarea, Button } from "@/shared/components/ui";

interface LeadDisqualifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    reason: string;
    note: string;
    needRecontact: boolean;
    recontactDate?: string;
    recontactNote?: string;
  }) => void;
}

export const LeadDisqualifyModal: React.FC<LeadDisqualifyModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { t, locale } = useI18n();
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setEvidence("");
    }
  }, [isOpen]);

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} title={t("leads.disqualification.title", "Không phù hợp")} size="sm">
      <div className="space-y-4 text-left font-sans">
        <p className="text-[11px] text-slate-500">
          {locale === "vi"
            ? "DISQUALIFIED đóng Lead với lý do và bằng chứng. Trường hợp cần quay lại sau phải dùng outcome Chăm sóc (NURTURE)."
            : "DISQUALIFIED closes the Lead with reason and evidence. Future re-engagement belongs to the NURTURE outcome."}
        </p>
        <Select
          label={t("leads.disqualification.reasonLabel", "Lý do *")}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="rounded-xl border-slate-200 text-xs"
        >
          <option value="">{locale === "vi" ? "-- Chọn lý do --" : "-- Select reason --"}</option>
          <option value={locale === "vi" ? "Không có nhu cầu" : "No interest/need"}>{locale === "vi" ? "Không có nhu cầu" : "No interest/need"}</option>
          <option value={locale === "vi" ? "Thông tin không hợp lệ" : "Invalid information"}>{locale === "vi" ? "Thông tin không hợp lệ" : "Invalid information"}</option>
          <option value={locale === "vi" ? "Không liên lạc được sau nhiều lần" : "Unreachable after repeated outreach"}>{locale === "vi" ? "Không liên lạc được sau nhiều lần" : "Unreachable after repeated outreach"}</option>
          <option value={locale === "vi" ? "Không phù hợp ICP" : "Outside ICP / no fit"}>{locale === "vi" ? "Không phù hợp ICP" : "Outside ICP / no fit"}</option>
          <option value={locale === "vi" ? "Trùng lặp" : "Duplicate"}>{locale === "vi" ? "Trùng lặp" : "Duplicate"}</option>
          <option value={locale === "vi" ? "Khác" : "Other"}>{locale === "vi" ? "Khác" : "Other"}</option>
        </Select>
        <Textarea
          label={locale === "vi" ? "Bằng chứng / ghi chú *" : "Evidence / notes *"}
          placeholder={locale === "vi" ? "Ghi lại evidence đủ để audit quyết định..." : "Record evidence sufficient to audit this decision..."}
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
          rows={3}
          required
          className="rounded-xl border-slate-200 text-xs"
        />
        <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel", "Hủy")}</Button>
          <Button
            variant="primary"
            onClick={() => onConfirm({ reason, note: evidence, needRecontact: false })}
            disabled={!reason.trim() || !evidence.trim()}
            className="bg-red-600 hover:bg-red-700 border-red-600 text-white disabled:opacity-50"
          >
            {locale === "vi" ? "Xác nhận Không phù hợp" : "Confirm Disqualified"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
