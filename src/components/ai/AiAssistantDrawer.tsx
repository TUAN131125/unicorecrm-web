import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { Bot, History, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { formatApplicationError } from "@/shared/operations";
import { ConfirmDialog, Drawer, OverlayPortalHostContext } from "@/shared/components/ui";
import { useAccessibleOverlay } from "@/shared/components/ui/useAccessibleOverlay";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { useEffectiveAccess } from "@/platform/access-control";
import type { AiContextWrapper } from "@/workspaces/crm/ai-context";
import { DEFAULT_AI_GOVERNANCE_POLICY } from "@/ai/governance";
import { appendAiConversationMessage, createAiConversation, deleteAiConversation, isConnectedAiRuntime, listAiConversations, type AiInteractionState } from "@/ai";
import { useAiAssistantScope } from "@/ai/react/useAiAssistantScope";
import { useI18n } from "../../i18n";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { OVERLAY_Z } from "../overlay/overlayLayers";
import { AiChatPanel } from "./AiChatPanel";
import { AiHistoryPanel } from "./AiHistoryPanel";
import { aiEntityLabel, aiEntityModules, aiFocus, aiRecordRoute, aiSelectedRecord, useAiMediaQuery } from "./aiPresentation";
import type { AiChatMessage, AiChatThread, AiWorkspaceScope } from "@/ai";

interface AiAssistantDrawerProps { isOpen: boolean; onClose: () => void; context: AiContextWrapper }

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = props => {
  const scope = useAiAssistantScope();
  const session = useAuthSessionSnapshot();
  return <AiAssistantWorkspace key={`${scope.workspaceId}:${scope.actorId}:${session?.sessionId}`} {...props} scope={scope} />;
};

function AiAssistantWorkspace({ isOpen, onClose, context, scope }: AiAssistantDrawerProps & { scope: AiWorkspaceScope }) {
  const { locale, t } = useI18n();
  const vi = locale === "vi";
  const reduceMotion = useReducedMotion();
  const access = useEffectiveAccess();
  const connected = isConnectedAiRuntime();
  const desktopHistory = useAiMediaQuery("(min-width: 1024px)");
  const wideContext = useAiMediaQuery("(min-width: 1536px)");
  const aiDisabled = DEFAULT_AI_GOVERNANCE_POLICY.killSwitch;
  const focused = aiSelectedRecord(context, connected);
  const contextModule = focused ? aiEntityModules[focused.entityType] : undefined;
  const permitted = !connected || Boolean(contextModule && access.canAccessModule(contextModule));
  const [threads, setThreads] = useState<AiChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  useEffect(() => { if (desktopHistory) setMobileHistoryOpen(false); }, [desktopHistory]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<{ owner: string; state: AiInteractionState }>({ owner: "", state: "idle" });
  const activeThread = useMemo(() => threads.find(thread => thread.id === activeThreadId) ?? threads[0] ?? null, [activeThreadId, threads]);
  const chatKey = `${activeThread?.id}:${focused?.entityType}:${focused?.entityId}`;
  const onStatusChange = useCallback((state: AiInteractionState) => setChatStatus({ owner: chatKey, state }), [chatKey]);
  const state = chatStatus.owner === chatKey ? chatStatus.state : "idle";
  const { rootRef, surfaceRef } = useAccessibleOverlay({ isOpen, onClose, shouldHandleEscape: () => !mobileHistoryOpen && !deleteId });
  useBodyScrollLock(isOpen);

  const newConversationTitle = vi ? "Cuộc trò chuyện mới" : "New conversation";
  const welcomeMessage = connected
    ? (vi ? "AI chỉ đưa ra đề xuất. Dữ liệu CRM không được tự động thay đổi." : "AI provides suggestions only. CRM data is not changed automatically.")
    : (vi ? "Xin chào! Tôi là Trợ lý AI của UnicoreCRM. Bạn có thể hỏi dữ liệu CRM, yêu cầu phân tích hoặc ra lệnh tạo công việc." : "Hello! I am the UnicoreCRM AI Assistant. Ask about CRM data, request analysis, or command task creation.");
  const commitThreads = useCallback((next: AiChatThread[], preferredId?: string) => {
    setThreads(next); setRuntimeMessage(null);
    setActiveThreadId(current => preferredId && next.some(thread => thread.id === preferredId) ? preferredId : current && next.some(thread => thread.id === current) ? current : next[0]?.id ?? null);
  }, []);
  const reportFailure = useCallback((error: unknown) => setRuntimeMessage(formatApplicationError(error, { locale })), [locale]);
  const createThread = useCallback(async () => {
    try { const thread = await createAiConversation(scope, { title: newConversationTitle, welcomeMessage }); commitThreads(await listAiConversations(scope), thread.id); setMobileHistoryOpen(false); }
    catch (error) { reportFailure(error); }
  }, [scope, newConversationTitle, welcomeMessage, commitThreads, reportFailure]);
  useEffect(() => {
    if (!isOpen) return;
    let retired = false;
    void (async () => {
      try {
        const existing = await listAiConversations(scope);
        if (retired) return;
        if (existing.length) commitThreads(existing);
        else { const thread = await createAiConversation(scope, { title: newConversationTitle, welcomeMessage }); if (!retired) commitThreads([thread], thread.id); }
      } catch (error) { if (!retired) reportFailure(error); }
    })();
    return () => { retired = true; };
  }, [isOpen, scope, newConversationTitle, welcomeMessage, commitThreads, reportFailure]);
  const handleAddMessage = useCallback(async (message: AiChatMessage) => {
    if (!activeThread) return;
    try { const updated = await appendAiConversationMessage(scope, activeThread.id, message); if (updated) commitThreads(await listAiConversations(scope), updated.id); }
    catch (error) { reportFailure(error); }
  }, [activeThread, scope, commitThreads, reportFailure]);
  const deleteThread = async () => {
    if (!deleteId) return;
    await deleteAiConversation(scope, deleteId);
    const remaining = await listAiConversations(scope);
    commitThreads(remaining);
    setDeleteId(null);
    if (!remaining.length) await createThread();
  };
  const history = <AiHistoryPanel threads={threads} activeId={activeThread?.id ?? null} search={search} onSearch={setSearch} onCreate={() => void createThread()} onSelect={id => { setActiveThreadId(id); setMobileHistoryOpen(false); }} onDelete={setDeleteId} connected={connected} locale={locale} />;
  const labels: Record<AiInteractionState, string> = {
    idle: vi ? "Chưa kiểm tra kết nối" : "Connection not checked", loading: vi ? "Đang xử lý" : "Processing", streaming: vi ? "Đang trả lời" : "Responding", success: vi ? "Đã nhận phản hồi" : "Response received",
    context_unavailable: vi ? "Chưa có ngữ cảnh" : "Context unavailable", permission_denied: vi ? "Không có quyền truy cập" : "Permission denied", provider_unavailable: vi ? "Dịch vụ AI chưa khả dụng" : "Provider unavailable", rate_limited: vi ? "Đã giới hạn yêu cầu" : "Rate limited", retryable_failure: vi ? "Có thể thử lại" : "Retry available", execution_failure: vi ? "Yêu cầu chưa hoàn tất" : "Request failed", approval_required: vi ? "Cần xác nhận" : "Approval required",
  };
  const status = aiDisabled ? (vi ? "Đã tạm dừng bởi quản trị viên" : "Disabled by administrator") : connected && !focused ? labels.context_unavailable : !permitted ? labels.permission_denied : labels[state];
  const recordRoute = focused?.entityId && scope.workspaceKey ? aiRecordRoute(focused.entityType, focused.entityId, scope.workspaceKey) : undefined;
  const recordContext = focused && permitted && <>
    <span className="font-medium text-slate-700">{aiEntityLabel(focused.entityType, locale)} · {vi ? "Hồ sơ đang mở" : "Current record"}</span>
    {recordRoute && <Link to={recordRoute} onClick={onClose} className={`rounded px-1 py-2 font-medium text-violet-700 hover:underline ${aiFocus}`}>{vi ? "Mở hồ sơ gốc" : "Open record"}</Link>}
  </>;
  if (typeof document === "undefined" || !isOpen) return null;
  return createPortal(<div ref={rootRef} data-i18n-skip="true" className={`fixed inset-0 ${OVERLAY_Z.drawer}`}>
    <motion.div ref={surfaceRef} role="dialog" aria-modal="true" aria-labelledby="unicore-ai-title" tabIndex={-1}
      initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.14 }}
      className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden bg-white text-slate-800" data-ai-workspace="v3" data-ai-layout="chat-history">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {!desktopHistory && <button type="button" onClick={() => setMobileHistoryOpen(true)} aria-label={vi ? "Mở lịch sử" : "Open history"} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 ${aiFocus}`}><History size={19} /></button>}
          <Bot size={22} aria-hidden="true" className="hidden shrink-0 text-violet-700 sm:block" />
          <div className="min-w-0"><h1 id="unicore-ai-title" className="text-lg font-semibold tracking-tight text-slate-950">{t("ai.workspaceTitle")}</h1><p className="hidden text-xs text-slate-500 sm:block">{vi ? "Trợ lý phân tích và tư vấn CRM" : "CRM analysis and advisory assistant"}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <p role="status" data-ai-status={aiDisabled ? "disabled" : connected && !focused ? "context_unavailable" : !permitted ? "permission_denied" : state} className="hidden text-xs text-slate-500 md:block">{status}</p>
          <button type="button" onClick={() => void createThread()} aria-label={vi ? "Trò chuyện mới" : "New chat"} className={`flex h-11 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 ${aiFocus}`}><Plus size={17} /><span className="hidden sm:inline">{vi ? "Trò chuyện mới" : "New chat"}</span></button>
          <button type="button" onClick={onClose} aria-label={vi ? "Đóng Trợ lý AI" : "Close AI Assistant"} data-overlay-initial-focus className={`flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 ${aiFocus}`}><X size={20} /></button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {desktopHistory && <aside className="w-[248px] shrink-0 border-r border-slate-200">{history}</aside>}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {focused && permitted && !wideContext && <div data-ai-context className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 border-b border-slate-100 bg-slate-50/60 px-4 py-1 text-xs sm:px-6">{recordContext}</div>}
          <p className="sr-only">{vi ? "Trợ lý sử dụng dữ liệu bạn có quyền xem" : "The assistant uses data you are allowed to view"}</p>
          <p role="status" className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 md:hidden">{status}</p>
          {aiDisabled ? <div data-ai-governance="kill-switch" className="m-auto max-w-lg p-6 text-sm leading-7"><h2 className="font-semibold">{vi ? "Trợ lý AI đang được tạm dừng" : "AI Assistant is paused"}</h2><p>{vi ? "Quản trị viên đã bật kill switch. Không có yêu cầu phân tích mới được gửi." : "An administrator enabled the kill switch. No new analysis request is sent."}</p></div>
          : runtimeMessage ? <div role="alert" className="m-auto max-w-lg p-6 text-sm leading-7"><p>{runtimeMessage}</p><button onClick={() => void createThread()} className={`mt-3 rounded px-2 py-2 font-medium text-violet-700 ${aiFocus}`}>{vi ? "Thử mở hội thoại mới" : "Try a new conversation"}</button></div>
          : activeThread ? <div className="min-h-0 flex-1"><AiChatPanel key={chatKey} context={context} scope={scope} conversationId={activeThread.id} messages={activeThread.messages} onAddMessage={handleAddMessage} onClearThread={() => setDeleteId(activeThread.id)} onStatusChange={onStatusChange} onNavigate={onClose} /></div>
          : <p role="status" className="m-auto p-6 text-sm text-slate-500">{vi ? "Đang mở hội thoại…" : "Opening conversation…"}</p>}
        </main>
        {recordContext && wideContext && <aside data-ai-context className="w-60 shrink-0 border-l border-slate-200 bg-slate-50/50 p-5"><h2 className="text-[13px] font-semibold">{vi ? "Ngữ cảnh đang phân tích" : "Analysis context"}</h2><div className="mt-4 flex flex-col items-start gap-2 text-[13px]">{recordContext}</div><p className="mt-4 text-xs leading-6 text-slate-500">{vi ? "Câu hỏi mới sử dụng hồ sơ đang mở." : "New questions use the current record."}</p></aside>}
      </div>
    </motion.div>
    <OverlayPortalHostContext.Provider value={rootRef.current ? { container: rootRef.current, suspended: false } : undefined}>
      {!desktopHistory && <Drawer isOpen={mobileHistoryOpen} onClose={() => setMobileHistoryOpen(false)} position="left" title={vi ? "Lịch sử trò chuyện" : "Conversation history"} className="!w-[min(320px,90vw)]" bodyClassName="!p-0" scrollBody={false}>{history}</Drawer>}
    </OverlayPortalHostContext.Provider>
    <ConfirmDialog isOpen={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={deleteThread} title={vi ? "Xóa cuộc trò chuyện?" : "Delete conversation?"} message={vi ? "Thao tác này xóa hội thoại đã chọn, không thay đổi dữ liệu CRM." : "This removes the selected conversation and does not change CRM data."} confirmText={vi ? "Xóa" : "Delete"} cancelText={vi ? "Hủy" : "Cancel"} type="danger" />
  </div>, document.body);
}
