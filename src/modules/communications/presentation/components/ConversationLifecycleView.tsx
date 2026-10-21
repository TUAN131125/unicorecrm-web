import React from "react";
import type { ConversationStatus, ConversationSummary } from "../../domain/models";
import { conversationTargets } from "../../domain/conversationLifecycle";
import type { TransitionStatus } from "../hooks/useConversationTransition";

const labels = {
  NEW: { vi: "Mới", en: "New" }, OPEN: { vi: "Đang xử lý", en: "Open" },
  PENDING: { vi: "Đang chờ", en: "Pending" }, CLOSED: { vi: "Đã đóng", en: "Closed" },
};
export function ConversationStatusBadge({ status, locale }: { status: ConversationStatus; locale: "vi" | "en" }) {
  return <span className="ml-3 rounded-full bg-slate-100 px-3 py-1 text-xs" data-conversation-status={status}>{labels[status][locale]}</span>;
}
export function ConversationLifecycleView({ conversation, locale, onTransition, status = "idle" }: {
  conversation: ConversationSummary; locale: "vi" | "en";
  onTransition?: (id: string, target: ConversationStatus, version: number) => void; status?: TransitionStatus;
}) {
  const vi = locale === "vi";
  return <div className="space-y-3" data-guidance-id="communications-lifecycle">
    {conversation.status && <ConversationStatusBadge status={conversation.status} locale={locale} />}
    {conversation.status && conversation.version !== undefined && conversation.canTransition && onTransition &&
      <div className="flex gap-3">{conversationTargets(conversation.status).map(target => <button key={target} type="button"
        className="rounded-lg border px-4 py-2" disabled={status === "pending"}
        onClick={() => { if (conversation.version !== undefined) onTransition(conversation.id, target, conversation.version); }}>
        {target === "CLOSED" ? (vi ? "Đóng hội thoại" : "Close conversation")
          : target === "PENDING" ? (vi ? "Chuyển chờ" : "Set pending")
          : conversation.status === "NEW" ? (vi ? "Bắt đầu xử lý" : "Start processing")
          : conversation.status === "CLOSED" ? (vi ? "Mở lại hội thoại" : "Reopen conversation") : (vi ? "Tiếp tục xử lý" : "Resume processing")}
      </button>)}</div>}
    {status !== "idle" && <p role="status">{{
      pending: vi ? "Đang cập nhật trạng thái…" : "Updating status…",
      success: vi ? "Đã cập nhật trạng thái." : "Status updated.",
      unchanged: vi ? "Trạng thái không đổi; không tạo thay đổi mới." : "Status unchanged; no new change recorded.",
      conflict: vi ? "Hội thoại đã thay đổi hoặc thao tác không còn hợp lệ. Đã tải lại dữ liệu." : "Conversation changed or transition is no longer valid. Data refreshed.",
      denied: vi ? "Bạn không còn quyền đổi trạng thái." : "You no longer have permission to change status.",
      missing: vi ? "Hội thoại không còn trong phạm vi truy cập." : "Conversation is no longer in your access scope.",
      error: vi ? "Không xác nhận được thay đổi. Hãy làm mới trước khi thử lại." : "Status change could not be confirmed. Refresh before retrying.",
    }[status]}</p>}
  </div>;
}
