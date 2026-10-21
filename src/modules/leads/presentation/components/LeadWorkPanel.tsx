import { WorkSection, WorkTaskItem, WorkOwnerDisplay, workHeaderClass, workTitleClass, workBadgeClass, workHeadingClass, workEmptyClass, workNoticeClass } from "@/components/crm/relationship-panel/RelationshipWorkPresentation";
import { LeadOwnerAssignAction } from "./LeadOwnerAssignAction";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { RelationshipWorkPanelShell, type RelationshipPanelMode } from "@/components/crm/relationship-panel/RelationshipWorkPanelShell";
import { getLeadRelationshipAuthority, subscribeLeadRelationshipAuthority } from "../model/leadRelationshipAuthority";
import { LeadHistoryPanel } from "./LeadHistoryPanel";
import { Calendar, CheckSquare, ChevronDown, FileText, Mail, MessageCircle, MoreHorizontal, Phone } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { RelationshipPanelActionBar } from "@/components/crm/relationship-panel/RelationshipPanelActionBar";
import { ActionDropdown } from "@/components/crm/ActionDropdown";
import type { Task } from "@/modules/tasks";
import type { Lead } from "../../domain/model/lead.types";
import type { useLeadDetailWorkResources } from "../hooks/useLeadDetailWorkResources";

export type LeadQuickAction = "call" | "task" | "meeting" | "email" | "sms" | "note";

interface LeadWorkPanelProps {
  lead: Lead;
  locale: string;
  isVisible: boolean;
  workResources: ReturnType<typeof useLeadDetailWorkResources>;
  ownerName: string;
  sourceName?: string;
  campaignName?: string;
  canHandover: boolean;
  canQualify: boolean;
  onAssigned?: (leadId: string) => void;
  onHandover(): void;
  onQualify(): void;
  onOpenWork(): void;
  onOpenTask(task: Task): void;
  onQuickAction(action: LeadQuickAction): void;
  history?: ReactNode;
  allowedQuickActions?: readonly LeadQuickAction[];
  quickActionPending?: boolean;
}

export function LeadWorkPanel(props: LeadWorkPanelProps) {
  const authority = useSyncExternalStore(subscribeLeadRelationshipAuthority, getLeadRelationshipAuthority, getLeadRelationshipAuthority);
  return <LeadRelationshipPanelBody key={`${authority}:${props.lead.id}`} {...props} />;
}

function LeadRelationshipPanelBody({ lead, locale, isVisible, workResources, ownerName, sourceName, campaignName,
  canHandover, canQualify, onAssigned, onHandover, onQualify, onOpenWork, onOpenTask, onQuickAction, history, allowedQuickActions, quickActionPending }: LeadWorkPanelProps) {
  const [mode, setMode] = useState<RelationshipPanelMode>("WORK");
  const [historyOpened, setHistoryOpened] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const { taskQuery, overdueTasks, nextTask } = workResources;
  const hasData = taskQuery.data !== undefined;
  const followUpOverdue = Boolean(lead.nextFollowUpAt && Date.parse(lead.nextFollowUpAt) < Date.now());
  const owner = !lead.ownerId ? text("Chưa phân công", "Unassigned") : ownerName && ownerName !== "—" ? ownerName : text("Chưa xác định", "Unknown");
  const dateLabel = (value: string) => new Date(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });
  const contextRows = [
    [text("Sản phẩm quan tâm", "Products of interest"), lead.interestedProducts.map((product) => product.productNameSnapshot).join(", ")],
    [text("Nguồn", "Source"), sourceName || lead.source],
    [text("Chiến dịch", "Campaign"), campaignName],
    [text("Nhu cầu", "Need"), lead.painPoint],
  ].filter((row) => row[1]);
  const attentionCount = (hasData ? overdueTasks.length : 0) + Number(followUpOverdue);
  const allowed = (action: LeadQuickAction) => !quickActionPending && (allowedQuickActions?.includes(action) ?? true);

  return (
    <RelationshipWorkPanelShell
      isVisible={isVisible}
      motionKey="lead-work-panel"
      panelId="right-work-panel"
      ariaLabel={text("Công việc Lead", "Lead work")}
      bodyClassName="space-y-3 overflow-y-auto pr-1 crm-scroll-y"
      mode={{ value: mode, onChange: value => { setMode(value); if (value === "HISTORY") setHistoryOpened(true); }, workLabel: text("Công việc", "Work"), historyLabel: text("Lịch sử", "History"), label: text("Chế độ bảng quan hệ", "Relationship panel mode") }}
      history={history ?? (historyOpened ? <LeadHistoryPanel leadId={lead.id} locale={locale} /> : null)}
      header={(
        <div className={workHeaderClass}>
          <h2 className={workTitleClass}>{mode === "WORK" ? text("Công việc Lead", "Lead work") : text("Lịch sử Lead", "Lead history")}</h2>
          {attentionCount > 0 && <span className={workBadgeClass}>{attentionCount}</span>}
        </div>
      )}
      footer={(
        <div ref={railRef} className="shrink-0">
          {allowedQuickActions && (quickActionPending || allowedQuickActions.length < 6) && <p role="status" className="mb-1 text-[10px] text-slate-500">{quickActionPending ? text("Đang xử lý thao tác…", "Action in progress…") : text("Một số thao tác chưa khả dụng theo quyền hoặc trạng thái hiện tại.", "Some actions are unavailable for the current access or status.")}</p>}
          <RelationshipPanelActionBar<LeadQuickAction | "more">
            label={text("Thao tác nhanh", "Quick actions")}
            actions={[
              { id: "call", disabled: !allowed("call"), label: text("Ghi nhận cuộc gọi", "Log call"), icon: <Phone size={12} className="text-emerald-600" /> },
              { id: "email", disabled: !allowed("email"), label: text("Ghi nhận Email ngoài CRM", "Log external Email"), icon: <Mail size={12} className="text-indigo-600" /> },
              { id: "task", disabled: !allowed("task"), label: text("Thêm công việc", "Add task"), icon: <CheckSquare size={12} className="text-amber-600" /> },
              { id: "note", disabled: !allowed("note"), label: text("Ghi chú nhanh", "Quick note"), icon: <FileText size={12} className="text-slate-600" /> },
              { id: "more", label: text("Thao tác khác", "More actions"), icon: <MoreHorizontal size={12} /> },
            ]}
            onAction={(action) => { if (action === "more") setMenuAnchor(railRef.current?.querySelector<HTMLButtonElement>("button:last-child") ?? null); else onQuickAction(action); }}
          />
          <ActionDropdown isOpen={Boolean(menuAnchor?.isConnected) && isVisible} anchorRef={menuAnchor} onClose={() => setMenuAnchor(null)} width={240} sections={[
            { id: "work", title: text("Liên hệ & công việc", "Contact & work"), items: [
              { id: "meeting", disabled: !allowed("meeting"), label: text("Đặt lịch hẹn", "Schedule meeting"), icon: <Calendar size={13} />, onClick: () => onQuickAction("meeting") },
              { id: "sms", disabled: !allowed("sms"), label: text("Ghi nhận SMS ngoài CRM", "Log external SMS"), icon: <MessageCircle size={13} />, onClick: () => onQuickAction("sms") },
              ...(lead.leadWorkState === "VERIFYING" && canQualify ? [{ id: "qualify", label: text("Chốt kết quả", "Resolve outcome"), onClick: onQualify }] : []),
            ] },
          ]} />
        </div>
      )}
    >
      <WorkSection first title={text("Cần xử lý", "Needs attention")}>
        {taskQuery.error && (
          <div role="status" className={workNoticeClass}>
            <p>{hasData ? text("Dữ liệu có thể chưa mới nhất", "Data may be out of date") : text("Không thể tải công việc", "Could not load tasks")}</p>
            <Button size="xs" variant="ghost" onClick={() => void taskQuery.refresh()}>{text("Thử lại", "Retry")}</Button>
          </div>
        )}
        {!hasData && !taskQuery.error && <p role="status" className={`${workEmptyClass} animate-pulse`}>{text("Đang tải công việc…", "Loading tasks…")}</p>}
        {hasData && overdueTasks.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-amber-700">{overdueTasks.length} {text("công việc quá hạn", "overdue tasks")}</p>
            {overdueTasks.slice(0, 2).map((task) => (
              <WorkTaskItem key={task.id} title={task.title} metadata={<>{dateLabel(task.dueAt)}{task.id === nextTask?.id && <> · {text("Cũng là việc tiếp theo", "Also next work")}</>}</>} onOpen={onOpenWork} />
            ))}
            {overdueTasks.length > 2 && <button type="button" onClick={onOpenWork} className="text-[11px] font-semibold text-indigo-600 hover:underline">{text("Xem tất cả", "View all")}</button>}
          </div>
        )}
        {followUpOverdue && <p className="py-1 text-[11px] text-amber-700">{text("Quá hạn liên hệ lại", "Follow-up overdue")} · {dateLabel(lead.nextFollowUpAt || "")}</p>}
        {hasData && !taskQuery.error && attentionCount === 0 && <p className={workEmptyClass}>{text("Không có việc quá hạn", "No overdue work")}</p>}
      </WorkSection>
      <WorkSection title={text("Việc tiếp theo", "Next work")}>
        {hasData && (nextTask ? (
          <WorkTaskItem variant="next" title={nextTask.title} onOpen={() => onOpenTask(nextTask)} description={nextTask.description}
            metadata={<>{dateLabel(nextTask.dueAt)} · {text("Ưu tiên", "Priority")}: {nextTask.priority === "URGENT" ? text("Khẩn cấp", "Urgent") : nextTask.priority === "HIGH" ? text("Cao", "High") : nextTask.priority === "LOW" ? text("Thấp", "Low") : text("Bình thường", "Normal")}</>}>
            <Button size="xs" onClick={() => onOpenTask(nextTask)}>{text("Mở công việc", "Open task")}</Button>
          </WorkTaskItem>
        ) : (
          <div className="space-y-2"><p className={workEmptyClass}>{text("Chưa có công việc tiếp theo", "No next task yet")}</p><Button size="xs" disabled={!allowed("task")} onClick={() => onQuickAction("task")}>{text("+ Tạo công việc", "+ Create task")}</Button></div>
        ))}
      </WorkSection>
      <WorkSection title={text("Phụ trách", "Owner")}>
        <WorkOwnerDisplay label={owner} name={lead.ownerId && ownerName && ownerName !== "—" ? ownerName : undefined} actions={<><LeadOwnerAssignAction lead={lead} onAssigned={onAssigned}/>{canHandover && <Button size="xs" onClick={onHandover}>{text("Bàn giao", "Handover")}</Button>}</>}/>
      </WorkSection>
      <section className="border-t border-slate-100 pt-2">
        <button type="button" aria-expanded={contextOpen} onClick={() => setContextOpen((open) => !open)} className={`${workHeadingClass} w-full justify-between`}>
          {text("Ngữ cảnh nhanh", "Quick context")}<ChevronDown size={13} className={contextOpen ? "rotate-180" : ""} />
        </button>
        {contextOpen && <dl className="space-y-2">{contextRows.length ? contextRows.map(([label, value]) => <div key={label} className="text-[11px]"><dt className="text-slate-400">{label}</dt><dd className="break-words font-medium text-slate-700 [overflow-wrap:anywhere]" title={value}>{value}</dd></div>) : <p className={workEmptyClass}>{text("Chưa có ngữ cảnh bổ sung", "No additional context")}</p>}</dl>}
      </section>
    </RelationshipWorkPanelShell>
  );
}
