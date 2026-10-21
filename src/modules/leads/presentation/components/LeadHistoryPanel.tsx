import { useState } from "react";
import type { ActivityType } from "@/modules/tasks";
import { Button, Select } from "@/shared/components/ui";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { useLeadHistory } from "../hooks/useLeadHistory";
import { leadHistoryTypeLabel, leadHistoryTypes } from "../model/leadHistory";

export function LeadHistoryPanel({ leadId, locale }: { leadId: string; locale: string }) {
  const [type, setType] = useState<ActivityType | undefined>();
  const history = useLeadHistory(leadId, type);
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
  return <section data-guidance-id="leads.relationship.history" aria-label={text("Lịch sử Lead", "Lead history")} className="space-y-3" aria-busy={history.query.loading}>
    <Select label={text("Loại hoạt động", "Activity type")} value={type ?? ""} onChange={event => {
      const next = leadHistoryTypes.find(value => value === event.target.value); setType(next);
    }}><option value="">{text("Tất cả hoạt động", "All activities")}</option>{leadHistoryTypes.map(value => <option key={value} value={value}>{leadHistoryTypeLabel(value, vi)}</option>)}</Select>
    {messages[history.state] && <p role="status" className="text-xs text-slate-600">{messages[history.state]}</p>}
    {(history.state === "ERROR" || history.state === "STALE") && <Button size="xs" onClick={() => void history.refresh()}>{text("Thử lại", "Retry")}</Button>}
    <ol className="space-y-3">
      {history.items.map(item => <li key={item.id} data-history-source="tasks.activity" data-history-id={item.id} className="min-w-0 rounded-lg border border-slate-100 p-3 text-xs [overflow-wrap:anywhere]">
        <p className="text-[10px] font-semibold text-indigo-600">{leadHistoryTypeLabel(item.type, vi)}</p>
        <h5 className="mt-1 font-semibold text-slate-800">{item.subject}</h5>
        {Number.isFinite(Date.parse(item.occurredAt)) ? <time dateTime={item.occurredAt} className="text-[10px] text-slate-500">{new Intl.DateTimeFormat(vi ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short", timeZone: config.localeRegion.timezone }).format(new Date(item.occurredAt))}</time> : <p>{text("Thời điểm hoạt động chưa khả dụng", "Activity time unavailable")}</p>}
        <p className="mt-1 text-[10px] text-slate-500">{text("Người ghi nhận", "Recorded by")}: {item.actorId}</p>
        {item.body && <details className="mt-2 text-slate-600"><summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-indigo-600">{text("Xem nội dung đã ghi nhận", "View recorded content")}</summary><p className="mt-1 whitespace-pre-wrap">{item.body}</p></details>}
      </li>)}
    </ol>
    {history.hasNextPage && <Button size="xs" disabled={history.query.loading || history.atLimit} onClick={() => void history.loadMore()}>{text("Tải thêm", "Load more")}</Button>}
    {history.atLimit && history.hasNextPage && <p role="status" className="text-xs">{text("Đã tải 500 hoạt động. Chọn loại để thu hẹp lịch sử.", "500 activities loaded. Choose a type to narrow history.")}</p>}
    <p className="text-[10px] text-slate-500">{text("Email và tin nhắn là ghi nhận thủ công, không xác nhận gửi. Lịch sử này chưa bao gồm sự kiện hoàn thành/hủy công việc.", "Email and messages are manual logs, not delivery confirmation. This history does not include task completion/cancellation events.")}</p>
  </section>;
}
