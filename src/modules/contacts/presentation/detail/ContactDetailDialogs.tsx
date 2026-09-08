import React from "react";
import { AlertTriangle } from "lucide-react";
import type { Contact } from "../../domain/model/contact.types";
import { Button, Modal } from "@/shared/components/ui";
import { ContactEditModal } from "./ContactEditModal";
import { ContactCreateOpportunityModal } from "./ContactCreateOpportunityModal";
import { ContactQuickNoteModal } from "./actions/ContactQuickNoteModal";
import { ContactTaskModal } from "./actions/ContactTaskModal";
import { ContactMeetingModal } from "./actions/ContactMeetingModal";
import { ContactLogCallModal } from "./actions/ContactLogCallModal";
import { ContactSendEmailModal } from "./actions/ContactSendEmailModal";
import { ContactSendSmsModal } from "./actions/ContactSendSmsModal";

type Translate = (key: string, fallback: string) => string;

interface ContactDetailDialogsProps {
  contact: Contact;
  tx: Translate;
  edit: React.ComponentProps<typeof ContactEditModal>;
  opportunity: React.ComponentProps<typeof ContactCreateOpportunityModal>;
  quickNote: React.ComponentProps<typeof ContactQuickNoteModal>;
  task: React.ComponentProps<typeof ContactTaskModal>;
  meeting: React.ComponentProps<typeof ContactMeetingModal>;
  logCall: React.ComponentProps<typeof ContactLogCallModal>;
  email: React.ComponentProps<typeof ContactSendEmailModal>;
  sms: React.ComponentProps<typeof ContactSendSmsModal>;
  deleteContact: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
  };
}

export function ContactDetailDialogs({
  contact,
  tx,
  edit,
  opportunity,
  quickNote,
  task,
  meeting,
  logCall,
  email,
  sms,
  deleteContact,
}: ContactDetailDialogsProps) {
  const [archivePending, setArchivePending] = React.useState(false);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);
  const confirmArchive = async () => {
    if (archivePending) return;
    setArchivePending(true);
    setArchiveError(null);
    try {
      await deleteContact.onConfirm();
    } catch {
      setArchiveError(tx("contactDetail.confirm.archiveFailed", "Không thể lưu trữ liên hệ. Vui lòng kiểm tra dữ liệu mới nhất và thử lại."));
    } finally {
      setArchivePending(false);
    }
  };
  return (
    <>
      <ContactEditModal {...edit} />
      <ContactCreateOpportunityModal {...opportunity} />

      <Modal
        isOpen={deleteContact.isOpen}
        onClose={() => { if (!archivePending) deleteContact.onClose(); }}
        title={tx("contactDetail.confirm.archiveTitle", "Xác nhận lưu trữ liên hệ")}
        size="sm"
      >
        <div className="space-y-4 text-xs text-slate-700 text-left">
          <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-800">
            <AlertTriangle className="text-rose-600 shrink-0 w-4 h-4 mt-0.5" />
            <div>
              <p className="font-extrabold text-[11px] uppercase tracking-wider">{tx("common.warning", "Cảnh báo nguy hiểm")}</p>
              <p className="text-[10px] leading-relaxed font-semibold mt-1">
                {tx("contactDetail.confirm.archiveWarningText", "Hồ sơ sẽ được chuyển vào lưu trữ. Thông tin định danh, lịch sử tương tác và bằng chứng nghiệp vụ vẫn được giữ lại.")}
              </p>
            </div>
          </div>
          <p className="text-slate-500 font-semibold p-1">
            {tx("contactDetail.confirm.archiveBody", "Bạn có chắc chắn muốn lưu trữ hồ sơ liên hệ này không?")}
          </p>
          {archiveError ? <p className="rounded-lg bg-red-50 p-2 text-red-700">{archiveError}</p> : null}
          <div className="flex justify-end gap-2 pt-2.5 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={deleteContact.onClose} disabled={archivePending}>
              {tx("common.cancel", "Hủy bỏ")}
            </Button>
            <Button type="button" variant="danger" onClick={confirmArchive} disabled={archivePending} className="bg-rose-600 hover:bg-rose-700 text-white">
              {tx("common.archive", "Lưu trữ")}
            </Button>
          </div>
        </div>
      </Modal>

      <ContactQuickNoteModal {...quickNote} />
      <ContactTaskModal {...task} />
      <ContactMeetingModal {...meeting} />
      <ContactLogCallModal {...logCall} />
      <ContactSendEmailModal {...email} />
      <ContactSendSmsModal {...sms} />
    </>
  );
}
