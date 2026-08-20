import { formatApplicationError } from "@/shared/operations";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUp,
  CalendarClock,
  Check,
  CircleStop,
  LoaderCircle,
  MessageCircleMore,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import type { AiChatMessage } from "../../ai/aiTypes";
import { askCrmAi } from "../../ai/aiMockEngine";
import type { AiContextWrapper } from "@/workspaces/crm/ai-context";
import { AiSuggestedActions } from "./AiSuggestedActions";
import { useI18n } from "../../i18n";
import { useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { listWorkspaceMemberDirectory } from "@/platform/member-directory";
import { createTaskCommand, type TaskPriority } from "@/modules/tasks";
import { DEFAULT_AI_GOVERNANCE_POLICY, normalizeAiGovernancePolicy, recordAiGovernanceDecision, type AiActionKind, type AiDataClass } from "@/ai/governance";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

interface AiChatPanelProps {
  context: AiContextWrapper;
  messages: AiChatMessage[];
  onAddMessage: (message: AiChatMessage) => void;
  onClearThread?: () => void;
}

type TaskDraftStep = "title" | "due" | "assignee" | "confirm";
interface PendingTaskDraft {
  title?: string;
  dueAt?: string;
  assigneeId?: string;
  assigneeName?: string;
  priority: TaskPriority;
  description?: string;
  step: TaskDraftStep;
}

const makeMessage = (content: string, suggestedActions?: AiChatMessage["suggestedActions"]): AiChatMessage => ({
  id: `ai_${Math.random().toString(36).slice(2, 11)}`,
  role: "assistant",
  content,
  createdAt: new Date().toISOString(),
  suggestedActions,
});

const normalize = (value: string) => value.trim().toLowerCase();
const isCreateTaskIntent = (value: string) => /\b(tạo|thêm|lập|create|add)\b.*\b(công việc|task)\b/i.test(value);
const isCancelIntent = (value: string) => /^(hủy|huỷ|bỏ|cancel|stop|không tạo)$/i.test(value.trim());
const isConfirmIntent = (value: string) => /^(xác nhận|đồng ý|tạo đi|ok|okay|yes|confirm|create)$/i.test(value.trim());

function parsePriority(text: string): TaskPriority {
  const value = normalize(text);
  if (/khẩn|urgent|critical/.test(value)) return "URGENT";
  if (/ưu tiên cao|\bhigh\b/.test(value)) return "HIGH";
  if (/ưu tiên thấp|\blow\b/.test(value)) return "LOW";
  return "NORMAL";
}

function parseTaskTitle(text: string): string | undefined {
  const quoted = text.match(/["“](.+?)["”]/)?.[1]?.trim();
  if (quoted) return quoted;
  const afterColon = text.split(":").slice(1).join(":").trim();
  if (afterColon) return afterColon.replace(/\s+(hạn|vào|cho|giao)\b.*$/i, "").trim() || undefined;
  const match = text.match(/(?:tạo|thêm|lập|create|add)\s+(?:một\s+)?(?:công việc|task)(?:\s+mới)?(?:\s+(?:tên|về|là))?\s+(.+?)(?=\s+(?:hạn|vào|cho|giao|due|assign)\b|$)/i);
  const title = match?.[1]?.trim();
  if (!title || /^(mới|new)$/i.test(title)) return undefined;
  return title;
}

function parseDueAt(text: string): string | undefined {
  const value = normalize(text);
  const now = new Date();
  const timeMatch = value.match(/(?:lúc|at)?\s*(\d{1,2})(?::|h)(\d{2})?/i);
  const hour = Math.min(23, Number(timeMatch?.[1] ?? 9));
  const minute = Math.min(59, Number(timeMatch?.[2] ?? 0));

  if (/ngày mai|tomorrow/.test(value)) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  }
  if (/hôm nay|today/.test(value)) {
    const date = new Date(now);
    date.setHours(timeMatch ? hour : Math.min(23, now.getHours() + 1), minute, 0, 0);
    if (date.getTime() <= now.getTime()) date.setHours(now.getHours() + 1, 0, 0, 0);
    return date.toISOString();
  }
  const relative = value.match(/sau\s+(\d+)\s*(giờ|tiếng|hour|hours|ngày|day|days)/i);
  if (relative) {
    const count = Number(relative[1]);
    const date = new Date(now);
    if (/ngày|day/.test(relative[2])) date.setDate(date.getDate() + count);
    else date.setHours(date.getHours() + count);
    return date.toISOString();
  }
  const dateMatch = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2})(?::|h)(\d{2})?)?/);
  if (dateMatch) {
    const date = new Date(Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1]), Number(dateMatch[4] ?? 9), Number(dateMatch[5] ?? 0), 0, 0);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  context,
  messages,
  onAddMessage,
  onClearThread,
}) => {
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const access = useEffectiveAccess();
  const workspace = useWorkspaceContextSnapshot();
  const governancePolicy = useMemo(() => normalizeAiGovernancePolicy(DEFAULT_AI_GOVERNANCE_POLICY), []);
  const isVi = locale === "vi";
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingTask, setPendingTask] = useState<PendingTaskDraft | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestTimerRef = useRef<number | null>(null);
  const directory = useMemo(() => listWorkspaceMemberDirectory(), [context.globalContext.actorId, messages.length]);
  const session = getAuthSessionSnapshot();
  const actorId = session?.principal.memberId || access.memberId || access.accountId || context.globalContext.actorId || "current-user";
  const actorName = session?.principal.displayName || actorId;
  const govern = (action: AiActionKind, dataClasses: AiDataClass[], evidenceRefs: string[], approved = false, fieldKeys?: string[]) => recordAiGovernanceDecision(workspace.workspaceId, governancePolicy, { requestId: `ai_request_${Date.now()}`, actorId, action, dataClasses, capabilityGranted: action !== "INTERNAL_UPDATE" || access.canPerform("tasks", "create"), evidenceRefs, approved, fieldKeys });

  const quickPrompts = isVi
    ? [
        "Tạo công việc mới",
        "Hôm nay tôi nên ưu tiên việc gì?",
        "Tóm tắt pipeline bán hàng",
        "Khách hàng nào cần chăm sóc?",
      ]
    : [
        "Create a new task",
        "What should I prioritize today?",
        "Summarize the sales pipeline",
        "Which customers need attention?",
      ];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, isTyping, reduceMotion]);

  useEffect(() => () => {
    if (requestTimerRef.current !== null) window.clearTimeout(requestTimerRef.current);
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
  }, [input]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2200);
  };

  const resolveAssignee = (text: string) => {
    const value = normalize(text);
    if (/^(tôi|cho tôi|giao tôi|me|myself|assign to me)$/.test(value)) {
      return { id: actorId, name: actorName };
    }
    const match = directory.find((member) => {
      const name = normalize(member.displayName || "");
      const email = normalize(member.email || "");
      return value === name || value === email || name.includes(value) || value.includes(name);
    });
    return match ? { id: match.memberId, name: match.displayName } : undefined;
  };

  const askNextTaskQuestion = (draft: PendingTaskDraft) => {
    if (!draft.title) {
      setPendingTask({ ...draft, step: "title" });
      onAddMessage(makeMessage(isVi ? "Tên công việc là gì?" : "What is the task title?"));
      return;
    }
    if (!draft.dueAt) {
      setPendingTask({ ...draft, step: "due" });
      onAddMessage(makeMessage(isVi ? "Hạn xử lý khi nào? Ví dụ: ‘ngày mai lúc 9h’ hoặc ‘15/07/2026 14:30’." : "When is it due? For example: ‘tomorrow at 9:00’ or ‘15/07/2026 14:30’."));
      return;
    }
    if (!draft.assigneeId) {
      setPendingTask({ ...draft, step: "assignee" });
      onAddMessage(makeMessage(isVi ? "Giao cho ai? Bạn có thể trả lời ‘tôi’ hoặc nhập tên/email nhân viên." : "Who should own it? Reply ‘me’ or enter a member name/email."));
      return;
    }
    const dueAt = draft.dueAt;
    const ready = { ...draft, dueAt, step: "confirm" as const };
    setPendingTask(ready);
    const dueLabel = new Date(dueAt).toLocaleString(isVi ? "vi-VN" : "en-US");
    onAddMessage(makeMessage(
      isVi
        ? `Tôi sẽ tạo công việc:\n\n• Tên: ${ready.title}\n• Hạn: ${dueLabel}\n• Người phụ trách: ${ready.assigneeName}\n• Ưu tiên: ${ready.priority}\n\nHãy trả lời “Xác nhận” để tạo hoặc “Hủy”.`
        : `I will create this task:\n\n• Title: ${ready.title}\n• Due: ${dueLabel}\n• Assignee: ${ready.assigneeName}\n• Priority: ${ready.priority}\n\nReply “Confirm” to create it or “Cancel”.`,
    ));
  };

  const handleTaskCommand = async (text: string): Promise<boolean> => {
    if (pendingTask) {
      if (isCancelIntent(text)) {
        setPendingTask(null);
        onAddMessage(makeMessage(isVi ? "Đã hủy yêu cầu tạo công việc." : "Task creation cancelled."));
        return true;
      }
      if (pendingTask.step === "title") {
        const title = text.trim();
        if (!title) {
          onAddMessage(makeMessage(isVi ? "Vui lòng nhập tên công việc." : "Please enter a task title."));
          return true;
        }
        askNextTaskQuestion({ ...pendingTask, title });
        return true;
      }
      if (pendingTask.step === "due") {
        const dueAt = parseDueAt(text);
        if (!dueAt) {
          onAddMessage(makeMessage(isVi ? "Tôi chưa nhận ra thời hạn. Hãy nhập như ‘ngày mai lúc 9h’ hoặc ‘15/07/2026 14:30’." : "I could not recognize the due date. Try ‘tomorrow at 9:00’ or ‘15/07/2026 14:30’."));
          return true;
        }
        askNextTaskQuestion({ ...pendingTask, dueAt });
        return true;
      }
      if (pendingTask.step === "assignee") {
        const assignee = resolveAssignee(text);
        if (!assignee) {
          const suggestions = directory.slice(0, 5).map((member) => member.displayName).join(", ");
          onAddMessage(makeMessage(isVi ? `Không tìm thấy nhân viên phù hợp. Hãy nhập tên/email chính xác hoặc trả lời “tôi”. Gợi ý: ${suggestions}` : `No matching member was found. Enter an exact name/email or reply “me”. Suggestions: ${suggestions}`));
          return true;
        }
        askNextTaskQuestion({ ...pendingTask, assigneeId: assignee.id, assigneeName: assignee.name });
        return true;
      }
      if (pendingTask.step === "confirm") {
        if (!isConfirmIntent(text)) {
          onAddMessage(makeMessage(isVi ? "Hãy trả lời “Xác nhận” để tạo hoặc “Hủy” để dừng." : "Reply “Confirm” to create it or “Cancel” to stop."));
          return true;
        }
        if (!access.canPerform("tasks", "create")) {
          setPendingTask(null);
          onAddMessage(makeMessage(isVi ? "Tài khoản hiện tại không có quyền tạo công việc." : "The current account does not have permission to create tasks."));
          return true;
        }
        try {
          const governance = govern("INTERNAL_UPDATE", ["INTERNAL", "CUSTOMER_PII"], [`chat-confirmation:${pendingTask.title}`, `assignee:${pendingTask.assigneeId}`], true, ["task.title", "task.assigneeId", "task.dueAt"]);
          if (!governance.decision.allowed) {
            setPendingTask(null);
            onAddMessage(makeMessage((isVi ? "AI không được phép tạo công việc: " : "AI is not allowed to create the task: ") + governance.decision.reasons[0]));
            return true;
          }
          const attemptId = `task_ai_${Date.now()}`;
          const outcome = await createTaskCommand({
            id: attemptId,
            title: pendingTask.title!,
            assigneeId: pendingTask.assigneeId!,
            dueAt: pendingTask.dueAt!,
            priority: pendingTask.priority,
            ...(pendingTask.description ? { description: pendingTask.description } : {}),
            actorId,
            actorName,
            sourceRef: { type: "AI_ASSISTANT", id: attemptId, evidence: "Created after explicit user confirmation in AI chat." },
          }, {
            idempotencyKey: `task.create:${attemptId}`,
            actor: { id: actorId, name: actorName },
          });
          const created = outcome.data;
          setPendingTask(null);
          onAddMessage(makeMessage(
            isVi ? `Đã tạo công việc “${created.title}”.` : `Task “${created.title}” was created.`,
            [{ id: `open_${created.id}`, label: isVi ? "Mở công việc" : "Open task", actionType: "navigate", route: `/tasks/${created.id}` }],
          ));
        } catch (error) {
          onAddMessage(makeMessage(formatApplicationError(error, { locale })));
        }
        return true;
      }
    }

    if (!isCreateTaskIntent(text)) return false;
    const assignee = resolveAssignee(text);
    const draft: PendingTaskDraft = {
      title: parseTaskTitle(text),
      dueAt: parseDueAt(text),
      assigneeId: assignee?.id,
      assigneeName: assignee?.name,
      priority: parsePriority(text),
      step: "title",
    };
    askNextTaskQuestion(draft);
    return true;
  };

  const stopRequest = () => {
    if (requestTimerRef.current !== null) {
      window.clearTimeout(requestTimerRef.current);
      requestTimerRef.current = null;
    }
    setIsTyping(false);
  };

  const handleSend = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isTyping) return;

    onAddMessage({
      id: `usr_${Math.random().toString(36).slice(2, 11)}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    });
    setInput("");

    if (await handleTaskCommand(text)) return;

    const governance = govern("RECOMMEND", ["INTERNAL", "CUSTOMER_PII"], [`crm-context:${workspace.workspaceId}`, `user-question:${text.slice(0, 80)}`]);
    if (!governance.decision.allowed) {
      onAddMessage(makeMessage((isVi ? "Yêu cầu AI bị chặn bởi chính sách: " : "The AI request was blocked by policy: ") + governance.decision.reasons[0]));
      return;
    }
    setIsTyping(true);
    requestTimerRef.current = window.setTimeout(() => {
      onAddMessage(askCrmAi(text, context));
      setIsTyping(false);
      requestTimerRef.current = null;
    }, reduceMotion ? 60 : 460);
  };

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
                  <button key={prompt} type="button" onClick={() => handleSend(prompt)} className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50/40 hover:text-violet-700 hover:shadow-md [overflow-wrap:anywhere]">
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
                    {!isUser && message.suggestedActions?.length ? <AiSuggestedActions actions={message.suggestedActions} onTriggerToast={showToast} /> : null}
                  </div>
                  {isUser && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><UserRound size={15} /></div>}
                </motion.div>
              );
            })}
            {isTyping && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><LoaderCircle className="animate-spin" size={16} /></div>
                <span>{isVi ? "Đang suy nghĩ..." : "Thinking..."}</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          {pendingTask?.step === "confirm" && (
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => handleSend(isVi ? "Xác nhận" : "Confirm")} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700">{isVi ? "Xác nhận tạo" : "Confirm creation"}</button>
              <button type="button" onClick={() => handleSend(isVi ? "Hủy" : "Cancel")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">{isVi ? "Hủy" : "Cancel"}</button>
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
                  handleSend(input);
                }
              }}
              rows={1}
              placeholder={pendingTask ? (isVi ? "Trả lời thông tin còn thiếu..." : "Provide the missing information...") : (isVi ? "Nhắn cho Unicore AI..." : "Message Unicore AI...")}
              className="max-h-[140px] min-h-[42px] min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm font-medium leading-6 text-slate-800 outline-none placeholder:text-slate-400"
            />
            {isTyping ? (
              <button type="button" onClick={stopRequest} aria-label={isVi ? "Dừng" : "Stop"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><CircleStop size={18} /></button>
            ) : (
              <button type="button" onClick={() => handleSend(input)} disabled={!input.trim()} aria-label={isVi ? "Gửi" : "Send"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={18} /></button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-medium text-slate-400">
            <span className="flex items-center gap-1"><CalendarClock size={12} />{isVi ? "AI sẽ hỏi lại trước khi tạo dữ liệu." : "AI asks before creating data."}</span>
            {onClearThread && <button type="button" onClick={onClearThread} className="flex items-center gap-1 font-bold text-slate-400 hover:text-rose-600"><Trash2 size={12} />{isVi ? "Xóa cuộc trò chuyện" : "Clear conversation"}</button>}
          </div>
        </div>
      </footer>
    </section>
  );
};
