import React from "react";
import type { ConversationMessage, ConversationSummary, ConversationStatus } from "../../domain/models";
import type { ClaimStatus } from "../hooks/useConversationClaim";
import type { TransitionStatus } from "../hooks/useConversationTransition";
import { ConversationLifecycleView, ConversationStatusBadge } from "./ConversationLifecycleView";

export type InboxState =
  | { kind: "unavailable" | "loading" | "error" | "denied" | "missing" }
  | { kind: "ready"; conversations: readonly ConversationSummary[]; messages: readonly ConversationMessage[]; hasMore: boolean; canClaim?: boolean };

export interface InboxViewProps {
  state: InboxState;
  locale: "vi" | "en";
  detail?: boolean;
  onOpen?: (id: string) => void;
  onMore?: () => void;
  queue?: boolean;
  onClaim?: (id: string) => void;
  claimStatus?: ClaimStatus;
  onTransition?: (id: string, target: ConversationStatus, version: number) => void;
  transitionStatus?: TransitionStatus;
}

export function InboxView({ state, locale, detail = false, onOpen, onMore, queue = false, onClaim, claimStatus = "idle", onTransition, transitionStatus = "idle" }: InboxViewProps) {
  const vi = locale === "vi";
  const copy = {
    unavailable: vi ? "Hộp thư hiện chưa khả dụng." : "Inbox is currently unavailable.",
    loading: vi ? "Đang tải hội thoại…" : "Loading conversations…",
    error: vi ? "Không tải được hội thoại. Vui lòng thử lại sau." : "Conversations could not be loaded. Please try again later.",
    denied: vi ? "Bạn không có quyền đọc hội thoại này." : "You do not have access to this conversation.",
    missing: vi ? "Không tìm thấy hội thoại trong phạm vi truy cập." : "Conversation not found within your access scope.",
  };
  return (
    <section className="mx-auto max-w-5xl space-y-5 p-6" data-guidance-id="communications-content" aria-busy={state.kind === "loading"}>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{vi ? "Giao tiếp" : "Communications"}</p>
        <h1 className="text-2xl font-semibold text-slate-900">{detail ? (vi ? "Chi tiết hội thoại" : "Conversation detail") : (vi ? "Hộp thư" : "Inbox")}</h1>
      </header>
      {detail && state.kind === "ready" && state.conversations[0] && <ConversationLifecycleView conversation={state.conversations[0]}
        locale={locale} status={transitionStatus} {...(onTransition ? { onTransition } : {})} />}
      {claimStatus !== "idle" && <p role="status">{{
        pending: vi ? "Đang nhận hội thoại…" : "Claiming conversation…",
        success: vi ? "Đã nhận hội thoại." : "Conversation claimed.",
        conflict: vi ? "Hội thoại đã được người khác nhận. Hàng chờ đã được làm mới." : "Conversation is no longer available to claim. Queue refreshed.",
        denied: vi ? "Bạn không còn quyền nhận hội thoại." : "You no longer have permission to claim.",
        missing: vi ? "Hội thoại không còn khả dụng." : "Conversation is no longer available.",
        error: vi ? "Không nhận được hội thoại. Hãy làm mới rồi thử lại." : "Claim could not be confirmed. Refresh and retry.",
      }[claimStatus]}</p>}
      {state.kind !== "ready" ? (
        <p role={state.kind === "error" || state.kind === "denied" ? "alert" : "status"} className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">{copy[state.kind]}</p>
      ) : detail ? (
        <ol aria-label={vi ? "Tin nhắn" : "Messages"} className="space-y-3">
          {state.messages.length === 0 && <li role="status">{vi ? "Chưa có tin nhắn." : "No messages yet."}</li>}
          {state.messages.map(message => <li key={message.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <time className="text-xs text-slate-500" dateTime={message.occurredAt}>{message.occurredAt}</time>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{message.text ?? (vi ? "Nội dung bị giới hạn theo quyền truy cập." : "Content withheld by access policy.")}</p>
          </li>)}
        </ol>
      ) : (
        <ul aria-label={vi ? "Hội thoại" : "Conversations"} className="space-y-2">
          {state.conversations.length === 0 && <li role="status">{vi ? "Chưa có hội thoại." : "No conversations yet."}</li>}
          {state.conversations.map(conversation => <li key={conversation.id}>
            <button type="button" disabled={queue} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50" onClick={() => onOpen?.(conversation.id)}>
              <span>{vi ? "Hội thoại" : "Conversation"} {conversation.id}</span>
              {!queue && conversation.status && <ConversationStatusBadge status={conversation.status} locale={locale} />}
              <time className="ml-4 text-xs text-slate-500" dateTime={conversation.lastActivityAt}>{conversation.lastActivityAt}</time>
            </button>
            {queue && state.canClaim && onClaim && <button type="button" data-guidance-id="communications-claim"
              disabled={claimStatus === "pending"} onClick={() => onClaim(conversation.id)} className="rounded-lg border px-4 py-2">
              {vi ? "Nhận hội thoại" : "Claim"}
            </button>}
          </li>)}
        </ul>
      )}
      {state.kind === "ready" && state.hasMore && <button type="button" className="rounded-lg border px-4 py-2" onClick={onMore}>{vi ? "Trang tiếp" : "Next page"}</button>}
    </section>
  );
}
