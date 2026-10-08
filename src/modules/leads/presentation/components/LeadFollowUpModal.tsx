import { useLeadAuxiliaryLifecycle } from "../hooks/useLeadAuxiliaryLifecycle";
import React, { useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import { Modal, Input, Textarea, Button } from "@/shared/components/ui";

interface LeadFollowUpModalProps {
  isOpen: boolean;
  onSave?: (data: { date: string; note: string }) => Promise<boolean>;
  onClose: () => void | Promise<unknown>;
  onConfirm: (data: {
    date: string;
    note: string;
  }) => void | Promise<unknown>;
}

export const LeadFollowUpModal: React.FC<LeadFollowUpModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onSave,
}) => {
  const { t, locale } = useI18n();

  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");

  // Reset states on open
  const lifecycle = useLeadAuxiliaryLifecycle(isOpen, "LeadFollowUpModal", Boolean(followUpDate || followUpNote.trim()), () => { setFollowUpDate(""); setFollowUpNote(""); }, onClose);

  useEffect(() => {
    if (isOpen) {
      setFollowUpDate("");
      setFollowUpNote("");
    }
  }, [isOpen]);

  lifecycle.bindSave(async () => followUpDate && Number.isFinite(Date.parse(followUpDate)) && onSave
    ? onSave({ date: followUpDate, note: followUpNote }) : false);
  const handleExecute = async () => {
    if (!followUpDate) return;
    if (onSave) { await lifecycle.save(); return; }
    if (await lifecycle.run(() => onConfirm({ date: followUpDate, note: followUpNote }))) {
      setFollowUpDate(""); setFollowUpNote("");
    }
  };

  return (
    <> <Modal variant="form"
      isOpen={isOpen}
      onClose={lifecycle.requestClose}
      title={t("leads.followUp.title", "Đặt lịch liên hệ lại")}
      size="sm"
    >
      <div className="space-y-4 text-left font-sans">
        {lifecycle.error && <p role="alert">{lifecycle.error}</p>}
        <Input disabled={lifecycle.pending}
          label={t("leads.followUp.dateLabel", "Ngày liên hệ lại *")}
          type="date"
          required
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
          className="rounded-xl border-slate-200 text-xs"
        />

        <Textarea disabled={lifecycle.pending}
          label={t("leads.followUp.noteLabel", "Nội dung ghi chú")}
          placeholder={locale === "vi" ? "Ghi nội dung trao đổi, kịch bản, thời gian gọi lại..." : "Outreach guidelines, questions to cover and agenda..."}
          value={followUpNote}
          onChange={(e) => setFollowUpNote(e.target.value)}
          rows={2.5}
          className="rounded-xl border-slate-200 text-xs"
        />

        <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <Button variant="secondary" onClick={lifecycle.requestClose}>
            {t("common.cancel", "Hủy")}
          </Button>
          <Button variant="primary" onClick={handleExecute} disabled={lifecycle.pending || !followUpDate}>
            {locale === "vi" ? "Đặt lịch" : "Schedule"}
          </Button>
        </div>
      </div>
    </Modal>{lifecycle.confirmation}</>
  );
};
