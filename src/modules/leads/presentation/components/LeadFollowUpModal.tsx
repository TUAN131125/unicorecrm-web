import React, { useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import { Modal, Input, Textarea, Button } from "@/shared/components/ui";

interface LeadFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    date: string;
    note: string;
  }) => void;
}

export const LeadFollowUpModal: React.FC<LeadFollowUpModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { t, locale } = useI18n();

  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");

  // Reset states on open
  useEffect(() => {
    if (isOpen) {
      setFollowUpDate("");
      setFollowUpNote("");
    }
  }, [isOpen]);

  const handleExecute = () => {
    onConfirm({
      date: followUpDate,
      note: followUpNote,
    });
  };

  return (
    <Modal variant="form"
      isOpen={isOpen}
      onClose={onClose}
      title={t("leads.followUp.title", "Đặt lịch liên hệ lại")}
      size="sm"
    >
      <div className="space-y-4 text-left font-sans">
        <Input
          label={t("leads.followUp.dateLabel", "Ngày liên hệ lại *")}
          type="date"
          required
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
          className="rounded-xl border-slate-200 text-xs"
        />

        <Textarea
          label={t("leads.followUp.noteLabel", "Nội dung ghi chú")}
          placeholder={locale === "vi" ? "Ghi nội dung trao đổi, kịch bản, thời gian gọi lại..." : "Outreach guidelines, questions to cover and agenda..."}
          value={followUpNote}
          onChange={(e) => setFollowUpNote(e.target.value)}
          rows={2.5}
          className="rounded-xl border-slate-200 text-xs"
        />

        <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel", "Hủy")}
          </Button>
          <Button variant="primary" onClick={handleExecute} disabled={!followUpDate}>
            {locale === "vi" ? "Đặt lịch" : "Schedule"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
