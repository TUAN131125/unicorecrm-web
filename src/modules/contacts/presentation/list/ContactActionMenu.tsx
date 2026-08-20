import React, { useState } from "react";
import { 
  Eye, Phone, Mail, MessageSquare, Plus, Calendar, CheckSquare,
  FileText, User, Tag, Share2, Copy, Printer, Download, Archive 
} from "lucide-react";
import { Contact } from "../../domain/model/contact.types";
import { MenuItemButton, Modal, Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";

interface ContactActionMenuProps {
  contact: Contact;
  onClose: () => void;
  onViewDetails?: (contactId: string) => void;
  onCall?: (contact: Contact) => void;
  onEmail?: (contact: Contact) => void;
  onSms?: (contact: Contact) => void;
  onCreateTask?: (contact: Contact) => void;
  onScheduleMeeting?: (contact: Contact) => void;
  onAddNote?: (contact: Contact) => void;
  onOpenOpportunityWizard?: (contact: Contact) => void;
  onSetAsPrimary?: (contact: Contact) => void;
  onChangeOwner?: (contact: Contact) => void;
  onManageTags?: (contact: Contact) => void;
  onShare?: (contact: Contact) => void;
  onDuplicate?: (contact: Contact) => void;
  onPrint?: (contact: Contact) => void;
  onExport?: (contact: Contact) => void;
  onOpenDeleteConfirm?: (contact: Contact) => void;
  onArchive?: (contact: Contact) => void;
}

export const ContactActionMenu: React.FC<ContactActionMenuProps> = ({
  contact,
  onClose,
  onViewDetails,
  onCall,
  onEmail,
  onSms,
  onCreateTask,
  onScheduleMeeting,
  onAddNote,
  onOpenOpportunityWizard,
  onSetAsPrimary,
  onChangeOwner,
  onManageTags,
  onShare,
  onDuplicate,
  onPrint,
  onExport,
  onOpenDeleteConfirm,
  onArchive
}) => {
  const { t, tx } = useI18n();
  const [showConfirmCall, setShowConfirmCall] = useState(false);
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);

  const isArchived = contact.status === "archived";
  const isDoNotContact = contact.status === "do_not_contact" || contact.doNotContact;

  const handleActionClick = (e: React.MouseEvent, callback?: (c: Contact) => void) => {
    e.stopPropagation();
    onClose();
    if (callback) callback(contact);
  };

  return (
    <>
      <div className="contact-action-menu w-full bg-white rounded-2xl border border-slate-200 outline-none shadow-xl p-1.5 font-sans text-left space-y-0.5 max-h-[380px] overflow-y-auto crm-scroll-y">
      
      {/* 1. Primary CRM / Read actions */}
      <MenuItemButton 
        onClick={(e) => handleActionClick(e, () => onViewDetails && onViewDetails(contact.id))}
        icon={<Eye size={13} className="text-slate-500" />}
      >
        {tx("contactList.actions.viewDetail", "Xem chi tiết")}
      </MenuItemButton>

      {/* 2. Business Nurturing / Salesforce actions (Hidden/disabled if archived) */}
      {!isArchived && (
        <>
          {onOpenOpportunityWizard && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onOpenOpportunityWizard)}
              variant="primary"
              icon={<Plus size={13} />}
            >
              <span className="font-semibold">{tx("contactActions.createOpportunity", "Tạo cơ hội mới")}</span>
            </MenuItemButton>
          )}

          {/* Communications */}
          {onCall && (
            <MenuItemButton 
              onClick={(e) => {
                if (isDoNotContact) {
                  e.stopPropagation();
                  setShowConfirmCall(true);
                } else {
                  handleActionClick(e, onCall);
                }
              }}
              disabled={isDoNotContact && !contact.phone}
              icon={<Phone size={13} className="text-teal-600" />}
            >
              {tx("contactActions.call", "Gọi điện")} {isDoNotContact && "⚠️"}
            </MenuItemButton>
          )}

          {onEmail && (
            <MenuItemButton 
              onClick={(e) => {
                if (isDoNotContact) {
                  e.stopPropagation();
                  setShowConfirmEmail(true);
                } else {
                  handleActionClick(e, onEmail);
                }
              }}
              disabled={isDoNotContact && !contact.email}
              icon={<Mail size={13} className="text-amber-600" />}
            >
              {tx("contactActions.sendEmail", "Gửi Email")} {isDoNotContact && "⚠️"}
            </MenuItemButton>
          )}

          {onSms && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onSms)}
              disabled={isDoNotContact}
              icon={<MessageSquare size={13} className="text-indigo-600" />}
            >
              {tx("contactActions.sendSms", "Gửi SMS")}
            </MenuItemButton>
          )}

          {/* Task, Calendar, Memo */}
          {onCreateTask && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onCreateTask)}
              icon={<CheckSquare size={13} className="text-purple-600" />}
            >
              {tx("contactActions.createTask", "Giao việc")}
            </MenuItemButton>
          )}

          {onScheduleMeeting && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onScheduleMeeting)}
              icon={<Calendar size={13} className="text-cyan-600" />}
            >
              {tx("contactActions.scheduleMeeting", "Lên lịch hẹn")}
            </MenuItemButton>
          )}

          {onAddNote && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onAddNote)}
              icon={<FileText size={13} className="text-slate-600" />}
            >
              {tx("contactActions.addNote", "Thêm ghi chú")}
            </MenuItemButton>
          )}

          <div className="border-t border-slate-100 my-1" />

          {/* Auxiliary Operations */}
          {onSetAsPrimary && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onSetAsPrimary)}
              icon={<Eye size={13} className="text-orange-500" />}
            >
              {tx("contactActions.setPrimaryContact", "Đặt làm đại diện chính")}
            </MenuItemButton>
          )}

          {onChangeOwner && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onChangeOwner)}
              icon={<User size={13} className="text-slate-600" />}
            >
              {tx("contactActions.changeOwner", "Đổi người phụ trách")}
            </MenuItemButton>
          )}

          {onManageTags && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onManageTags)}
              icon={<Tag size={13} className="text-indigo-500" />}
            >
              {tx("contactActions.manageTags", "Quản lý nhãn thẻ")}
            </MenuItemButton>
          )}

          {onShare && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onShare)}
              icon={<Share2 size={13} className="text-slate-500" />}
            >
              {tx("contactActions.share", "Chia sẻ")}
            </MenuItemButton>
          )}

          {onDuplicate && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onDuplicate)}
              icon={<Copy size={13} className="text-slate-500" />}
            >
              {tx("contactActions.duplicate", "Quét trùng & Sao chép")}
            </MenuItemButton>
          )}

          {onPrint && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onPrint)}
              icon={<Printer size={13} className="text-slate-500" />}
            >
              {tx("contactActions.print", "In biểu mẫu")}
            </MenuItemButton>
          )}

          {onExport && (
            <MenuItemButton 
              onClick={(e) => handleActionClick(e, onExport)}
              icon={<Download size={13} className="text-slate-500" />}
            >
              {tx("contactActions.export", "Xuất Excel / PDF")}
            </MenuItemButton>
          )}
        </>
      )}

      {/* 3. Archival / Destructive actions */}
      <div className="border-t border-slate-100 my-1" />

      {onArchive && (
        <MenuItemButton 
          onClick={(e) => handleActionClick(e, onArchive)}
          icon={<Archive size={13} className="text-amber-500" />}
        >
          {isArchived ? tx("contactActions.unarchive", "Mở khóa lưu trữ liên hệ") : tx("contactActions.archive", "Đưa vào lưu trữ")}
        </MenuItemButton>
      )}

      {onOpenDeleteConfirm && (
        <MenuItemButton 
          variant="danger"
          onClick={(e) => handleActionClick(e, onOpenDeleteConfirm)}
          icon={<Archive size={13} />}
        >
          {tx("contactActions.delete", "Lưu trữ liên hệ")}
        </MenuItemButton>
      )}

    </div>

    {/* Custom Do Not Contact Call Warning Modal */}
    <Modal
      isOpen={showConfirmCall}
      onClose={() => setShowConfirmCall(false)}
      title={tx("contactActions.confirmCallDoNotContactTitle", "Yêu cầu chặn liên hệ")}
      size="sm"
    >
      <div className="space-y-4 text-slate-700 text-sm py-2 text-left font-sans">
        <p className="text-yellow-600 font-semibold leading-relaxed">
          ⚠️ {tx("contactActions.confirmCallDoNotContact", "Khách hàng đã yêu cầu chặn hoặc từ chối liên hệ. Bạn có chắc chắn muốn tiếp tục gọi?")}
        </p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 mt-4">
          <Button
            variant="outline"
            onClick={() => setShowConfirmCall(false)}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            className="bg-teal-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-teal-700 text-xs transition-all"
            onClick={(e) => {
              setShowConfirmCall(false);
              if (onCall) onCall(contact);
              onClose();
            }}
          >
            Vẫn gọi
          </Button>
        </div>
      </div>
    </Modal>

    {/* Custom Do Not Contact Email Warning Modal */}
    <Modal
      isOpen={showConfirmEmail}
      onClose={() => setShowConfirmEmail(false)}
      title={tx("contactActions.confirmEmailDoNotContactTitle", "Yêu cầu chặn liên hệ")}
      size="sm"
    >
      <div className="space-y-4 text-slate-700 text-sm py-2 text-left font-sans">
        <p className="text-yellow-600 font-semibold leading-relaxed">
          ⚠️ {tx("contactActions.confirmEmailDoNotContact", "Khách hàng đã yêu cầu chặn hoặc từ chối liên hệ. Bạn có chắc chắn muốn tiếp tục gửi email?")}
        </p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 mt-4">
          <Button
            variant="outline"
            onClick={() => setShowConfirmEmail(false)}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            className="bg-amber-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-amber-700 text-xs transition-all"
            onClick={(e) => {
              setShowConfirmEmail(false);
              if (onEmail) onEmail(contact);
              onClose();
            }}
          >
            Vẫn gửi
          </Button>
        </div>
      </div>
    </Modal>
  </>
);
};
