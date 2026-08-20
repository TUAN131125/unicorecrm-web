import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  History,
  Menu,
  MessageCircleMore,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { AiContextWrapper } from "@/workspaces/crm/ai-context";
import { DEFAULT_AI_GOVERNANCE_POLICY } from "@/ai/governance";
import { useI18n } from "../../i18n";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { OVERLAY_Z } from "../overlay/overlayLayers";
import { AiChatPanel } from "./AiChatPanel";
import {
  appendAiChatMessage,
  createAiChatThread,
  getAiChatThreads,
  saveAiChatThreads,
} from "../../ai/aiStorage";
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
  const aiDisabled = DEFAULT_AI_GOVERNANCE_POLICY.killSwitch;
  const [threads, setThreads] = useState<AiChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);

  useBodyScrollLock(isOpen);

  const welcomeMessage = isVi
    ? "Xin chào! Tôi là Trợ lý AI của UnicoreCRM. Bạn có thể hỏi dữ liệu CRM, yêu cầu phân tích hoặc ra lệnh tạo công việc."
    : "Hello! I am the UnicoreCRM AI Assistant. Ask about CRM data, request analysis, or command task creation.";

  const refreshThreads = (preferredId?: string) => {
    const next = getAiChatThreads();
    setThreads(next);
    const preferredExists = preferredId && next.some((thread) => thread.id === preferredId);
    const activeExists = activeThreadId && next.some((thread) => thread.id === activeThreadId);
    setActiveThreadId(preferredExists ? preferredId! : activeExists ? activeThreadId : next[0]?.id ?? null);
  };

  const createThread = () => {
    const thread = createAiChatThread(isVi ? "Cuộc trò chuyện mới" : "New conversation", welcomeMessage);
    refreshThreads(thread.id);
    setMobileHistoryOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const existing = getAiChatThreads();
    if (existing.length === 0) {
      const thread = createAiChatThread(isVi ? "Cuộc trò chuyện mới" : "New conversation", welcomeMessage);
      setThreads([thread]);
      setActiveThreadId(thread.id);
    } else {
      setThreads(existing);
      setActiveThreadId((current) => current && existing.some((thread) => thread.id === current) ? current : existing[0].id);
    }
  }, [isOpen, isVi, welcomeMessage]);

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

  const handleAddMessage = (message: AiChatMessage) => {
    if (!activeThread) return;
    const updated = appendAiChatMessage(activeThread.id, message);
    if (!updated) return;
    const next = getAiChatThreads();
    setThreads(next);
    setActiveThreadId(updated.id);
  };

  const deleteThread = (threadId: string) => {
    const next = getAiChatThreads().filter((thread) => thread.id !== threadId);
    saveAiChatThreads(next);
    setMenuThreadId(null);
    if (next.length === 0) {
      const created = createAiChatThread(isVi ? "Cuộc trò chuyện mới" : "New conversation", welcomeMessage);
      setThreads([created]);
      setActiveThreadId(created.id);
    } else {
      setThreads(next);
      setActiveThreadId((current) => current === threadId ? next[0].id : current);
    }
  };

  const clearActiveThread = () => {
    if (activeThread) deleteThread(activeThread.id);
  };

  const historyPanel = (
    <aside className="flex h-full min-h-0 w-[292px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/85">
      <div className="shrink-0 p-3">
        <button type="button" onClick={createThread} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-700">
          <Plus size={15} />
          {isVi ? "Cuộc trò chuyện mới" : "New conversation"}
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
                    <button type="button" onClick={() => deleteThread(thread.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold text-rose-600 hover:bg-rose-50">
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
                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />{aiDisabled ? (isVi ? "Đã tạm dừng bởi quản trị viên" : "Paused by administrator") : (isVi ? "Sẵn sàng" : "Ready")}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={createThread} className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 sm:flex"><Plus size={14} />{isVi ? "Trò chuyện mới" : "New chat"}</button>
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
              ) : activeThread ? (
                <div className="min-h-0 flex-1"><AiChatPanel context={context} messages={activeThread.messages} onAddMessage={handleAddMessage} onClearThread={clearActiveThread} /></div>
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
