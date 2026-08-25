import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Menu,
  MessageCircleMore,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { formatApplicationError } from "@/shared/operations";
import type { AiContextWrapper } from "@/workspaces/crm/ai-context";
import { DEFAULT_AI_GOVERNANCE_POLICY } from "@/ai/governance";
import {
  appendAiConversationMessage,
  createAiConversation,
  deleteAiConversation,
  isConnectedAiRuntime,
  listAiConversations,
  resolveAiInteractionState,
  type AiInteractionState,
} from "@/ai";
import { useAiAssistantScope } from "@/ai/react/useAiAssistantScope";
import { useI18n } from "../../i18n";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { OVERLAY_Z } from "../overlay/overlayLayers";
import { AiChatPanel } from "./AiChatPanel";
import type { AiChatMessage, AiChatThread } from "../../ai/aiTypes";

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: AiContextWrapper;
}

const formatThreadTime = (value: string, locale: "vi" | "en") => {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit" });
};

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({ isOpen, onClose, context }) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const reduceMotion = useReducedMotion();
  const scope = useAiAssistantScope();
  const aiDisabled = DEFAULT_AI_GOVERNANCE_POLICY.killSwitch;
  const connectedAdvisoryOnly = isConnectedAiRuntime();
  const [threads, setThreads] = useState<AiChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState<AiInteractionState>("idle");
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);

  useBodyScrollLock(isOpen);

  const welcomeMessage = connectedAdvisoryOnly
    ? (isVi
      ? "Xin chào! Tôi cung cấp tư vấn chỉ đọc cho Lead, Deal hoặc Task đang được chọn. Các hành động tạo hoặc cập nhật dữ liệu không khả dụng trong Trợ lý AI."
      : "Hello! I provide read-only advice for the selected Lead, Deal, or Task. Create and update actions are unavailable in the AI Assistant.")
    : (isVi
      ? "Xin chào! Tôi là Trợ lý AI của UnicoreCRM. Bạn có thể hỏi dữ liệu CRM, yêu cầu phân tích hoặc ra lệnh tạo công việc."
      : "Hello! I am the UnicoreCRM AI Assistant. Ask about CRM data, request analysis, or command task creation.");
  const newConversationTitle = isVi ? "Cuộc trò chuyện mới" : "New conversation";

  const reportRuntimeFailure = useCallback((error: unknown) => {
    setRuntimeState(resolveAiInteractionState(error));
    setRuntimeMessage(formatApplicationError(error, { locale }));
  }, [locale]);

  const commitThreads = useCallback((next: AiChatThread[], preferredId?: string) => {
    setThreads(next);
    setRuntimeState("success");
    setRuntimeMessage(null);
    setActiveThreadId((current) => {
      if (preferredId && next.some((thread) => thread.id === preferredId)) return preferredId;
      if (current && next.some((thread) => thread.id === current)) return current;
      return next[0]?.id ?? null;
    });
  }, []);

  const createThread = useCallback(async () => {
    try {
      const thread = await createAiConversation(scope, { title: newConversationTitle, welcomeMessage });
      commitThreads(await listAiConversations(scope), thread.id);
      setMobileHistoryOpen(false);
    } catch (error) {
      reportRuntimeFailure(error);
    }
  }, [commitThreads, newConversationTitle, reportRuntimeFailure, scope, welcomeMessage]);

  // Conversations are scoped by workspace and actor, so a workspace switch loads
  // a different conversation set instead of revealing the previous one.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setRuntimeState("loading");
    void (async () => {
      try {
        const existing = await listAiConversations(scope);
        if (cancelled) return;
        if (existing.length > 0) {
          commitThreads(existing);
          return;
        }
        const thread = await createAiConversation(scope, { title: newConversationTitle, welcomeMessage });
        if (cancelled) return;
        commitThreads([thread], thread.id);
      } catch (error) {
        if (!cancelled) {
          setThreads([]);
          setActiveThreadId(null);
          reportRuntimeFailure(error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, scope, newConversationTitle, welcomeMessage, commitThreads, reportRuntimeFailure]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mobileHistoryOpen) setMobileHistoryOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, mobileHistoryOpen, onClose]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
    [activeThreadId, threads],
  );

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) => {
      const haystack = `${thread.title} ${thread.messages.map((message) => message.content).join(" ")}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [search, threads]);

  const handleAddMessage = useCallback(async (message: AiChatMessage) => {
    if (!activeThread) return;
    try {
      const updated = await appendAiConversationMessage(scope, activeThread.id, message);
      if (!updated) return;
      commitThreads(await listAiConversations(scope), updated.id);
    } catch (error) {
      reportRuntimeFailure(error);
    }
  }, [activeThread, commitThreads, reportRuntimeFailure, scope]);

  const deleteThread = useCallback(async (threadId: string) => {
    setMenuThreadId(null);
    try {
      await deleteAiConversation(scope, threadId);
      const remaining = await listAiConversations(scope);
      if (remaining.length > 0) {
        commitThreads(remaining);
        return;
      }
      const created = await createAiConversation(scope, { title: newConversationTitle, welcomeMessage });
      commitThreads([created], created.id);
    } catch (error) {
      reportRuntimeFailure(error);
    }
  }, [commitThreads, newConversationTitle, reportRuntimeFailure, scope, welcomeMessage]);

  const clearActiveThread = () => {
    if (activeThread) void deleteThread(activeThread.id);
  };

  const historyPanel = (
    <aside className="flex h-full min-h-0 w-[292px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/85">
      <div className="shrink-0 p-3">
        <button type="button" onClick={() => void createThread()} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-700">
          <Plus size={15} />
          {newConversationTitle}
        </button>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
          <Search size={14} className="shrink-0 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isVi ? "Tìm lịch sử..." : "Search history..."} className="min-w-0 flex-1 border-0 bg-transparent text-xs font-medium outline-none placeholder:text-slate-400" />
        </label>
      </div>

      <div className="crm-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {isVi ? "Lịch sử trò chuyện" : "Chat history"}
        </div>
        <div className="space-y-1">
          {filteredThreads.map((thread) => {
            const active = thread.id === activeThread?.id;
            return (
              <div key={thread.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setMobileHistoryOpen(false);
                  }}
                  className={`flex w-full min-w-0 items-start gap-2 rounded-xl px-3 py-3 pr-9 text-left transition-all ${active ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/80 hover:text-slate-900"}`}
                >
                  <MessageCircleMore size={15} className={`mt-0.5 shrink-0 ${active ? "text-violet-600" : "text-slate-400"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block crm-text-wrap text-xs font-semibold">{thread.title}</span>
                    <span className="mt-1 block text-[10px] font-medium text-slate-400">{formatThreadTime(thread.updatedAt, locale)}</span>
                  </span>
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); setMenuThreadId(menuThreadId === thread.id ? null : thread.id); }} aria-label={isVi ? "Tùy chọn cuộc trò chuyện" : "Conversation options"} className="absolute right-2 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700">
                  <MoreHorizontal size={14} />
                </button>
                {menuThreadId === thread.id && (
                  <div className="absolute right-2 top-10 z-30 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    <button type="button" onClick={() => void deleteThread(thread.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold text-rose-600 hover:bg-rose-50">
                      <Trash2 size={13} />{isVi ? "Xóa" : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredThreads.length === 0 && (
            <div className="px-4 py-8 text-center text-xs font-medium text-slate-400">{isVi ? "Không tìm thấy cuộc trò chuyện." : "No conversations found."}</div>
          )}
        </div>
      </div>
    </aside>
  );

  if (typeof document === "undefined") return null;

  const runtimeUnavailable = runtimeMessage !== null && !activeThread;

  return createPortal(
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, x: 24, y: 24, borderRadius: 32 }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0, borderRadius: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97, x: 18, y: 18, borderRadius: 28 }}
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "calc(100% - 44px) calc(100% - 44px)" }}
          className={`fixed inset-0 flex min-w-0 flex-col overflow-hidden bg-white ${OVERLAY_Z.drawer}`}
          aria-label={isVi ? "Trợ lý AI toàn màn hình" : "Full-screen AI Assistant"}
          data-ai-workspace="v3"
          data-ai-layout="chat-history"
        >
          <header className="relative z-20 flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur-xl md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setMobileHistoryOpen(true)} aria-label={isVi ? "Mở lịch sử" : "Open history"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm md:hidden">
                <Menu size={18} />
              </button>
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 text-white shadow-lg shadow-violet-500/20">
                <MessageCircleMore size={20} />
                <Sparkles className="absolute right-1.5 top-1.5 h-3 w-3 text-amber-200" />
              </div>
              <div className="min-w-0">
                <div className="crm-text-wrap text-sm font-semibold text-slate-950">{isVi ? "Unicore AI" : "Unicore AI"}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                  <span className={`h-2 w-2 rounded-full ${runtimeUnavailable ? "bg-amber-500" : "bg-emerald-500"}`} />
                  {aiDisabled
                    ? (isVi ? "Đã tạm dừng bởi quản trị viên" : "Paused by administrator")
                    : runtimeUnavailable
                      ? (isVi ? "Dịch vụ AI chưa sẵn sàng" : "AI service unavailable")
                      : (isVi ? "Sẵn sàng" : "Ready")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void createThread()} className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 sm:flex"><Plus size={14} />{isVi ? "Trò chuyện mới" : "New chat"}</button>
              <button type="button" onClick={onClose} aria-label={isVi ? "Đóng Trợ lý AI" : "Close AI Assistant"} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"><X size={18} /></button>
            </div>
          </header>

          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="hidden h-full md:block">{historyPanel}</div>
            <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
              <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] leading-5 text-slate-600">
                {isVi ? "Trợ lý sử dụng dữ liệu bạn có quyền xem. Hãy kiểm tra nội dung trước khi gửi hoặc cập nhật thông tin." : "The assistant uses data you are allowed to view. Review content before sending or updating information."}
              </div>
              {aiDisabled ? (
                <div data-ai-governance="kill-switch" className="flex min-h-0 flex-1 items-center justify-center p-6"><div className="max-w-lg rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center"><div className="text-sm font-black text-amber-900">{isVi ? "Trợ lý AI đang được tạm dừng" : "AI Assistant is paused"}</div><p className="mt-2 text-xs leading-6 text-amber-800">{isVi ? "Workspace Owner đã bật kill switch. Lịch sử vẫn được giữ nhưng hệ thống không phân tích dữ liệu hoặc đề xuất hành động mới." : "The Workspace Owner enabled the kill switch. History remains available, but no new data analysis or actions are produced."}</p></div></div>
              ) : runtimeUnavailable ? (
                <div data-ai-runtime-state={runtimeState} className="flex min-h-0 flex-1 items-center justify-center p-6">
                  <div className="max-w-lg rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
                    <div className="text-sm font-black text-amber-900">{isVi ? "Dịch vụ AI chưa sẵn sàng" : "The AI service is unavailable"}</div>
                    <p className="mt-2 text-xs leading-6 text-amber-800">{runtimeMessage}</p>
                    <p className="mt-2 text-[11px] leading-5 text-amber-700">{isVi ? "Hệ thống không thay thế bằng dữ liệu mô phỏng." : "Simulated output is never substituted for a connected answer."}</p>
                  </div>
                </div>
              ) : activeThread ? (
                <div className="min-h-0 flex-1">
                  <AiChatPanel
                    context={context}
                    scope={scope}
                    conversationId={activeThread.id}
                    messages={activeThread.messages}
                    onAddMessage={handleAddMessage}
                    onClearThread={clearActiveThread}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">{isVi ? "Đang tải cuộc trò chuyện..." : "Loading conversation..."}</div>
              )}
            </main>
          </div>

          <AnimatePresence>
            {mobileHistoryOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm md:hidden" onClick={() => setMobileHistoryOpen(false)}>
                <motion.div initial={reduceMotion ? false : { x: "-100%" }} animate={{ x: 0 }} exit={reduceMotion ? undefined : { x: "-100%" }} transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }} className="h-full w-[292px] max-w-[86vw]" onClick={(event) => event.stopPropagation()}>
                  {historyPanel}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}
    </AnimatePresence>,
    document.body,
  );
};
