import { useState, useSyncExternalStore } from "react";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import type { ActivityType } from "@/modules/tasks";
import { Button, Modal, Select } from "@/shared/components/ui";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { getContactRelationshipAuthority, subscribeContactRelationshipAuthority } from "../model/contactRelationshipAuthority";
import { useContactHistory } from "../hooks/useContactHistory";
import { contactHistoryTypeLabel, contactHistoryTypes } from "../model/contactHistory";

export function ContactHistoryPanel(props: { contactId: string; locale: string }) {
  const authority = useSyncExternalStore(subscribeContactRelationshipAuthority, getContactRelationshipAuthority, getContactRelationshipAuthority);
  if (getAuthSessionSnapshot()?.status !== "ACTIVE") return <p role="status">{props.locale === "vi" ? "Bạn không có quyền đọc lịch sử." : "You cannot read this history."}</p>;
  return <ContactHistoryPanelBody key={`${authority}:${props.contactId}`} {...props}/>;
}
function ContactHistoryPanelBody({ contactId, locale }: { contactId: string; locale: string }) {
  const [type, setType] = useState<ActivityType>();
  const [selectedId, setSelectedId] = useState<string>();
  const history = useContactHistory(contactId, type);
  const config = useWorkspaceOperationalConfiguration();
  const vi = locale === "vi";
  const text = (a: string, b: string) => vi ? a : b;
  const messages = {
    ACCESS_DENIED: text("Bạn không có quyền đọc lịch sử.", "You cannot read this history."),
    UNAVAILABLE: text("Nguồn hoạt động chưa hỗ trợ phạm vi hoặc chính sách trường hiện tại.", "The activity source does not support the current scope or field policy."),
    LOADING: text("Đang tải lịch sử…", "Loading history…"),
    ERROR: text("Không thể tải lịch sử.", "Could not load history."),
    STALE: text("Lịch sử có thể chưa mới nhất. Thử lại để cập nhật.", "History may be out of date. Retry to refresh."),
    READY_EMPTY: text("Không có hoạt động trong phạm vi và bộ lọc này.", "No activities in this scope and filter."),
    READY_WITH_DATA: "",
  };
  const selected = history.items.find(item => item.id === selectedId);
  const timestamp = (value: string) => Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat(vi ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short", timeZone: config.localeRegion.timezone }).format(new Date(value))
    : text("Thời điểm chưa khả dụng", "Time unavailable");
  return <section data-guidance-id="contacts.relationship.history" aria-label={text("Lịch sử Contact", "Contact history")} className="space-y-3" aria-busy={history.query.loading}>
    <Select label={text("Loại hoạt động", "Activity type")} value={type ?? ""} onChange={event => {
      setSelectedId(undefined); setType(contactHistoryTypes.find(value => value === event.target.value));
    }}><option value="">{text("Tất cả hoạt động", "All activities")}</option>{contactHistoryTypes.map(value => <option key={value} value={value}>{contactHistoryTypeLabel(value, vi)}</option>)}</Select>
    {messages[history.state] && <p role="status" className="text-xs text-slate-600">{messages[history.state]}</p>}
    {(history.state === "ERROR" || history.state === "STALE") && <Button size="xs" onClick={() => void history.refresh()}>{text("Thử lại", "Retry")}</Button>}
    <ol className="space-y-2">{history.items.map(item => <li key={item.id} data-history-id={item.id}>
      <button type="button" className="w-full min-w-0 space-y-1 rounded-lg border border-slate-200 p-3 text-left text-xs [overflow-wrap:anywhere] hover:border-indigo-300 focus-visible:outline focus-visible:outline-indigo-600" onClick={() => setSelectedId(item.id)} aria-haspopup="dialog">
        <span className="block text-[10px] font-semibold text-indigo-600">{contactHistoryTypeLabel(item.type, vi)}</span>
        <span className="block font-semibold text-slate-800">{item.subject}</span>
        <time dateTime={item.occurredAt} className="block text-[10px] text-slate-500">{timestamp(item.occurredAt)}</time>
      </button>
    </li>)}</ol>
    {history.hasNextPage && <Button size="xs" disabled={history.query.loading || history.atLimit} onClick={() => void history.loadMore()}>{text("Tải thêm", "Load more")}</Button>}
    {history.atLimit && history.hasNextPage && <p role="status" className="text-xs">{text("Đã tải 500 hoạt động. Chọn loại để thu hẹp lịch sử.", "500 activities loaded. Choose a type to narrow history.")}</p>}
    <p className="text-[10px] text-slate-500">{text("Email/SMS là ghi nhận thủ công, không xác nhận gửi. Lịch sử chỉ gồm hoạt động gắn trực tiếp Contact; chưa có sự kiện hoàn thành/hủy Task.", "Email/SMS are manual logs, not delivery confirmation. Only activities directly linked to this Contact are included; Task completion/cancellation events are unavailable.")}</p>
    <Modal isOpen={Boolean(selected)} onClose={() => setSelectedId(undefined)} title={text("Chi tiết hoạt động", "Activity detail")} size="sm">
      {selected && <article className="space-y-3 text-sm [overflow-wrap:anywhere]"><h3 className="font-semibold">{selected.subject}</h3><time dateTime={selected.occurredAt}>{timestamp(selected.occurredAt)}</time><p>{text("Người ghi nhận", "Recorded by")}: {selected.actorId}</p><p className="whitespace-pre-wrap">{selected.body || text("Không có nội dung bổ sung.", "No additional content.")}</p></article>}
    </Modal>
  </section>;
}
