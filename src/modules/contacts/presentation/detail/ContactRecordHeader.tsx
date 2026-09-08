import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Edit3,
  Sparkles,
  MoreHorizontal,
  MessageSquare,
  Paperclip,
  FileText,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  Bookmark,
  Share2,
  Copy,
  Printer,
  Download,
  Archive,
  ShieldAlert,
  Tags,
  CheckSquare,
  Clock
} from "lucide-react";
import { Contact } from "../../domain/model/contact.types";
import { useI18n } from "@/i18n";
import { getContactStatusBadgeStyle, getContactStatusTranslation } from "./contactDetail.helpers";
import { formatPhone } from "@/shared/lib/format/phone";
import { Modal, Button, Badge, IconButton, MenuItemButton, MenuSection, MenuDivider, RowActionPortal } from "@/shared/components/ui";
import { findCustomerForContact, getCustomerDisplayNameForContact } from "../model/contactCustomerLookup";
import { getCustomersSnapshot, subscribeToCustomers } from "@/modules/customers";
import { useSubscribableSnapshot } from "@/platform/react";

interface ContactRecordHeaderProps {
  contact: Contact;
  ownerName: string;
  canUpdateContact: boolean;
  canArchiveContact: boolean;
  onEditClick: () => void;
  onCreateOpportunityClick?: () => void;
  onAddNoteClick: () => void;
  onUploadAttachmentClick: () => void;
  onCreateQuoteClick: () => void;
  onAddAppointmentClick: () => void;
  onAddTaskClick: () => void;
  onDeleteClick: () => void;
  showToast: (msg: string) => void;
  isRightPanelVisible?: boolean;
  onToggleRightPanel?: () => void;
}

export const ContactRecordHeader: React.FC<ContactRecordHeaderProps> = ({
  contact,
  ownerName,
  canUpdateContact,
  canArchiveContact,
  onEditClick,
  onCreateOpportunityClick,
  onAddNoteClick,
  onUploadAttachmentClick,
  onCreateQuoteClick,
  onAddAppointmentClick,
  onAddTaskClick,
  onDeleteClick,
  showToast,
  isRightPanelVisible = true,
  onToggleRightPanel
}) => {
  const { tx } = useI18n();
  const navigate = useNavigate();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [moreAnchorEl, setMoreAnchorEl] = useState<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Communication confirmation modal states (Avoids iframe window.confirm blockages)
  const [confirmCommType, setConfirmCommType] = useState<"call" | "email" | "sms" | null>(null);
  const [commValue, setCommValue] = useState("");

  useSubscribableSnapshot(getCustomersSnapshot, subscribeToCustomers);
  const linkedCustomer = findCustomerForContact(contact);
  const isDoNotContact = contact.status === "do_not_contact" || contact.doNotContact;
  const isArchived = contact.status === "archived";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getRelationshipLevelBadgeStyle = (level?: string) => {
    switch (level?.toLowerCase()) {
      case "cold": return "bg-slate-50 text-slate-600 border-slate-200";
      case "warm": return "bg-orange-50 text-orange-700 border-orange-200";
      case "good": return "bg-teal-50 text-teal-700 border-teal-200";
      case "strong": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "vip": return "bg-purple-50 text-purple-700 border-purple-200";
      default: return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const getDecisionRoleBadgeStyle = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "decision_maker": return "bg-violet-50 text-violet-700 border-violet-200";
      case "influencer": return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "user": return "bg-slate-100 text-slate-700 border-slate-200";
      case "buyer": return "bg-pink-50 text-pink-700 border-pink-200";
      case "technical": return "bg-amber-50 text-amber-700 border-amber-200";
      case "finance": return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default: return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const executeCommunication = (type: "call" | "email" | "sms", value?: string) => {
    if (!value) {
      showToast(tx(`contactDetail.toast.${type}Missing`, `${type === "email" ? "Email" : "Số điện thoại"} của liên hệ chưa được bổ sung.`));
      return;
    }

    if (isDoNotContact) {
      setConfirmCommType(type);
      setCommValue(value);
    } else {
      processCommunication(type, value);
    }
  };

  const processCommunication = (type: "call" | "email" | "sms", value: string) => {
    if (type === "call") {
      showToast(tx("contactDetail.toast.callStarted", `Đang kết nối cuộc gọi tới ${value}...`, { phone: value }));
    } else if (type === "email") {
      showToast(tx("contactDetail.toast.emailStarted", `Đang chuyển hướng soạn thảo thư tới ${value}...`, { email: value }));
    } else if (type === "sms") {
      showToast(tx("contactDetail.toast.smsSent", `Đã kích hoạt soạn tin nhắn SMS tới số ${value}.`, { phone: value }));
    }
    setConfirmCommType(null);
  };

  const initials = (contact.fullName || contact.name || "U")
    .split(" ")
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast(tx("contactDetail.toast.shared", "Đã sao chép liên kết hồ sơ vào khay nhớ tạm."));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${contact.fullName || contact.name} - ${contact.phone || ""} - ${contact.email || ""}`);
    showToast(tx("contactDetail.toast.copied", "Đã sao chép thông tin liên hệ nhanh."));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm text-left">
      {/* Warnings Area if applicable - simplified (Requirement 6) */}
      {(isArchived || isDoNotContact) && (
        <div className="flex flex-wrap gap-2">
          {isArchived && (
            <div className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1 text-[10px] font-extrabold text-zinc-700 border border-zinc-200 uppercase/9">
              <ShieldAlert size={12} className="text-zinc-600 shrink-0" />
              <span>{tx("contactDetail.header.archivedWarningShort", "Hồ sơ đã lưu trữ")}</span>
            </div>
          )}

          {isDoNotContact && (
            <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1 text-[10px] font-extrabold text-rose-700 border border-rose-200 uppercase/9">
              <AlertTriangle size={12} className="text-rose-600 shrink-0 select-none" />
              <span>{tx("contactDetail.header.doNotContactWarningShort", "Không nên liên hệ trực tiếp")}</span>
              {contact.doNotContactReason && (
                <span className="font-semibold text-slate-500 normal-case">({contact.doNotContactReason})</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Row: Profile & Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left segment: Identity card */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <IconButton
              id="back-btn"
              onClick={() => navigate("/contacts")}
              variant="secondary"
              size="sm"
              title={tx("contactDetail.actions.backToContacts", "Quay lại")}
            >
              <ArrowLeft size={14} />
            </IconButton>

            <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={`w-12 h-12 rounded-xl border font-extrabold text-base flex items-center justify-center shrink-0 uppercase shadow-inner ${
              contact.avatarColor || "bg-indigo-50 text-indigo-700 border-indigo-200"
            }`}>
              {initials}
            </div>
            
            <div className="space-y-1 text-left min-w-0 flex-1">
              {/* Name and Basic badges */}
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 className="text-sm font-black text-slate-800 tracking-tight sm:text-lg">
                  {contact.fullName || contact.name}
                </h2>
                <Badge variant={getContactStatusBadgeStyle(contact.status)} className="uppercase text-[9px] font-extrabold py-0.5 tracking-wider px-2">
                  {getContactStatusTranslation(contact.status || "active", (key) => tx(key, key))}
                </Badge>
                {contact.isPrimaryContact && (
                  <Badge variant="warning" className="text-[9px] py-0.5 font-bold uppercase">
                    {tx("contactDetail.fields.primary", "Liên hệ chính")}
                  </Badge>
                )}
                {linkedCustomer && (
                  <Badge variant="success" className="text-[9px] py-0.5 font-bold">
                    Đã là khách hàng
                  </Badge>
                )}
              </div>
              
              <div className="text-[10px] sm:text-xs text-slate-500 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold text-slate-700">{contact.title || tx("contactDetail.fields.noTitle", "Chức vụ N/A")}</span>
                {(contact.companyName || getCustomerDisplayNameForContact(contact)) ? (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600 font-semibold">{contact.companyName || getCustomerDisplayNameForContact(contact)}</span>
                  </>
                ) : null}
                {(contact.mobilePhone || contact.phone) && (
                  <>
                    <span className="text-slate-300">•</span>
                    <a href={`tel:${contact.mobilePhone || contact.phone}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-semibold">
                      <Phone size={11} /> {formatPhone(contact.mobilePhone || contact.phone)}
                    </a>
                  </>
                )}
                {(contact.workEmail || contact.email || contact.personalEmail) && (
                  <>
                    <span className="text-slate-300">•</span>
                    <a href={`mailto:${contact.workEmail || contact.email || contact.personalEmail}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-semibold">
                      <Mail size={11} /> {contact.workEmail || contact.email || contact.personalEmail}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Right action segment */}
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 shrink-0 max-w-full" ref={menuRef}>
          {/* Edit button */}
          {canUpdateContact && <IconButton
            id="edit-direct-btn"
            onClick={onEditClick}
            variant="secondary"
            size="sm"
            title={tx("common.edit", "Sửa")}
          >
            <Edit3 size={14} />
          </IconButton>}

          {/* Right Panel Toggle Button (mobile/tablet only) */}
          {onToggleRightPanel && (
            <IconButton
              id="mobile-panel-toggle"
              onClick={onToggleRightPanel}
              variant="secondary"
              size="sm"
              className="lg:hidden"
              title={isRightPanelVisible ? tx("contactDetail.panel.hide", "Ẩn lịch sử tương tác") : tx("contactDetail.panel.show", "Lịch sử hoạt động")}
            >
              <Clock size={14} />
            </IconButton>
          )}

          {linkedCustomer && (
            <Button
              id="open-customer-360-btn"
              onClick={() => navigate(`/customers/${linkedCustomer.id}`)}
              variant="secondary"
              size="sm"
            >
              Mở Customer 360
            </Button>
          )}

          {/* Primary CTA button: Sinh cơ hội */}
          {onCreateOpportunityClick && <Button
            id="create-opp-btn"
            disabled={isArchived}
            onClick={onCreateOpportunityClick}
            variant="primary"
            size="sm"
            icon={<Sparkles size={11} />}
          >
            {tx("contactDetail.actions.createOpportunityShort", "Sinh cơ hội")}
          </Button>}

          {/* More actions dropdown using MenuSection/MenuItemButton/MenuDivider matching LeadDetailPage closely */}
          <IconButton
            id="header-more-actions-btn"
            onClick={(e) => {
              e.stopPropagation();
              const target = e.currentTarget as HTMLElement;
              if (isMoreMenuOpen) {
                setIsMoreMenuOpen(false);
                setMoreAnchorEl(null);
              } else {
                setIsMoreMenuOpen(true);
                setMoreAnchorEl(target);
              }
            }}
            variant="secondary"
            size="sm"
            title={tx("contactDetail.actions.moreTitle", "Thao tác khác")}
            className="border border-slate-200 h-9 w-9 flex items-center justify-center p-0 rounded-xl animate-fade-in"
          >
            <MoreHorizontal size={14} />
          </IconButton>

          <RowActionPortal
            open={isMoreMenuOpen}
            anchorEl={moreAnchorEl}
            onClose={() => {
              setIsMoreMenuOpen(false);
              setMoreAnchorEl(null);
            }}
            width={240}
          >
            <div className="w-full max-h-[calc(100vh-96px)] overflow-y-auto crm-scroll-y rounded-xl border border-slate-200 bg-white p-1.5 text-left text-xs shadow-2xl space-y-0.5 font-sans animate-fade-in block">
                  
              {/* GROUP A: Workflow / Business actions */}
              <MenuSection title={tx("contactDetail.section.businessActions", "Nghiệp vụ")} />
              {/* GROUP B: Management actions */}
              {canUpdateContact && <MenuSection title={tx("contactDetail.section.adminActions", "Quản trị & Quan hệ")} />}
              {canArchiveContact && <>
              <MenuItemButton
                onClick={() => {
                  showToast(tx("contactDetail.toast.setPrimaryContact", "Đã thiết lập liên hệ này làm đầu mối trao đổi chính."));
                  setIsMoreMenuOpen(false);
                  setMoreAnchorEl(null);
                }}
                icon={<Bookmark size={14} />}
              >
                <span>{tx("contactDetail.actions.setPrimary", "Đặt làm liên hệ chính")}</span>
              </MenuItemButton>
              <MenuItemButton
                onClick={() => {
                  showToast(tx("contactDetail.toast.changeOwnerPrompt", "Hệ thống chuyển nhượng tài khoản người bán."));
                  setIsMoreMenuOpen(false);
                  setMoreAnchorEl(null);
                }}
                icon={<ArrowLeft size={14} className="rotate-180" />}
              >
                <span>{tx("contactDetail.actions.changeOwner", "Chuyển giao phụ trách")}</span>
              </MenuItemButton>
              <MenuItemButton
                onClick={() => {
                  showToast(tx("contactDetail.toast.manageTagsPrompt", "Hệ thống hiển thị bảng gán nhãn tags phân loại liên hệ."));
                  setIsMoreMenuOpen(false);
                  setMoreAnchorEl(null);
                }}
                icon={<Tags size={14} />}
              >
                <span>{tx("contactDetail.actions.manageTags", "Quản lý nhãn (Tags)")}</span>
              </MenuItemButton>
              </>}
              <MenuItemButton
                onClick={() => { handleShare(); setIsMoreMenuOpen(false); setMoreAnchorEl(null); }}
                icon={<Share2 size={14} />}
              >
                <span>{tx("contactDetail.actions.share", "Chia sẻ hồ sơ")}</span>
              </MenuItemButton>

              <MenuDivider />

              {/* GROUP C: Record output */}
              <MenuSection title={tx("contactDetail.actions.recordGroup", "Báo cáo & Kết xuất")} />
              <MenuItemButton
                onClick={() => { window.print(); setIsMoreMenuOpen(false); setMoreAnchorEl(null); }}
                icon={<Printer size={14} />}
              >
                <span>{tx("contactDetail.actions.print", "In hồ sơ lý lịch")}</span>
              </MenuItemButton>
              <MenuItemButton
                onClick={() => {
                  showToast(tx("contactDetail.toast.exportStarted", "Đang kết xuất báo cáo Excel cho dòng thông tin liên hệ..."));
                  setIsMoreMenuOpen(false);
                  setMoreAnchorEl(null);
                }}
                icon={<Download size={14} />}
              >
                <span>{tx("contactDetail.actions.export", "Xuất file Excel cá nhân")}</span>
              </MenuItemButton>

              {canUpdateContact && <>
              <MenuDivider />

              {/* GROUP D: Safety & Danger */}
              <MenuSection title={tx("contactDetail.actions.lifecycle", "Hành động an toàn")} />
              {canArchiveContact && !isArchived && <MenuItemButton
                onClick={() => { onDeleteClick(); setIsMoreMenuOpen(false); setMoreAnchorEl(null); }}
                icon={<Archive size={14} className="text-amber-500" />}
              >
                <span className="text-amber-700">{tx("contactDetail.actions.archive", "Lưu trữ hồ sơ")}</span>
              </MenuItemButton>}
              </>}

            </div>
          </RowActionPortal>
        </div>
      </div>

      {/* REACTIVE CONFIRM OUTBOUND CALL/EMAIL MODAL (Bypasses standard alert constraints) */}
      <Modal
        isOpen={confirmCommType !== null}
        onClose={() => setConfirmCommType(null)}
        title={tx("contactDetail.confirm.title", "Xác nhận liên hệ outbound")}
        size="sm"
      >
        <div className="space-y-4 text-xs text-slate-700 text-left">
          <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-3 text-rose-700 border border-rose-100 font-semibold leading-relaxed">
            <AlertTriangle size={16} className="shrink-0 text-rose-500 mt-0.5" />
            <div>
              <p className="font-bold uppercase text-[10px] tracking-wide mb-1">
                {tx("contactDetail.confirm.doNotContactWarning", "Cảnh báo danh mục hạn chế")}
              </p>
              <p>
                {confirmCommType === "call" && tx("contactDetail.confirm.call", "Bạn có chắc chắn muốn gọi cho liên hệ này không? Số máy này nằm trong danh sách không liên hệ.")}
                {confirmCommType === "email" && tx("contactDetail.confirm.email", "Bạn có chắc chắn muốn gửi email cho liên hệ này không? Địa chỉ mail này nằm trong danh sách không liên hệ.")}
                {confirmCommType === "sms" && tx("contactDetail.confirm.sms", "Bạn có chắc chắn muốn thực hiện gửi tin nhắn SMS?")}
              </p>
              {contact.doNotContactReason && (
                <p className="mt-1 text-slate-500 font-semibold">[Ý kiến chặn: {contact.doNotContactReason}]</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" onClick={() => setConfirmCommType(null)}>
              {tx("common.cancel", "Hủy bỏ")}
            </Button>
            <Button variant="danger" onClick={() => confirmCommType && processCommunication(confirmCommType, commValue)}>
              {tx("common.confirm", "Vẫn tiếp tục")}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
