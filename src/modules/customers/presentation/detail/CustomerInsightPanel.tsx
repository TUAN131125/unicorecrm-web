import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BriefcaseBusiness,
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  Filter,
  HeartHandshake,
  Mail,
  MessageCircle,
  Package,
  Phone,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Button, FilterChip, IconButton, Modal } from "@/shared/components/ui";
import { RelationshipPanelActionBar, type RelationshipPanelAction } from "@/components/crm/relationship-panel/RelationshipPanelActionBar";
import { useI18n } from "@/i18n";
import type { Customer360ReadModel, CustomerTimelineItem } from "../model/customer360ReadModel";
import { presentCustomerTimelineItem } from "../model/customerTimelinePresentation";

interface CustomerInsightPanelProps {
  model: Customer360ReadModel;
  onLogCall(): void;
  onCreateTask(): void;
  onAddMeeting(): void;
  onSendEmail(): void;
  onSendSms(): void;
  onCreateOpportunity(): void;
  onAddNote(): void;
  onCreateQuote(): void;
  onCreateOrder(): void;
  onCreateCare(): void;
  showToast(message: string): void;
}

type PrimaryAction = "call" | "task" | "meeting" | "email" | "sms" | "note" | "opportunity";
type CommercialAction = "quote" | "order" | "care";

export const CustomerInsightPanel: React.FC<CustomerInsightPanelProps> = ({
  model,
  onLogCall,
  onCreateTask,
  onAddMeeting,
  onSendEmail,
  onSendSms,
  onCreateOpportunity,
  onAddNote,
  onCreateQuote,
  onCreateOrder,
  onCreateCare,
  showToast,
}) => {
  const { tx, locale } = useI18n();
  const isVi = locale === "vi";
  const reduceMotion = useReducedMotion();
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [selectedActivity, setSelectedActivity] = useState<CustomerTimelineItem | null>(null);

  const sourceContact = model.identity.contact ?? model.identity.primaryContact;
  const isArchived = model.customer.status === "ARCHIVED";
  const isDoNotContact = model.customer.status === "DO_NOT_CONTACT"
    || sourceContact?.doNotContact
    || sourceContact?.status === "do_not_contact";

  const activities = useMemo(() => model.timeline.map((item) => ({
    item,
    type: timelineType(item.kind, item.activityType),
  })), [model.timeline]);

  const filteredActivities = activities.filter(({ type }) => timelineFilter === "all" || type === timelineFilter);

  const runPrimaryAction = (action: PrimaryAction) => {
    if (isArchived && action !== "note") {
      showToast(isVi ? "Hồ sơ đã lưu trữ, không thể thực hiện tác vụ này." : "Archived records cannot run this action.");
      return;
    }
    if (["call", "email", "sms"].includes(action) && isDoNotContact) {
      showToast(isVi ? "Customer đang bật hạn chế liên hệ trực tiếp." : "This Customer restricts direct outreach.");
      return;
    }
    if (action === "email" && !model.identity.email) {
      showToast(isVi ? "Chưa cung cấp email." : "No email is available.");
      return;
    }
    if ((action === "call" || action === "sms") && !model.identity.phone) {
      showToast(isVi ? "Chưa cung cấp số điện thoại." : "No phone number is available.");
      return;
    }

    const handlers: Record<PrimaryAction, () => void> = {
      call: onLogCall,
      task: onCreateTask,
      meeting: onAddMeeting,
      email: onSendEmail,
      sms: onSendSms,
      opportunity: onCreateOpportunity,
      note: onAddNote,
    };
    handlers[action]();
  };

  return (
    <div
      id="customer-right-work-panel"
      className="relative flex h-full min-h-[560px] max-h-none w-full shrink-0 select-none flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-[0_14px_38px_rgba(15,23,42,0.08)] 2xl:h-full 2xl:min-h-0 2xl:w-[350px]"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Clock size={13} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-xs font-black uppercase tracking-wide">
              {isVi ? "Flow tương tác" : "Interaction flow"}
            </h4>
            <p className="mt-0.5 text-[9px] font-semibold text-slate-400">
              {filteredActivities.length} {isVi ? "sự kiện đang hiển thị" : "visible events"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {timelineFilter !== "all" && (
            <Button
              onClick={() => {
                setTimelineFilter("all");
                setIsFilterExpanded(false);
                showToast(isVi ? "Đã khôi phục bộ lọc tương tác mặc định." : "Activity filters reset.");
              }}
              variant="ghost"
              size="sm"
              className="text-[10px]"
            >
              {tx("contactDetail.activityPanel.reset", "Reset")}
            </Button>
          )}
          <IconButton
            onClick={() => setIsFilterExpanded((current) => !current)}
            variant={isFilterExpanded || timelineFilter !== "all" ? "primary" : "secondary"}
            size="sm"
            title={tx("contactDetail.activityPanel.filterTitle", "Bộ lọc hoạt động")}
            aria-label={tx("contactDetail.activityPanel.filterTitle", "Bộ lọc hoạt động")}
            aria-expanded={isFilterExpanded}
          >
            <Filter size={12} />
          </IconButton>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isFilterExpanded ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-4 right-4 top-[62px] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
          >
            <div className="space-y-2">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {tx("contactDetail.activityPanel.filterPool", "BỘ LỌC TƯƠNG TÁC")}
              </span>
              <div className="grid grid-cols-4 gap-1 [&>button]:w-full [&>button]:min-w-0 [&>button]:justify-center [&>button]:px-1">
                {[
                  { id: "all", label: tx("contactDetail.activityPanel.filters.all", "Tất cả") },
                  { id: "call", label: tx("contactDetail.activityPanel.filters.call", "Gọi") },
                  { id: "email", label: "Email" },
                  { id: "sms", label: "SMS" },
                  { id: "task", label: tx("contactDetail.activityPanel.filters.task", "Việc") },
                  { id: "meeting", label: tx("contactDetail.activityPanel.filters.meeting", "Hẹn") },
                  { id: "note", label: isVi ? "Ghi chú" : "Note" },
                  { id: "opportunity", label: isVi ? "Cơ hội" : "Opportunity" },
                  { id: "system", label: tx("contactDetail.activityPanel.filters.system", "Hệ thống") },
                ].map((chip) => (
                  <FilterChip
                    key={chip.id}
                    label={chip.label}
                    active={timelineFilter === chip.id}
                    onClick={() => {
                      setTimelineFilter(chip.id);
                      setIsFilterExpanded(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <RelationshipPanelActionBar
        label={isVi ? "Tác vụ nhanh" : "Quick actions"}
        actions={[
          { id: "call", label: isVi ? "Ghi cuộc gọi" : "Log call", icon: <Phone size={12} className="text-emerald-600" />, disabled: isArchived || isDoNotContact, disabledReason: isArchived ? (isVi ? "Hồ sơ đã lưu trữ." : "The record is archived.") : (isVi ? "Khách hàng đang hạn chế liên hệ trực tiếp." : "The customer restricts direct outreach.") },
          { id: "task", label: isVi ? "Thêm việc" : "Add task", icon: <CheckSquare size={12} className="text-amber-600" />, disabled: isArchived, disabledReason: isVi ? "Hồ sơ đã lưu trữ." : "The record is archived." },
          { id: "meeting", label: isVi ? "Thêm lịch hẹn" : "Add meeting", icon: <Calendar size={12} className="text-rose-600" />, disabled: isArchived, disabledReason: isVi ? "Hồ sơ đã lưu trữ." : "The record is archived." },
          { id: "email", label: isVi ? "Gửi Email" : "Send email", icon: <Mail size={12} className="text-indigo-600" />, disabled: isArchived || isDoNotContact, disabledReason: isArchived ? (isVi ? "Hồ sơ đã lưu trữ." : "The record is archived.") : (isVi ? "Khách hàng đang hạn chế liên hệ trực tiếp." : "The customer restricts direct outreach.") },
          { id: "sms", label: isVi ? "Gửi SMS" : "Send SMS", icon: <MessageCircle size={12} className="text-blue-600" />, disabled: isArchived || isDoNotContact, disabledReason: isArchived ? (isVi ? "Hồ sơ đã lưu trữ." : "The record is archived.") : (isVi ? "Khách hàng đang hạn chế liên hệ trực tiếp." : "The customer restricts direct outreach.") },
          { id: "note", label: isVi ? "Ghi chú nhanh" : "Quick note", icon: <FileText size={12} className="text-slate-600" /> },
          { id: "opportunity", label: isVi ? "Tạo cơ hội" : "Create opportunity", icon: <Sparkles size={12} className="text-purple-600" />, disabled: isArchived, disabledReason: isVi ? "Hồ sơ đã lưu trữ." : "The record is archived." },
        ] satisfies readonly RelationshipPanelAction<PrimaryAction>[]}
        onAction={runPrimaryAction}
      />

      <RelationshipPanelActionBar
        label={isVi ? "Nghiệp vụ khách hàng" : "Customer operations"}
        actions={[
          { id: "quote", label: isVi ? "Tạo báo giá" : "Create quote", icon: <FileText size={12} className="text-pink-600" />, disabled: isArchived, disabledReason: isVi ? "Hồ sơ đã lưu trữ." : "The record is archived." },
          { id: "order", label: isVi ? "Tạo đơn hàng" : "Create order", icon: <ShoppingBag size={12} className="text-emerald-600" />, disabled: isArchived, disabledReason: isVi ? "Hồ sơ đã lưu trữ." : "The record is archived." },
          { id: "care", label: isVi ? "Tạo phiếu hỗ trợ" : "Create support ticket", icon: <HeartHandshake size={12} className="text-rose-600" />, disabled: isArchived, disabledReason: isVi ? "Hồ sơ đã lưu trữ." : "The record is archived." },
        ] satisfies readonly RelationshipPanelAction<CommercialAction>[]}
        onAction={(actionId) => ({ quote: onCreateQuote, order: onCreateOrder, care: onCreateCare })[actionId]()}
      />

      <div className="flex-1 overflow-y-auto pr-1 crm-scroll-y space-y-2 min-h-[300px]" id="customer-activities-panel-scroll">
        <div className="space-y-2 text-left">
          <AnimatePresence mode="popLayout" initial={false}>
          {filteredActivities.map(({ item, type }) => {
            const config = activityConfig(type, isVi);
            const display = presentCustomerTimelineItem(item, isVi);
            return (
              <motion.button
                layout
                type="button"
                key={item.id}
                initial={reduceMotion ? false : { opacity: 0, y: 7, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 10, scale: 0.985 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => setSelectedActivity(item)}
                className="w-full space-y-2 rounded-xl border border-slate-200/70 bg-white p-3 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-indigo-200 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg ${config.color} border shrink-0`}>{config.icon}</div>
                    <div className="min-w-0">
                      <p className="crm-text-wrap break-words text-[11px] font-bold leading-tight text-slate-800 [overflow-wrap:anywhere]" title={display.title}>{display.title}</p>
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>{config.label}</span><span>•</span><span className="crm-text-wrap">Customer 360</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] font-semibold text-slate-400 block">{formatTimelineDate(item.occurredAt, isVi)}</span>
                  </div>
                </div>
                {display.detail && <p className="crm-text-wrap break-words text-[11px] font-medium leading-normal text-slate-500 [overflow-wrap:anywhere]" title={display.detail}>{display.detail}</p>}
              </motion.button>
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

      {selectedActivity && (
        <Modal isOpen onClose={() => setSelectedActivity(null)} title={tx("contactDetail.activityPanel.detailTitle", "Lịch sử hoạt động chi tiết")} size="sm">
          <div className="space-y-4 text-left text-xs font-sans">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <div className="p-2 bg-slate-50 rounded-lg shrink-0"><Clock size={14} className="text-slate-500" /></div>
              <div>
                <h4 className="break-words font-bold text-slate-800 text-xs tracking-tight [overflow-wrap:anywhere]">{presentCustomerTimelineItem(selectedActivity, isVi).title}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">{new Date(selectedActivity.occurredAt).toLocaleString(isVi ? "vi-VN" : "en-US")}</p>
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[60px] text-slate-600 leading-relaxed font-semibold">{presentCustomerTimelineItem(selectedActivity, isVi).detail || "—"}</div>
            <div className="flex justify-end pt-2"><Button variant="secondary" onClick={() => setSelectedActivity(null)}>{tx("contactDetail.activityPanel.close", "Đóng")}</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
};

function timelineType(kind: CustomerTimelineItem["kind"], activityType?: string): string {
  const normalized = activityType?.toLowerCase();
  if (normalized === "call") return "call";
  if (normalized === "email") return "email";
  if (normalized === "message" || normalized === "sms") return "sms";
  if (normalized === "meeting") return "meeting";
  if (normalized === "note") return "note";
  if (kind === "TASK") return "task";
  if (kind === "NOTE") return "note";
  if (kind === "DEAL") return "opportunity";
  if (kind === "ACTIVITY") return "system";
  return "system";
}

function activityConfig(type: string, isVi: boolean): { label: string; color: string; icon: React.ReactNode } {
  switch (type) {
    case "call": return { label: isVi ? "Cuộc gọi" : "Call", color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: <Phone size={13} className="text-emerald-600" /> };
    case "task": return { label: isVi ? "Công việc" : "Task", color: "bg-amber-50 text-amber-700 border-amber-100", icon: <CheckSquare size={13} className="text-amber-600" /> };
    case "meeting": return { label: isVi ? "Lịch hẹn" : "Meeting", color: "bg-rose-50 text-rose-700 border-rose-100", icon: <Calendar size={13} className="text-rose-600" /> };
    case "email": return { label: "Email", color: "bg-indigo-50 text-indigo-700 border-indigo-100", icon: <Mail size={13} className="text-indigo-600" /> };
    case "sms": return { label: "SMS", color: "bg-blue-50 text-blue-700 border-blue-100", icon: <MessageCircle size={13} className="text-blue-600" /> };
    case "note": return { label: isVi ? "Ghi chú" : "Note", color: "bg-slate-50 text-slate-700 border-slate-100", icon: <FileText size={13} className="text-slate-600" /> };
    case "opportunity": return { label: isVi ? "Cơ hội" : "Opportunity", color: "bg-purple-50 text-purple-700 border-purple-100", icon: <BriefcaseBusiness size={13} className="text-purple-600" /> };
    default: return { label: isVi ? "Hệ thống" : "System", color: "bg-slate-50 text-slate-600 border-slate-100", icon: <Package size={13} className="text-indigo-600" /> };
  }
}

function formatTimelineDate(value: string, isVi: boolean): string {
  return new Date(value).toLocaleDateString(isVi ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit" });
}
