import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Clock,
  Filter,
  Phone,
  CheckSquare,
  Calendar,
  Mail,
  MessageCircle,
  PhoneCall,
  FileText,
  Layers,
  Sparkles,
  MessageSquare
} from "lucide-react";
import { Contact } from "../../domain/model/contact.types";
import { useI18n } from "@/i18n";
import { IconButton, Button, FilterChip, Modal } from "@/shared/components/ui";
import { RelationshipPanelActionBar, type RelationshipPanelAction } from "@/components/crm/relationship-panel/RelationshipPanelActionBar";
import { formatPhone } from "@/shared/lib/format/phone";

interface ContactInsightPanelProps {
  contact: Contact;
  tasks: Array<{
    id: string;
    title: string;
    dueDate?: string;
    status: "pending" | "in_progress" | "completed";
    priority: string;
  }>;
  onAddTask: () => void;
  onAddAppointment: () => void;
  onAddNote: () => void;
  onCreateOpportunity?: () => void;
  onCompleteTask: (id: string) => void;
  onLogCall?: () => void;
  onSendEmail?: () => void;
  onSendSms?: () => void;
  onAddMeeting?: () => void;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    date: string;
    createdAt?: string;
    author?: string;
  }>;
  showToast: (msg: string) => void;
}

export const ContactInsightPanel: React.FC<ContactInsightPanelProps> = ({
  contact,
  tasks,
  onAddTask,
  onAddAppointment,
  onAddNote,
  onCreateOpportunity,
  onCompleteTask,
  onLogCall,
  onSendEmail,
  onSendSms,
  onAddMeeting,
  recentActivities,
  showToast
}) => {
  const { tx } = useI18n();
  const reduceMotion = useReducedMotion();
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<string>("all");
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);

  const isArchived = contact.status === "archived";
  const isDoNotContact = contact.status === "do_not_contact" || contact.doNotContact;

  // Filter based on selected chip filter
  const filteredActivities = recentActivities.filter(act => {
    if (timelineFilter === "all") return true;
    return act.type?.toLowerCase() === timelineFilter.toLowerCase();
  });


  type ContactPanelAction = "call" | "task" | "meeting" | "email" | "sms" | "note" | "opportunity";

  const runQuickAction = (actionId: ContactPanelAction) => {
    if (isArchived && actionId !== "note") {
      showToast(tx("contactDetail.toast.archivedActionBlocked", "Hồ sơ đã lưu trữ, không thể thực hiện tác vụ này!"));
      return;
    }
    if ((actionId === "call" || actionId === "email" || actionId === "sms") && isDoNotContact) {
      showToast(tx("contactDetail.toast.directOutreachRestricted", "Liên hệ này đang bật hạn chế liên hệ trực tiếp."));
      return;
    }
    if (actionId === "call") {
      onLogCall ? onLogCall() : onAddAppointment();
      return;
    }
    if (actionId === "task") { onAddTask(); return; }
    if (actionId === "meeting") { onAddMeeting ? onAddMeeting() : onAddAppointment(); return; }
    if (actionId === "email") {
      if (!contact.email && !contact.workEmail) {
        showToast(tx("contactDetail.toast.emailMissing", "Chưa cung cấp Email!"));
      } else if (onSendEmail) {
        onSendEmail();
      } else {
        showToast(tx("contactDetail.toast.emailComposerOpened", "Mở khung soạn thư gửi tới {{email}}...").replace("{{email}}", contact.email || contact.workEmail || ""));
      }
      return;
    }
    if (actionId === "sms") {
      if (!contact.phone && !contact.mobilePhone) {
        showToast(tx("contactDetail.toast.phoneMissing", "Chưa cung cấp Số truyền thông!"));
      } else if (onSendSms) {
        onSendSms();
      } else {
        showToast(tx("contactDetail.toast.smsComposerOpened", "Đang thiết lập kênh SMS di động tới {{phone}}...").replace("{{phone}}", formatPhone(contact.phone || contact.mobilePhone || "")));
      }
      return;
    }
    if (actionId === "opportunity") { onCreateOpportunity?.(); return; }
    onAddNote();
  };

  const getActTypeConfig = (type: string) => {
    switch (type?.toLowerCase()) {
      case "call":
        return { icon: <Phone size={13} className="text-emerald-600" />, label: tx("contactDetail.activityPanel.filters.call", "Cuộc gọi"), color: "bg-emerald-50 text-emerald-700 border-emerald-100" };
      case "task":
        return { icon: <CheckSquare size={13} className="text-amber-600" />, label: tx("contactDetail.activityPanel.filters.task", "Công việc"), color: "bg-amber-50 text-amber-700 border-amber-100" };
      case "meeting":
        return { icon: <Calendar size={13} className="text-rose-600" />, label: tx("contactDetail.activityPanel.filters.meeting", "Lịch hẹn"), color: "bg-rose-50 text-rose-700 border-rose-100" };
      case "email":
        return { icon: <Mail size={13} className="text-indigo-600" />, label: "Email", color: "bg-indigo-50 text-indigo-700 border-indigo-100" };
      case "sms":
        return { icon: <MessageCircle size={13} className="text-blue-600" />, label: "SMS", color: "bg-blue-50 text-blue-700 border-blue-100" };
      case "note":
        return { icon: <FileText size={13} className="text-slate-600" />, label: tx("contactDetail.activityPanel.filters.note", "Ghi chú"), color: "bg-slate-50 text-slate-700 border-slate-100" };
      case "opportunity":
        return { icon: <Sparkles size={13} className="text-purple-600" />, label: tx("contactDetail.activityPanel.filters.opportunity", "Cơ hội"), color: "bg-purple-50 text-purple-700 border-purple-100" };
      case "quote":
        return { icon: <FileText size={13} className="text-pink-600" />, label: tx("contactDetail.activityPanel.filters.quote", "Báo giá"), color: "bg-pink-50 text-pink-700 border-pink-100" };
      case "customer":
        return { icon: <Layers size={13} className="text-teal-600" />, label: tx("contactDetail.activityPanel.filters.customer", "Khách hàng"), color: "bg-teal-50 text-teal-700 border-teal-100" };
      default:
        return { icon: <Layers size={13} className="text-indigo-600" />, label: tx("contactDetail.activityPanel.filters.system", "Hệ thống"), color: "bg-slate-50 text-slate-600 border-slate-100" };
    }
  };

  return (
    <div
      id="contact-right-work-panel"
      className="flex h-full min-h-0 w-full flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm select-none lg:w-[350px]"
    >
      {/* 1. TOP TITLE AREA: LINE WITH FILTER AND RESET */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Clock size={13} className="text-slate-400 mt-0.5 shrink-0" />
          <h4 className="text-xs font-black uppercase tracking-wide">
            {tx("contactDetail.activityPanel.title", "Lịch sử tương tác")}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            onClick={() => setIsFilterExpanded(prev => !prev)}
            variant={isFilterExpanded ? "primary" : "secondary"}
            size="sm"
            title={tx("contactDetail.activityPanel.filterTitle", "Bộ lọc hoạt động")}
            aria-label={tx("contactDetail.activityPanel.filterTitle", "Bộ lọc hoạt động")}
          >
            <Filter size={12} />
          </IconButton>
          <Button
            onClick={() => {
              setTimelineFilter("all");
              showToast(tx("contactDetail.toast.activityFilterReset", "Đã khôi phục bộ lọc tương tác mặc định."));
            }}
            variant="ghost"
            size="sm"
            className="text-[10px]"
          >
            {tx("contactDetail.activityPanel.reset", "Reset")}
          </Button>
        </div>
      </div>

      {/* 2. EXPANDABLE CHIPS */}
      <AnimatePresence initial={false}>
        {isFilterExpanded ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 p-2"
        >
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
            {tx("contactDetail.activityPanel.filterPool", "BỘ LỌC TƯƠNG TÁC DẢI RỘNG")}
          </span>
          <div className="flex gap-1 overflow-x-auto crm-scroll-x flex-wrap">
            {[
              { id: "all", label: tx("contactDetail.activityPanel.filters.all", "Tất cả") },
              { id: "call", label: tx("contactDetail.activityPanel.filters.call", "Gọi") },
              { id: "email", label: "Email" },
              { id: "sms", label: "SMS" },
              { id: "task", label: tx("contactDetail.activityPanel.filters.task", "Việc") },
              { id: "meeting", label: tx("contactDetail.activityPanel.filters.meeting", "Hẹn") },
              { id: "note", label: "Note" },
              { id: "system", label: tx("contactDetail.activityPanel.filters.system", "Hệ thống") }
            ].map(chip => (
              <FilterChip
                key={chip.id}
                label={chip.label}
                active={timelineFilter === chip.id}
                onClick={() => setTimelineFilter(chip.id)}
              />
            ))}
          </div>
        </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 3. SHARED RELATIONSHIP ACTION RAIL */}
      <RelationshipPanelActionBar
        label={tx("contactDetail.activityPanel.quick.label", "Tác vụ nhanh")}
        actions={[
          { id: "call", label: tx("contactDetail.activityPanel.quick.call", "Ghi cuộc gọi"), icon: <Phone size={12} className="text-emerald-600" />, disabled: isArchived || isDoNotContact, disabledReason: isArchived ? tx("contactDetail.toast.archivedActionBlocked", "Hồ sơ đã lưu trữ.") : tx("contactDetail.toast.directOutreachRestricted", "Liên hệ đang hạn chế liên hệ trực tiếp.") },
          { id: "task", label: tx("contactDetail.activityPanel.quick.task", "Thêm việc"), icon: <CheckSquare size={12} className="text-amber-600" />, disabled: isArchived, disabledReason: tx("contactDetail.toast.archivedActionBlocked", "Hồ sơ đã lưu trữ.") },
          { id: "meeting", label: tx("contactDetail.activityPanel.quick.meeting", "Thêm lịch hẹn"), icon: <Calendar size={12} className="text-rose-600" />, disabled: isArchived, disabledReason: tx("contactDetail.toast.archivedActionBlocked", "Hồ sơ đã lưu trữ.") },
          { id: "email", label: tx("contactDetail.activityPanel.quick.email", "Gửi Email"), icon: <Mail size={12} className="text-indigo-600" />, disabled: isArchived || isDoNotContact, disabledReason: isArchived ? tx("contactDetail.toast.archivedActionBlocked", "Hồ sơ đã lưu trữ.") : tx("contactDetail.toast.directOutreachRestricted", "Liên hệ đang hạn chế liên hệ trực tiếp.") },
          { id: "sms", label: tx("contactDetail.activityPanel.quick.sms", "Gửi SMS"), icon: <MessageCircle size={12} className="text-blue-600" />, disabled: isArchived || isDoNotContact, disabledReason: isArchived ? tx("contactDetail.toast.archivedActionBlocked", "Hồ sơ đã lưu trữ.") : tx("contactDetail.toast.directOutreachRestricted", "Liên hệ đang hạn chế liên hệ trực tiếp.") },
          { id: "note", label: tx("contactDetail.activityPanel.quick.note", "Ghi chú nhanh"), icon: <FileText size={12} className="text-slate-600" /> },
          ...(onCreateOpportunity ? [{ id: "opportunity" as const, label: tx("contactDetail.activityPanel.quick.opportunity", "Tạo cơ hội"), icon: <Sparkles size={12} className="text-purple-600" />, disabled: isArchived, disabledReason: tx("contactDetail.toast.archivedActionBlocked", "Hồ sơ đã lưu trữ.") }] : []),
        ] satisfies readonly RelationshipPanelAction<ContactPanelAction>[]}
        onAction={runQuickAction}
      />

      {/* 4. CONTENT SCROLL CONTAINER - REAL CHRONOLOGICAL CRM ACTIVITY CARDS */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 crm-scroll-y" id="activities-panel-scroll">
        <div className="space-y-2 text-left">
          <AnimatePresence mode="popLayout" initial={false}>
          {filteredActivities.map(act => {
            const config = getActTypeConfig(act.type);

            return (
              <motion.div
                layout
                key={act.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => setSelectedActivity(act)}
                className="cursor-pointer space-y-2 rounded-xl border border-slate-200/70 bg-white p-3 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg ${config.color} border shrink-0`}>
                      {config.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-[11px] crm-text-wrap leading-tight">
                        {act.title}
                      </p>
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>{config.label}</span>
                        <span>•</span>
                        <span className="crm-text-wrap">{act.author || "CRM User"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] font-semibold text-slate-400 block">{act.date}</span>
                  </div>
                </div>

                {act.description && (
                  <p className="text-[11px] text-slate-500 font-medium leading-normal crm-text-wrap">
                    {act.description}
                  </p>
                )}
              </motion.div>
            );
          })}
          </AnimatePresence>

          {filteredActivities.length === 0 && (
            <p className="text-center text-slate-400 py-8 text-[10px] font-semibold italic">
              {tx("contactDetail.activityPanel.empty", "Chưa thu nhận tương tác tương ứng.")}
            </p>
          )}
        </div>
      </div>

      {/* ACTIVITY DETAIL DIALOG / MODAL */}
      {selectedActivity && (
        <Modal
          isOpen={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
          title={tx("contactDetail.activityPanel.detailTitle", "Lịch sử hoạt động chi tiết")}
          size="sm"
        >
          <div className="space-y-4 text-left text-xs font-sans">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <div className="p-2 bg-slate-50 rounded-lg shrink-0">
                <Clock size={14} className="text-slate-500" />
              </div>
              <div>
                <h4 className="break-words font-bold text-slate-800 text-xs tracking-tight [overflow-wrap:anywhere]">{selectedActivity.title}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {selectedActivity.date} {selectedActivity.author ? `• by ${selectedActivity.author}` : ""}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[60px] text-slate-600 leading-relaxed font-semibold">
              {selectedActivity.description}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedActivity(null)}>
                {tx("contactDetail.activityPanel.close", "Đóng")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
