import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  Filter,
  Layers,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import type { CRMActivity } from "@/shared/domain";
import type { Lead } from "../../domain/model/lead.types";
import { Button, FilterChip, IconButton, Modal } from "@/shared/components/ui";
import { RelationshipPanelActionBar, type RelationshipPanelAction } from "@/components/crm/relationship-panel/RelationshipPanelActionBar";
import { formatPhone } from "@/shared/lib/format/phone";
import type { useI18n } from "@/i18n";

export type LeadTimelineFilter = "all" | "call" | "email" | "sms" | "zalo" | "task" | "meeting" | "note" | "system";
export type LeadQuickAction = "call" | "task" | "meeting" | "email" | "sms" | "note";

type Translate = ReturnType<typeof useI18n>["t"];

interface LeadDetailActivityPanelProps {
  lead: Lead;
  locale: string;
  t: Translate;
  lt: (viText: string, enText: string) => string;
  isVisible: boolean;
  isFilterExpanded: boolean;
  setIsFilterExpanded: Dispatch<SetStateAction<boolean>>;
  timelineFilter: LeadTimelineFilter;
  setTimelineFilter: Dispatch<SetStateAction<LeadTimelineFilter>>;
  selectedActivity: CRMActivity | null;
  setSelectedActivity: Dispatch<SetStateAction<CRMActivity | null>>;
  onQuickAction: (action: LeadQuickAction) => void;
  showToast: (message: string) => void;
}

export function LeadDetailActivityPanel({
  lead,
  locale,
  t,
  lt,
  isVisible,
  isFilterExpanded,
  setIsFilterExpanded,
  timelineFilter,
  setTimelineFilter,
  selectedActivity,
  setSelectedActivity,
  onQuickAction,
  showToast,
}: LeadDetailActivityPanelProps) {
  const reduceMotion = useReducedMotion();
  const filteredActivities = lead.activities.filter(
    (activity) => timelineFilter === "all" || activity.type === timelineFilter,
  );

  return (
    <>
      <AnimatePresence initial={false} mode="popLayout">
      {isVisible ? (
        <motion.aside
          layout="position"
          key="lead-activity-panel"
          initial={reduceMotion ? false : { opacity: 0, x: 30, scale: 0.985, filter: "blur(3px)" }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 22, scale: 0.99, filter: "blur(2px)" }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 34, mass: 0.78 }}
          className="relative z-10 w-full min-w-0 lg:sticky lg:top-4 lg:h-[calc(100vh-140px)] lg:w-[350px] lg:shrink-0"
        >
        <div id="right-work-panel" className="flex h-full min-h-0 w-full flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm select-none lg:w-[350px]">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Clock size={13} className="text-slate-400 mt-0.5 shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wide">{lt("Lịch sử hoạt động", "Activity History")}</h4>
            </div>
            <div className="flex items-center gap-2">
              <IconButton
                onClick={() => setIsFilterExpanded((current) => !current)}
                variant={isFilterExpanded ? "primary" : "secondary"}
                size="sm"
                title={lt("Bộ lọc hoạt động", "Activity Filters")}
                aria-label={lt("Bộ lọc hoạt động", "Activity Filters")}
              >
                <Filter size={12} />
              </IconButton>
              <Button
                onClick={() => {
                  setTimelineFilter("all");
                  showToast(lt("Đã khôi phục bộ lọc tương tác mặc định.", "Restored default activity filter."));
                }}
                variant="ghost"
                size="sm"
                className="text-[10px]"
              >
                Reset
              </Button>
            </div>
          </div>

          <AnimatePresence initial={false}>
          {isFilterExpanded ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 p-2"
            >
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{lt("Bộ lọc tương tác dải rộng", "Interaction filter pool")}</span>
              <div className="flex gap-1 overflow-x-auto crm-scroll-x flex-wrap">
                {[
                  { id: "all", label: lt("Tất cả", "All") },
                  { id: "call", label: lt("Gọi", "Call") },
                  { id: "email", label: "Email" },
                  { id: "sms", label: "SMS" },
                  { id: "task", label: lt("Việc", "Task") },
                  { id: "meeting", label: lt("Hẹn", "Meet") },
                  { id: "note", label: "Note" },
                  { id: "system", label: lt("Hệ thống", "System") },
                ].map((chip) => (
                  <FilterChip
                    key={chip.id}
                    label={chip.label}
                    active={timelineFilter === chip.id}
                    onClick={() => setTimelineFilter(chip.id as LeadTimelineFilter)}
                  />
                ))}
              </div>
            </motion.div>
          ) : null}
          </AnimatePresence>

          <RelationshipPanelActionBar
            label={lt("Tác vụ nhanh", "Quick actions")}
            actions={[
              { id: "call", label: lt("Ghi cuộc gọi", "Log call"), icon: <Phone size={12} className="text-emerald-600" /> },
              { id: "task", label: lt("Thêm việc", "Add task"), icon: <CheckSquare size={12} className="text-amber-600" /> },
              { id: "meeting", label: lt("Thêm lịch hẹn", "Add meeting"), icon: <Calendar size={12} className="text-rose-600" /> },
              { id: "email", label: lt("Ghi nhận Email", "Log email"), icon: <Mail size={12} className="text-indigo-600" /> },
              { id: "sms", label: lt("Ghi nhận SMS", "Log SMS"), icon: <MessageCircle size={12} className="text-blue-600" /> },
              { id: "note", label: lt("Ghi chú nhanh", "Quick note"), icon: <FileText size={12} className="text-slate-600" /> },
            ] satisfies readonly RelationshipPanelAction<LeadQuickAction>[]}
            onAction={onQuickAction}
          />

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 crm-scroll-y">
            <div className="space-y-2.5 text-left">
              <AnimatePresence mode="popLayout" initial={false}>
              {filteredActivities.map((activity) => {
                  let cleanDescription = activity.description || "";
                  let activityStatus = "";
                  if (activity.description?.startsWith("Trạng thái: ")) {
                    const parts = activity.description.split(" | ");
                    activityStatus = parts[0].replace("Trạng thái: ", "");
                    cleanDescription = parts.slice(1).join(" | ");
                  }

                  const config = getActivityTypeConfig(activity.type, locale);

                  return (
                    <motion.div
                      layout
                      key={activity.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      onClick={() => setSelectedActivity(activity)}
                      className="cursor-pointer space-y-2 rounded-xl border border-slate-200/70 bg-white p-3 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-lg ${config.color} border shrink-0`}>
                            {config.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-[11px] crm-text-wrap leading-tight">{activity.title}</p>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              <span>{config.label}</span>
                              <span>•</span>
                              <span className="crm-text-wrap">{activity.author || "CRM Staff"}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold block shrink-0">{activity.createdAt}</span>
                      </div>

                      {cleanDescription && (
                        <p className="text-[11px] text-slate-500 font-medium leading-normal crm-text-wrap">{cleanDescription}</p>
                      )}

                      {activityStatus && (
                        <div className="flex items-center justify-end">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                            activityStatus.includes("Hoàn thành") || activityStatus.includes("Đã gửi")
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-amber-50 text-amber-700 border-amber-100"
                          }`}>
                            {activityStatus}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredActivities.length === 0 && (
                <p className="text-center text-slate-400 py-6 text-[10px] font-semibold italic">Chưa thu nhận tương tác nào tương ứng.</p>
              )}
            </div>
          </div>

          {selectedActivity && (
            <Modal
              isOpen
              onClose={() => setSelectedActivity(null)}
              title="Lịch sử hoạt động chi tiết"
              size="sm"
            >
              <div className="space-y-4 text-left text-xs font-sans">
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                  <div className="p-2 bg-slate-50 rounded-lg shrink-0">
                    <Clock size={14} className="text-slate-500" />
                  </div>
                  <div>
                    <h4 className="break-words font-bold text-slate-800 text-xs tracking-tight [overflow-wrap:anywhere]">{selectedActivity.title}</h4>
                    <p className="text-[10px] text-slate-400 font-bold">Thời gian: {selectedActivity.createdAt} | Tạo bởi: {selectedActivity.author}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Nội dung chi tiết</span>
                    <p className="font-semibold text-slate-600 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-line text-xs mt-1">
                      {selectedActivity.description || "Không có nội dung mô tả bổ sung."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <div>
                      <span className="block mb-0.5">Phân loại liên lạc</span>
                      <span className="text-slate-700 font-extrabold">{selectedActivity.type.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="block mb-0.5">Định danh sự kiện</span>
                      <span className="text-slate-600 font-mono text-[9px]">{selectedActivity.id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <Button onClick={() => setSelectedActivity(null)} variant="secondary" size="xs">Đóng</Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
        </motion.aside>
      ) : null}
      </AnimatePresence>

    </>
  );
}

function getActivityTypeConfig(type: string, locale: string) {
  switch (type) {
    case "call": return { icon: <Phone size={13} className="text-emerald-600" />, label: locale === "vi" ? "Cuộc gọi" : "Call", color: "bg-emerald-50 text-emerald-700 border-emerald-100" };
    case "task": return { icon: <CheckSquare size={13} className="text-amber-600" />, label: locale === "vi" ? "Công việc" : "Task", color: "bg-amber-50 text-amber-700 border-amber-100" };
    case "meeting": return { icon: <Calendar size={13} className="text-rose-600" />, label: locale === "vi" ? "Lịch hẹn" : "Meeting", color: "bg-rose-50 text-rose-700 border-rose-100" };
    case "email": return { icon: <Mail size={13} className="text-indigo-600" />, label: "Email", color: "bg-indigo-50 text-indigo-700 border-indigo-100" };
    case "sms": return { icon: <MessageCircle size={13} className="text-blue-600" />, label: "SMS", color: "bg-blue-50 text-blue-700 border-blue-100" };
    case "note": return { icon: <FileText size={13} className="text-slate-600" />, label: locale === "vi" ? "Ghi chú" : "Note", color: "bg-slate-50 text-slate-700 border-slate-100" };
    default: return { icon: <Layers size={13} className="text-indigo-600" />, label: locale === "vi" ? "Hệ thống" : "System", color: "bg-slate-50 text-slate-600 border-slate-100" };
  }
}
