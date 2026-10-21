import { WorkSection, WorkTaskItem, WorkOwnerDisplay, workHeaderClass, workTitleClass, workBadgeClass, workHeadingClass, workEmptyClass, workNoticeClass } from "@/components/crm/relationship-panel/RelationshipWorkPresentation";
import { useI18n } from "@/i18n";
import { getContactStatusLabel } from "../list/contactList.helpers";
import { useState, useSyncExternalStore } from "react";
import { Calendar, ChevronDown, CheckSquare, FileText, Mail, MessageCircle, Phone, Sparkles } from "lucide-react";
import { CAPABILITIES, useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import type { Contact } from "../../domain/model/contact.types";
import type { Task } from "@/modules/tasks";
import { RelationshipWorkPanelShell, type RelationshipPanelMode } from "@/components/crm/relationship-panel/RelationshipWorkPanelShell";
import { RelationshipPanelActionBar } from "@/components/crm/relationship-panel/RelationshipPanelActionBar";
import { Button } from "@/shared/components/ui";
import type { useContactTasksQuery } from "../hooks/useContactTasksQuery";
import { getContactRelationshipAuthority, subscribeContactRelationshipAuthority } from "../model/contactRelationshipAuthority";
import { isContactActivitySourceReachable } from "../model/contactHistory";
import { ContactHistoryPanel } from "./ContactHistoryPanel";

interface Props {
  isVisible: boolean; contact: Contact; locale: string; ownerName: string;
  taskQuery: ReturnType<typeof useContactTasksQuery>; tasks: Task[];
  onCreateOpportunity?(): void;
  onOpenTask(id: string): void;
  onQuickAction(action: "call" | "email" | "sms" | "task" | "meeting" | "note"): void;
}
export function ContactRelationshipPanel(props: Props) {
  const authority = useSyncExternalStore(subscribeContactRelationshipAuthority, getContactRelationshipAuthority, getContactRelationshipAuthority);
  return <ContactRelationshipPanelBody key={`${authority}:${props.contact.id}`} {...props} />;
}
function ContactRelationshipPanelBody({ isVisible, contact, locale, ownerName, taskQuery, tasks, onCreateOpportunity, onOpenTask, onQuickAction }: Props) {
  const [mode, setMode] = useState<RelationshipPanelMode>("WORK");
  const [historyOpened, setHistoryOpened] = useState(false);
  const access = useEffectiveAccess();
  const { t } = useI18n();
  const recordAccess = useEffectiveRecordAccessDecision();
  const config = useWorkspaceOperationalConfiguration();
  const vi = locale === "vi"; const text = (a: string, b: string) => vi ? a : b;
  const denied = !access.can(CAPABILITIES.TASKS_READ) || taskQuery.error?.category === "AUTHORIZATION" || taskQuery.error?.category === "AUTHENTICATION";
  const ready = !denied && (!taskQuery.connected || (taskQuery.enabled && taskQuery.state === "READY" && !taskQuery.error && !taskQuery.loading && !taskQuery.stale));
  const open = ready ? tasks.filter(task => task.status === "OPEN" && !task.archivedAt).sort((a,b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.id.localeCompare(b.id)) : [];
  const overdue = open.filter(task => Date.parse(task.dueAt) < Date.now());
  const message = denied ? text("Bạn không có quyền đọc công việc.", "You cannot read tasks.") : taskQuery.loading ? text("Đang tải công việc…", "Loading tasks…") : taskQuery.stale ? text("Công việc có thể chưa mới nhất.", "Tasks may be out of date.") : taskQuery.error ? text("Không thể tải công việc.", "Could not load tasks.") : !ready ? text("Công việc chưa khả dụng.", "Tasks unavailable.") : "";
  const archived = contact.status === "archived";
  const restricted = contact.doNotContact || contact.status === "do_not_contact";
  const canCreate = access.can(CAPABILITIES.TASKS_CREATE);
  const canLog = access.can(CAPABILITIES.TASKS_UPDATE) && (!taskQuery.connected || isContactActivitySourceReachable(access));
  const actions = [
    { id: "call" as const, label: text("Ghi nhận cuộc gọi", "Log call"), icon: <Phone size={13}/>, disabled: !canLog || archived || restricted },
    { id: "email" as const, label: text("Ghi nhận Email ngoài CRM", "Log external Email"), icon: <Mail size={13}/>, disabled: !canLog || archived || restricted || !(contact.email || contact.workEmail) },
    { id: "task" as const, label: text("Thêm công việc", "Add task"), icon: <CheckSquare size={13}/>, disabled: !canCreate || archived },
    { id: "note" as const, label: text("Ghi chú nhanh", "Quick note"), icon: <FileText size={13}/>, disabled: !canLog },
    { id: "meeting" as const, label: text("Đặt lịch hẹn", "Schedule meeting"), icon: <Calendar size={13}/>, disabled: !canCreate || archived },
    { id: "sms" as const, label: text("Ghi nhận SMS ngoài CRM", "Log external SMS"), icon: <MessageCircle size={13}/>, disabled: !canLog || archived || restricted || !(contact.phone || contact.mobilePhone) },
  ].map(action => ({ ...action, disabledReason: text("Không khả dụng với quyền hoặc trạng thái liên hệ hiện tại.", "Unavailable with current access or contact status.") }));
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(vi ? "vi-VN" : "en-US", { dateStyle:"short", timeStyle:"short", timeZone:config.localeRegion.timezone }).format(new Date(value)) : text("Chưa có thời hạn", "Due time unavailable");
  const ownerHidden = recordAccess?.fieldAccess.ownerId === "HIDDEN" || access.getFieldAccess("contacts", "ownerId") === "HIDDEN";
  const ownerKnown = !ownerHidden && Boolean(contact.ownerId && ownerName && ownerName !== "—");
  const ownerLabel = ownerHidden ? text("Không có quyền xem người phụ trách", "Owner is restricted") : !contact.ownerId ? text("Chưa phân công", "Unassigned") : ownerKnown ? ownerName : text("Chưa xác định người phụ trách", "Owner identity unavailable");
  const contextRows = [
    [text("Chức danh", "Title"), contact.title || contact.roleTitle],
    [text("Trạng thái", "Status"), contact.status ? getContactStatusLabel(contact.status, t) : undefined],
  ].filter(row => row[1]);
  return <RelationshipWorkPanelShell isVisible={isVisible} motionKey="contact-relationship-panel" panelId="contact-relationship-panel" ariaLabel={text("Bảng quan hệ Contact", "Contact relationship panel")}
    header={<div className={workHeaderClass}><h2 className={workTitleClass}>{mode === "WORK" ? text("Công việc Contact", "Contact work") : text("Lịch sử Contact", "Contact history")}</h2>{ready && overdue.length > 0 && <span className={workBadgeClass}>{overdue.length}{taskQuery.hasNextPage ? "+" : ""}</span>}</div>}
    mode={{ value:mode, onChange:value => { setMode(value); if(value === "HISTORY") setHistoryOpened(true); }, workLabel:text("Công việc","Work"), historyLabel:text("Lịch sử","History"), label:text("Chế độ bảng quan hệ","Relationship panel mode") }}
    history={historyOpened ? <ContactHistoryPanel contactId={contact.id} locale={locale}/> : null}
    bodyClassName="space-y-3 overflow-y-auto pr-1 crm-scroll-y"
    footer={<RelationshipPanelActionBar label={text("Thao tác nhanh","Quick actions")} actions={[...actions, ...(onCreateOpportunity ? [{ id: "opportunity" as const, label: text("Tạo cơ hội", "Create opportunity"), icon: <Sparkles size={13}/>, disabled: archived }] : [])]} onAction={action => { if (action === "opportunity") { if (!archived) onCreateOpportunity?.(); } else if (!actions.find(item => item.id === action)?.disabled) onQuickAction(action); }}/>}
  >
    <div className="space-y-3 text-xs">
      <WorkSection first title={text("Cần xử lý","Needs attention")}>
        {message && <p role="status" className={workNoticeClass}>{message}</p>}
        {(taskQuery.error || taskQuery.stale) && !denied && <Button size="xs" onClick={() => void taskQuery.refresh()}>{text("Thử lại","Retry")}</Button>}
        {ready && <>
          {taskQuery.hasNextPage && <p role="status" className="text-slate-500">{text("Công việc trong các trang đã tải; chưa phải toàn bộ kết quả.","Tasks within loaded pages; not the complete result.")}</p>}
          {overdue.length > 0 ? <><p className="text-[11px] font-semibold text-amber-700">{overdue.length} {text("công việc quá hạn", "overdue tasks")}{taskQuery.hasNextPage ? "+" : ""}</p><ul>{overdue.slice(0,3).map(task => <li key={task.id}><WorkTaskItem title={task.title} metadata={<><time dateTime={task.dueAt}>{time(task.dueAt)}</time>{task.id === open[0]?.id && <> · {text("Cũng là việc tiếp theo", "Also next work")}</>}</>} onOpen={() => onOpenTask(task.id)}/></li>)}</ul></> : <p className={workEmptyClass}>{text("Không có công việc quá hạn trong phạm vi đã tải.","No overdue tasks in the loaded scope.")}</p>}
        </>}
      </WorkSection>
      <WorkSection title={text("Việc tiếp theo","Next work")}>
          {ready && (open[0] ? <WorkTaskItem variant="next" title={open[0].title} metadata={<time dateTime={open[0].dueAt}>{time(open[0].dueAt)}</time>} onOpen={() => onOpenTask(open[0].id)}/> : <p className={workEmptyClass}>{text("Chưa có công việc tiếp theo trong phạm vi đã tải.","No next task in the loaded scope.")}</p>)}
        </WorkSection>
        {ready && taskQuery.hasNextPage && <Button size="xs" disabled={taskQuery.loading || taskQuery.atLimit} onClick={() => void taskQuery.loadMore()}>{text("Tải thêm công việc","Load more tasks")}</Button>}
      <WorkSection title={text("Phụ trách","Owner")}><WorkOwnerDisplay label={ownerLabel} name={ownerKnown ? ownerName : undefined}/></WorkSection>
      <details className="group border-t border-slate-100 pt-2"><summary className={`${workHeadingClass} cursor-pointer justify-between rounded focus-visible:outline focus-visible:outline-indigo-600`}>{text("Ngữ cảnh nhanh","Quick context")}<ChevronDown size={13} aria-hidden="true" className="group-open:rotate-180"/></summary><dl className="space-y-2">{contextRows.length ? contextRows.map(([label,value]) => <div key={label} className="text-[11px]"><dt className="text-slate-400">{label}</dt><dd className="break-words font-medium text-slate-700 [overflow-wrap:anywhere]">{value}</dd></div>) : <p className={workEmptyClass}>{text("Chưa có ngữ cảnh bổ sung", "No additional context")}</p>}</dl></details>
    </div>
  </RelationshipWorkPanelShell>;
}
