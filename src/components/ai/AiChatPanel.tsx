import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowUp,
  CircleStop,
  LoaderCircle,
  RotateCw,
} from "lucide-react";
import { formatApplicationError } from "@/shared/operations";
import { normalizeApplicationError } from "@/shared/domain";
import { Link } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { aiEntityLabel, aiEntityModules, aiFocus, aiRecordPrompts, aiSelectedRecord } from "./aiPresentation";
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
  presentAiProviderFailure,
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
  onStatusChange?: (state: AiInteractionState) => void;
  onNavigate?: () => void;
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
  provider_unavailable: { vi: "Dịch vụ AI chưa sẵn sàng. Vui lòng thử lại sau.", en: "The AI service is unavailable. Please try again later." },
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
  onStatusChange,
  onNavigate,
}) => {
  const { locale, t } = useI18n();
  const reduceMotion = useReducedMotion();
  const access = useEffectiveAccess();
  const isVi = locale === "vi";
  const governancePolicy = useMemo(() => normalizeAiGovernancePolicy(DEFAULT_AI_GOVERNANCE_POLICY), []);
  const [input, setInput] = useState("");
  const [interactionState, setInteractionState] = useState<AiInteractionState>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [retryableFailure, setRetryableFailure] = useState(false);
  const [pendingTask, setPendingTask] = useState<AiTaskDraft | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestLock = useRef(false);
  const directory = useMemo(() => listWorkspaceMemberDirectory(), [scope.workspaceId, messages.length]);
  const actorName = scope.actorName ?? scope.actorId;
  const canCreateTask = access.canPerform("tasks", "create");
  const connectedAdvisoryOnly = isConnectedAiRuntime();
  const isBusy = BUSY_STATES.includes(interactionState);
  const focused = aiSelectedRecord(context, connectedAdvisoryOnly);
  const module = focused ? aiEntityModules[focused.entityType] : undefined;
  const contextAllowed = !connectedAdvisoryOnly || Boolean(focused && module && access.canAccessModule(module));
  useEffect(() => onStatusChange?.(interactionState), [interactionState, onStatusChange]);

  const quickPrompts = connectedAdvisoryOnly
    ? (focused ? aiRecordPrompts(focused.entityType, locale) : [])
    : (isVi
      ? ["Tạo công việc mới", "Hôm nay tôi nên ưu tiên việc gì?", "Tóm tắt pipeline bán hàng", "Khách hàng nào cần chăm sóc?"]
      : ["Create a new task", "What should I prioritize today?", "Summarize the sales pipeline", "Which customers need attention?"]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, interactionState, reduceMotion]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useLayoutEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
  }, [input]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2200);
  };

  const post = (message: AiChatMessage) => Promise.resolve(onAddMessage(message));

  const reportFailure = (error: unknown) => {
    setInteractionState(resolveAiInteractionState(error));
    setStatusDetail(presentAiProviderFailure(error, locale) ?? formatApplicationError(error, { locale }));
    setRetryableFailure(normalizeApplicationError(error).retryable);
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
        setStatusDetail(null);
        return result;
      }
      if (result.status === "BLOCKED" || result.status === "NOT_SUPPORTED") {
        setInteractionState("permission_denied");
        setStatusDetail(null);
        post(makeMessage(isVi ? "Không thể thực hiện thao tác này. Vui lòng kiểm tra thông tin hoặc liên hệ quản trị viên." : "This action cannot be performed. Review the details or contact your administrator."));
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

  const handleSend = async (rawText: string, retry = false) => {
    const text = rawText.trim();
    if (!text || isBusy || requestLock.current || !contextAllowed || governancePolicy.killSwitch) return;
    requestLock.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (!retry) {
        await post({ id: `usr_${Math.random().toString(36).slice(2, 11)}`, role: "user", content: text, createdAt: new Date().toISOString() });
        if (controller.signal.aborted) return;
        setInput("");
        if (await handleTaskConversation(text)) return;
      }
      if (controller.signal.aborted) return;
      setStatusDetail(null);
      setRetryableFailure(false);
      setLastQuestion(text);
      setInteractionState("loading");
      const focusedEntity = resolveAiFocusedEntityRef(context);
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
        setStatusDetail(null);
      }
      await post(result.decision.allowed ? result.message : makeMessage(isVi ? "Không thể xử lý yêu cầu này. Vui lòng kiểm tra thông tin hoặc liên hệ quản trị viên." : "This request cannot be processed. Review the details or contact your administrator."));
    } catch (error) {
      if (!controller.signal.aborted) reportFailure(error);
    } finally {
      if (abortRef.current === controller) { abortRef.current = null; requestLock.current = false; }
    }
  };

  const stopRequest = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestLock.current = false;
    setInteractionState("idle");
    showToast(isVi ? "Đã dừng yêu cầu." : "Request stopped.");
  };

  const statusMessage = statusDetail ?? (isVi ? STATE_LABELS[interactionState].vi : STATE_LABELS[interactionState].en);
  const showStatusBanner = statusMessage.length > 0 && !SILENT_STATES.includes(interactionState);
  const firstUser = messages.findIndex(message => message.role === "user");
  const visibleMessages = firstUser < 0 ? [] : messages.slice(firstUser);
  const needsContext = connectedAdvisoryOnly && !focused;
  const deniedContext = connectedAdvisoryOnly && Boolean(focused) && !contextAllowed;
  return <section className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white" data-ai-chat-panel="v3">
    {toastMessage && <p role="status" className="absolute left-1/2 top-2 z-20 max-w-[90%] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-700 shadow-sm">{toastMessage}</p>}
    <div className="crm-app-scroll min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6" data-ai-message-scroll>
      <div className="mx-auto flex min-h-full w-full max-w-[860px] flex-col">
        {(needsContext || deniedContext) ? <div className="m-auto w-full max-w-xl py-6" data-ai-interaction-state={deniedContext ? "permission_denied" : "context_unavailable"}>
          <p className="mb-3 text-xs font-medium text-violet-700">{isVi ? "UniCore AI · Tư vấn CRM" : "UniCore AI · CRM advisory"}</p>
          <h2 className="text-2xl font-semibold leading-snug tracking-tight text-slate-950">{deniedContext ? (isVi ? "Bạn chưa có quyền phân tích hồ sơ này" : "You cannot analyze this record") : (isVi ? "Chọn một hồ sơ CRM để bắt đầu" : "Choose a CRM record to begin")}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">{isVi ? "Mở một Lead, Contact, Organization, Customer, Deal hoặc Task, sau đó sử dụng Trợ lý AI để phân tích." : "Open a Lead, Contact, Organization, Customer, Deal or Task, then use the assistant to analyze it."}</p>
          <div className="mt-5 flex flex-wrap gap-2">{Object.entries(aiEntityModules).filter(([, key]) => key && access.canAccessModule(key)).map(([type, key]) => <Link key={type} to={toWorkspacePath(scope.workspaceKey ?? "", "crm", key)} onClick={onNavigate} className={`rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 ${aiFocus}`}>{key === "deals" ? (isVi ? "Cơ hội" : "Deals") : key === "contacts" ? (isVi ? "Liên hệ" : "Contacts") : key === "organizations" ? (isVi ? "Tổ chức" : "Organizations") : key === "customers" ? (isVi ? "Khách hàng" : "Customers") : key === "tasks" ? (isVi ? "Công việc" : "Tasks") : "Leads"}</Link>)}</div>
        </div> : visibleMessages.length === 0 ? <div className="my-auto w-full max-w-2xl self-center py-8" data-ai-empty="focused">
          <p className="mb-3 text-xs font-medium text-violet-700">{focused ? aiEntityLabel(focused.entityType, locale) : (isVi ? "Không gian Demo" : "Demo workspace")}</p>
          <h2 className="text-2xl font-semibold leading-snug tracking-tight text-slate-950">{connectedAdvisoryOnly && focused ? (isVi ? `Tôi có thể giúp gì với ${aiEntityLabel(focused.entityType, locale).toLocaleLowerCase("vi-VN")} này?` : `How can I help with this ${aiEntityLabel(focused.entityType, locale).toLowerCase()}?`) : (isVi ? "Tôi có thể giúp gì cho bạn?" : "How can I help?")}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">{isVi ? "Phân tích thông tin, nhận diện điểm cần chú ý và đề xuất bước tiếp theo." : "Understand the information, identify concerns and plan your next step."}</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">{quickPrompts.slice(0, 4).map(prompt => <button key={prompt} type="button" disabled={isBusy} onClick={() => void handleSend(prompt)} className={`min-h-11 rounded-lg border border-slate-200 px-4 py-3 text-left text-[13px] leading-5 text-slate-700 hover:border-violet-300 hover:bg-violet-50/40 disabled:opacity-50 ${aiFocus}`}>{prompt}</button>)}</div>
        </div> : <div className="space-y-7" role="log" aria-label={isVi ? "Nội dung trò chuyện" : "Conversation messages"}>
          {visibleMessages.map(message => <article key={message.id} data-ai-message-role={message.role} className={`flex min-w-0 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={message.role === "user" ? "max-w-[88%] rounded-2xl rounded-br-md bg-slate-100 px-4 py-3" : "min-w-0 w-full py-1"}>
              {message.role !== "user" && <p className="mb-2 text-xs font-semibold text-slate-500">{t("ai.workspaceTitle")}</p>}
              <div className="whitespace-pre-wrap break-words text-sm font-normal leading-7 text-slate-800 [overflow-wrap:anywhere]">{message.content}</div>
              {message.role !== "user" && message.suggestedActions?.length ? <AiSuggestedActions actions={message.suggestedActions} evidence={Boolean(message.evidenceRefs?.length)} onNavigate={onNavigate} onTriggerToast={showToast} {...(!connectedAdvisoryOnly ? { onExecuteIntent: async intent => { await runIntent(intent, false); } } : {})} /> : null}
              {connectedAdvisoryOnly && message.role === "assistant" && !message.evidenceRefs?.length && <p className="mt-2 text-xs text-slate-500">{isVi ? "Phản hồi không kèm nguồn CRM." : "No CRM sources accompanied this response."}</p>}
            </div>
          </article>)}
        </div>}
        {isBusy && <p role="status" data-ai-interaction-state={interactionState} className="mt-5 flex items-center gap-2 text-[13px] text-slate-500"><LoaderCircle size={15} className="motion-safe:animate-spin" aria-hidden="true" />{isVi ? "Đang xử lý yêu cầu…" : "Processing your request…"}</p>}
        <div ref={scrollRef} />
      </div>
    </div>
    <footer className="shrink-0 border-t border-slate-100 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-6">
      <div className="mx-auto w-full max-w-[860px]">
        {showStatusBanner && <div data-ai-interaction-state={interactionState} role="alert" className="mb-3 flex flex-wrap items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-6 text-amber-950">
          <AlertTriangle size={16} aria-hidden="true" className="mt-1 shrink-0" /><p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{statusMessage}</p>
          {(retryableFailure || isRetryableAiInteractionState(interactionState)) && lastQuestion && <button type="button" disabled={isBusy} onClick={() => void handleSend(lastQuestion, true)} className={`flex min-h-9 items-center gap-1 rounded-md px-2 font-medium hover:bg-amber-100 ${aiFocus}`}><RotateCw size={14} />{isVi ? "Thử lại" : "Retry"}</button>}
        </div>}
        {!connectedAdvisoryOnly && pendingTask?.step === "confirm" && <div className="mb-2 flex gap-2"><button type="button" onClick={() => void handleSend(isVi ? "Xác nhận" : "Confirm")} className={`min-h-10 rounded-lg bg-violet-600 px-3 text-[13px] font-medium text-white ${aiFocus}`}>{isVi ? "Xác nhận tạo" : "Confirm creation"}</button><button type="button" onClick={() => void handleSend(isVi ? "Hủy" : "Cancel")} className={`min-h-10 rounded-lg border border-slate-200 px-3 text-[13px] ${aiFocus}`}>{isVi ? "Hủy" : "Cancel"}</button></div>}
        <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/10">
          <textarea ref={textareaRef} value={input} onChange={event => setInput(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void handleSend(input); } }}
            disabled={!contextAllowed} aria-label={isVi ? "Câu hỏi cho Trợ lý AI" : "Question for AI assistant"} rows={1}
            placeholder={!contextAllowed ? (isVi ? "Hãy chọn một hồ sơ CRM trước khi bắt đầu" : "Choose a CRM record before you begin") : pendingTask ? (isVi ? "Trả lời thông tin còn thiếu…" : "Provide the missing information…") : (isVi ? "Hỏi về hồ sơ CRM đang chọn..." : "Ask about the selected CRM record...")}
            className="max-h-[140px] min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:min-h-16" />
          {isBusy ? <button type="button" onClick={stopRequest} aria-label={isVi ? "Dừng" : "Stop"} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white ${aiFocus}`}><CircleStop size={18} /></button> : <button type="button" onClick={() => void handleSend(input)} disabled={!contextAllowed || !input.trim()} aria-label={isVi ? "Gửi" : "Send"} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 ${aiFocus}`}><ArrowUp size={18} /></button>}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs leading-5 text-slate-500"><p>{connectedAdvisoryOnly ? (isVi ? "AI chỉ đưa ra đề xuất. Dữ liệu CRM không được tự động thay đổi." : "AI provides suggestions only. CRM data is not changed automatically.") : (isVi ? "AI sẽ hỏi lại trước khi tạo dữ liệu trong Demo." : "AI asks before creating data in Demo.")}</p>{onClearThread && <button type="button" onClick={onClearThread} className={`min-h-8 rounded px-1 hover:text-rose-700 ${aiFocus}`}>{isVi ? "Xóa hội thoại" : "Clear conversation"}</button>}</div>
      </div>
    </footer>
  </section>;
};
