import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowUp,
  CalendarClock,
  Check,
  CircleStop,
  LoaderCircle,
  MessageCircleMore,
  RotateCw,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { formatApplicationError } from "@/shared/operations";
import type { AiContextWrapper } from "@/workspaces/crm/ai-context";
import { useEffectiveAccess } from "@/platform/access-control";
import { listWorkspaceMemberDirectory } from "@/platform/member-directory";
import { DEFAULT_AI_GOVERNANCE_POLICY, normalizeAiGovernancePolicy } from "@/ai/governance";
import {
  askAiAssistant,
  buildSanitizedAiRequestContext,
  defaultAiContextScope,
  executeAiAction,
  isConnectedAiRuntime,
  isRetryableAiInteractionState,
  resolveAiFocusedEntityRef,
  resolveAiInteractionState,
  type AiActionExecutionResult,
  type AiActionIntent,
  type AiInteractionState,
  type AiWorkspaceScope,
} from "@/ai";
import {
  isCancelUtterance,
  isConfirmUtterance,
  isCreateTaskUtterance,
  parseTaskDraftFromUtterance,
  parseTaskDueAt,
  type AiTaskDraft,
} from "@/ai/application/aiTaskDraftParsing";
import type { AiChatMessage } from "../../ai/aiTypes";
import { AiSuggestedActions } from "./AiSuggestedActions";
import { useI18n } from "../../i18n";

interface AiChatPanelProps {
  context: AiContextWrapper;
  scope: AiWorkspaceScope;
  conversationId: string;
  messages: AiChatMessage[];
  onAddMessage: (message: AiChatMessage) => void | Promise<void>;
  onClearThread?: () => void;
}

const makeMessage = (
  content: string,
  suggestedActions?: AiChatMessage["suggestedActions"],
): AiChatMessage => ({
  id: `ai_${Math.random().toString(36).slice(2, 11)}`,
  role: "assistant",
  content,
  createdAt: new Date().toISOString(),
  suggestedActions,
});

const STATE_LABELS: Record<AiInteractionState, { vi: string; en: string }> = {
  idle: { vi: "", en: "" },
  loading: { vi: "Đang suy nghĩ...", en: "Thinking..." },
  streaming: { vi: "Đang trả lời...", en: "Responding..." },
  success: { vi: "", en: "" },
  permission_denied: { vi: "Bạn không có quyền thực hiện yêu cầu AI này.", en: "You do not have permission for this AI request." },
  approval_required: { vi: "Hành động này cần được phê duyệt trước khi thực hiện.", en: "This action requires approval before it can run." },
  context_unavailable: { vi: "Không có dữ liệu ngữ cảnh cho yêu cầu này.", en: "No context data is available for this request." },
  provider_unavailable: { vi: "Dịch vụ AI chưa sẵn sàng. Hệ thống không dùng dữ liệu mô phỏng thay thế.", en: "The AI service is unavailable. Simulated output is not substituted." },
  rate_limited: { vi: "Có quá nhiều yêu cầu AI. Hãy thử lại sau ít phút.", en: "Too many AI requests. Try again shortly." },
  execution_failure: { vi: "Không thực hiện được hành động AI.", en: "The AI action could not be completed." },
  retryable_failure: { vi: "Yêu cầu AI chưa hoàn tất. Bạn có thể thử lại.", en: "The AI request did not complete. You can try again." },
};

const BUSY_STATES: readonly AiInteractionState[] = ["loading", "streaming"];
const SILENT_STATES: readonly AiInteractionState[] = ["idle", "success", "loading", "streaming"];

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  context,
  scope,
  conversationId,
  messages,
  onAddMessage,
  onClearThread,
}) => {
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const access = useEffectiveAccess();
  const isVi = locale === "vi";
  const governancePolicy = useMemo(() => normalizeAiGovernancePolicy(DEFAULT_AI_GOVERNANCE_POLICY), []);
  const [input, setInput] = useState("");
  const [interactionState, setInteractionState] = useState<AiInteractionState>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [pendingTask, setPendingTask] = useState<AiTaskDraft | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const directory = useMemo(() => listWorkspaceMemberDirectory(), [scope.workspaceId, messages.length]);
  const actorName = scope.actorName ?? scope.actorId;
  const canCreateTask = access.canPerform("tasks", "create");
  const connectedAdvisoryOnly = isConnectedAiRuntime();
  const isBusy = BUSY_STATES.includes(interactionState);

  const quickPrompts = connectedAdvisoryOnly
    ? (isVi
      ? ["Tôi nên làm gì tiếp theo?", "Điểm nào cần chú ý?", "Tóm tắt bản ghi này"]
      : ["What should I do next?", "What needs attention?", "Summarize this record"])
    : (isVi
      ? ["Tạo công việc mới", "Hôm nay tôi nên ưu tiên việc gì?", "Tóm tắt pipeline bán hàng", "Khách hàng nào cần chăm sóc?"]
      : ["Create a new task", "What should I prioritize today?", "Summarize the sales pipeline", "Which customers need attention?"]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, interactionState, reduceMotion]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
  }, [input]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2200);
  };

  const post = (message: AiChatMessage) => void Promise.resolve(onAddMessage(message));

  const reportFailure = (error: unknown) => {
    setInteractionState(resolveAiInteractionState(error));
    setStatusDetail(formatApplicationError(error, { locale }));
  };

  const resolveAssignee = (text: string) => {
    const value = text.trim().toLowerCase();
    if (/^(tôi|cho tôi|giao tôi|me|myself|assign to me)$/.test(value)) return { id: scope.actorId, name: actorName };
    const match = directory.find((member) => {
      const name = (member.displayName ?? "").trim().toLowerCase();
      const email = (member.email ?? "").trim().toLowerCase();
      return value === name || value === email || (name.length > 0 && (name.includes(value) || value.includes(name)));
    });
    return match ? { id: match.memberId, name: match.displayName } : undefined;
  };

  const askNextTaskQuestion = (draft: AiTaskDraft) => {
    if (!draft.title) {
      setPendingTask({ ...draft, step: "title" });
      post(makeMessage(isVi ? "Tên công việc là gì?" : "What is the task title?"));
      return;
    }
    if (!draft.dueAt) {
      setPendingTask({ ...draft, step: "due" });
      post(makeMessage(isVi ? "Hạn xử lý khi nào? Ví dụ: ‘ngày mai lúc 9h’ hoặc ‘15/07/2026 14:30’." : "When is it due? For example: ‘tomorrow at 9:00’ or ‘15/07/2026 14:30’."));
      return;
    }
    if (!draft.assigneeId) {
      setPendingTask({ ...draft, step: "assignee" });
      post(makeMessage(isVi ? "Giao cho ai? Bạn có thể trả lời ‘tôi’ hoặc nhập tên/email nhân viên." : "Who should own it? Reply ‘me’ or enter a member name/email."));
      return;
    }
    setPendingTask({ ...draft, step: "confirm" });
    setInteractionState("approval_required");
    setStatusDetail(null);
    const dueLabel = new Date(draft.dueAt).toLocaleString(isVi ? "vi-VN" : "en-US");
    post(makeMessage(
      isVi
        ? `Tôi sẽ tạo công việc:\n\n• Tên: ${draft.title}\n• Hạn: ${dueLabel}\n• Người phụ trách: ${draft.assigneeName}\n• Ưu tiên: ${draft.priority}\n\nHãy trả lời “Xác nhận” để tạo hoặc “Hủy”.`
        : `I will create this task:\n\n• Title: ${draft.title}\n• Due: ${dueLabel}\n• Assignee: ${draft.assigneeName}\n• Priority: ${draft.priority}\n\nReply “Confirm” to create it or “Cancel”.`,
    ));
  };

  const buildCreateTaskIntent = (draft: AiTaskDraft): AiActionIntent => ({
    type: "CREATE_TASK",
    suggestionId: `${conversationId}_${Date.now()}`,
    title: draft.title ?? "",
    ...(draft.description === undefined ? {} : { description: draft.description }),
    ...(draft.dueAt === undefined ? {} : { dueAt: draft.dueAt }),
    ...(draft.assigneeId === undefined ? {} : { assigneeId: draft.assigneeId }),
    priority: draft.priority,
    evidenceRefs: [
      `conversation:${conversationId}`,
      `chat-confirmation:${draft.title ?? ""}`,
      `assignee:${draft.assigneeId ?? scope.actorId}`,
    ],
  });

  const runIntent = async (
    intent: AiActionIntent,
    approved: boolean,
  ): Promise<AiActionExecutionResult | undefined> => {
    setInteractionState("loading");
    setStatusDetail(null);
    try {
      const result = await executeAiAction({
        scope,
        conversationId,
        intent,
        capabilityGranted: intent.type === "CREATE_TASK" ? canCreateTask : true,
        ...(approved
          ? { approval: { approved: true, approvedBy: scope.actorId, approvedAt: new Date().toISOString() } }
          : {}),
      });

      if (result.status === "APPROVAL_REQUIRED") {
        setInteractionState("approval_required");
        setStatusDetail(result.decision.reasons[0] ?? null);
        return result;
      }
      if (result.status === "BLOCKED" || result.status === "NOT_SUPPORTED") {
        setInteractionState("permission_denied");
        setStatusDetail(result.decision.reasons[0] ?? null);
        post(makeMessage(
          (isVi ? "AI không được phép thực hiện hành động này: " : "AI is not allowed to run this action: ")
            + (result.decision.reasons[0] ?? (isVi ? "chính sách từ chối." : "policy denied.")),
        ));
        return result;
      }
      setInteractionState("success");
      return result;
    } catch (error) {
      reportFailure(error);
      return undefined;
    }
  };

  const confirmPendingTask = async (draft: AiTaskDraft) => {
    setPendingTask(null);
    const result = await runIntent(buildCreateTaskIntent(draft), true);
    const created = result?.status === "EXECUTED" ? result.createdTask : undefined;
    if (!created) return;
    post(makeMessage(
      isVi ? `Đã tạo công việc “${created.title}”.` : `Task “${created.title}” was created.`,
      [{
        id: `open_${created.id}`,
        label: isVi ? "Mở công việc" : "Open task",
        actionType: "navigate",
        route: `/tasks/${created.id}`,
        intent: { type: "NAVIGATE", route: `/tasks/${created.id}` },
      }],
    ));
  };

  const handleTaskConversation = async (text: string): Promise<boolean> => {
    if (connectedAdvisoryOnly && isCreateTaskUtterance(text)) {
      setPendingTask(null);
      setInteractionState("permission_denied");
      setStatusDetail(isVi
        ? "Hành động tạo công việc bằng AI chưa khả dụng. Hãy tạo công việc trong mô-đun Công việc."
        : "AI task creation is not available. Create the task in the Tasks module.");
      post(makeMessage(isVi
        ? "Trợ lý AI chỉ cung cấp tư vấn trong chế độ kết nối và sẽ không tạo công việc."
        : "The AI Assistant is advisory-only in connected mode and will not create a task."));
      return true;
    }
    if (pendingTask) {
      if (isCancelUtterance(text)) {
        setPendingTask(null);
        setInteractionState("idle");
        post(makeMessage(isVi ? "Đã hủy yêu cầu tạo công việc." : "Task creation cancelled."));
        return true;
      }
      if (pendingTask.step === "title") {
        const title = text.trim();
        if (!title) {
          post(makeMessage(isVi ? "Vui lòng nhập tên công việc." : "Please enter a task title."));
          return true;
        }
        askNextTaskQuestion({ ...pendingTask, title });
        return true;
      }
      if (pendingTask.step === "due") {
        const dueAt = parseTaskDueAt(text);
        if (!dueAt) {
          post(makeMessage(isVi ? "Tôi chưa nhận ra thời hạn. Hãy nhập như ‘ngày mai lúc 9h’ hoặc ‘15/07/2026 14:30’." : "I could not recognize the due date. Try ‘tomorrow at 9:00’ or ‘15/07/2026 14:30’."));
          return true;
        }
        askNextTaskQuestion({ ...pendingTask, dueAt });
        return true;
      }
      if (pendingTask.step === "assignee") {
        const assignee = resolveAssignee(text);
        if (!assignee) {
          const suggestions = directory.slice(0, 5).map((member) => member.displayName).join(", ");
          post(makeMessage(isVi ? `Không tìm thấy nhân viên phù hợp. Hãy nhập tên/email chính xác hoặc trả lời “tôi”. Gợi ý: ${suggestions}` : `No matching member was found. Enter an exact name/email or reply “me”. Suggestions: ${suggestions}`));
          return true;
        }
        askNextTaskQuestion({ ...pendingTask, assigneeId: assignee.id, assigneeName: assignee.name });
        return true;
      }
      if (!isConfirmUtterance(text)) {
        post(makeMessage(isVi ? "Hãy trả lời “Xác nhận” để tạo hoặc “Hủy” để dừng." : "Reply “Confirm” to create it or “Cancel” to stop."));
        return true;
      }
      await confirmPendingTask(pendingTask);
      return true;
    }

    if (!isCreateTaskUtterance(text)) return false;
    const assignee = resolveAssignee(text);
    askNextTaskQuestion({
      ...parseTaskDraftFromUtterance(text),
      ...(assignee ? { assigneeId: assignee.id, assigneeName: assignee.name } : {}),
    });
    return true;
  };

  const handleSend = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isBusy) return;

    post({ id: `usr_${Math.random().toString(36).slice(2, 11)}`, role: "user", content: text, createdAt: new Date().toISOString() });
    setInput("");
    setStatusDetail(null);

    if (await handleTaskConversation(text)) return;

    setLastQuestion(text);
    setInteractionState("loading");
    const controller = new AbortController();
    abortRef.current = controller;
    const focusedEntity = resolveAiFocusedEntityRef(context);
    try {
      const result = await askAiAssistant({
        scope,
        conversationId,
        question: text,
        locale: isVi ? "vi" : "en",
        requestedContextScope: defaultAiContextScope(focusedEntity),
        ...(focusedEntity ? { focusedEntity } : {}),
        sanitizedContext: buildSanitizedAiRequestContext({
          context,
          policy: governancePolicy,
          ...(focusedEntity ? { focusedEntity } : {}),
        }),
        localContext: context,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (result.decision.allowed) {
        setInteractionState("success");
      } else {
        setInteractionState("permission_denied");
        setStatusDetail(result.decision.reasons[0] ?? null);
      }
      post(result.message);
    } catch (error) {
      if (!controller.signal.aborted) reportFailure(error);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const stopRequest = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setInteractionState("idle");
  };

  const statusMessage = statusDetail ?? (isVi ? STATE_LABELS[interactionState].vi : STATE_LABELS[interactionState].en);
  const showStatusBanner = statusMessage.length > 0 && !SILENT_STATES.includes(interactionState);
  const hasConversation = messages.some((message) => message.role === "user");

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white" data-ai-chat-panel="v3">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 max-w-[calc(100vw-2rem)] items-center gap-2 whitespace-normal rounded-xl text-center bg-slate-950 px-3.5 py-2.5 text-xs font-bold text-white shadow-xl"
          >
            <Check className="h-4 w-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="crm-app-scroll flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
          {!hasConversation && messages.length <= 1 && (
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 text-white shadow-[0_24px_60px_-24px_rgba(79,70,229,.75)]">
                <MessageCircleMore size={28} />
                <Sparkles className="absolute right-2 top-2 h-4 w-4 text-amber-200" />
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">{isVi ? "Tôi có thể giúp gì cho bạn?" : "How can I help?"}</h2>
              <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {quickPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => void handleSend(prompt)} className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50/40 hover:text-violet-700 hover:shadow-md [overflow-wrap:anywhere]">
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <motion.div key={message.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex min-w-0 gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm">
                      <Sparkles size={15} />
                    </div>
                  )}
                  <div className={`min-w-0 max-w-[min(82%,720px)] ${isUser ? "rounded-3xl rounded-br-lg bg-slate-950 px-4 py-3 text-white" : "px-1 py-1 text-slate-800"}`}>
                    <div className="whitespace-pre-wrap break-words text-sm font-medium leading-7 [overflow-wrap:anywhere]">{message.content}</div>
                    {!isUser && message.suggestedActions?.length ? (
                      <AiSuggestedActions
                        actions={message.suggestedActions}
                        onTriggerToast={showToast}
                        onExecuteIntent={async (intent) => { await runIntent(intent, false); }}
                      />
                    ) : null}
                  </div>
                  {isUser && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><UserRound size={15} /></div>}
                </motion.div>
              );
            })}
            {isBusy && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><LoaderCircle className="animate-spin" size={16} /></div>
                <span>{isVi ? STATE_LABELS[interactionState].vi : STATE_LABELS[interactionState].en}</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          {showStatusBanner && (
            <div data-ai-interaction-state={interactionState} className="mb-2 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{statusMessage}</span>
              {isRetryableAiInteractionState(interactionState) && lastQuestion && (
                <button type="button" onClick={() => void handleSend(lastQuestion)} className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold text-amber-800 hover:bg-amber-100">
                  <RotateCw size={11} />{isVi ? "Thử lại" : "Retry"}
                </button>
              )}
            </div>
          )}
          {!connectedAdvisoryOnly && pendingTask?.step === "confirm" && (
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void handleSend(isVi ? "Xác nhận" : "Confirm")} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700">{isVi ? "Xác nhận tạo" : "Confirm creation"}</button>
              <button type="button" onClick={() => void handleSend(isVi ? "Hủy" : "Cancel")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">{isVi ? "Hủy" : "Cancel"}</button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2 shadow-sm transition-all focus-within:border-violet-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend(input);
                }
              }}
              rows={1}
              placeholder={pendingTask ? (isVi ? "Trả lời thông tin còn thiếu..." : "Provide the missing information...") : (isVi ? "Nhắn cho Unicore AI..." : "Message Unicore AI...")}
              className="max-h-[140px] min-h-[42px] min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm font-medium leading-6 text-slate-800 outline-none placeholder:text-slate-400"
            />
            {isBusy ? (
              <button type="button" onClick={stopRequest} aria-label={isVi ? "Dừng" : "Stop"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><CircleStop size={18} /></button>
            ) : (
              <button type="button" onClick={() => void handleSend(input)} disabled={!input.trim()} aria-label={isVi ? "Gửi" : "Send"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={18} /></button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-medium text-slate-400">
            <span className="flex items-center gap-1"><CalendarClock size={12} />{connectedAdvisoryOnly
              ? (isVi ? "AI chỉ cung cấp tư vấn và không cập nhật dữ liệu." : "AI provides advice and does not update data.")
              : (isVi ? "AI sẽ hỏi lại trước khi tạo dữ liệu." : "AI asks before creating data.")}</span>
            {onClearThread && <button type="button" onClick={onClearThread} className="flex items-center gap-1 font-bold text-slate-400 hover:text-rose-600"><Trash2 size={12} />{isVi ? "Xóa cuộc trò chuyện" : "Clear conversation"}</button>}
          </div>
        </div>
      </footer>
    </section>
  );
};
