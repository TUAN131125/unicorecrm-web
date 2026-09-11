import type { AiChatMessage, AiSuggestedAction } from "./aiTypes";
import type { AiContextWrapper } from "./aiContextBuilder";
import {
  type Customer as CanonicalCustomer,
  type Customer360ReadModel,
  type CustomerRelationshipAssessment,
} from "@/modules/customers";
import { actionToSuggestedActions, formatAiMoney, makeAiId } from "./aiMockEngine.shared";

interface FocusedCustomerBundle {
  customer: CanonicalCustomer;
  readModel: Customer360ReadModel;
  intelligence: CustomerRelationshipAssessment;
}

type AssistantMessageFactory = (
  content: string,
  actions?: AiSuggestedAction[],
) => AiChatMessage;

export function answerFocusedCustomerQuestion(
  question: string,
  lang: "vi" | "en",
  context: AiContextWrapper,
  assistantMessage: AssistantMessageFactory,
): AiChatMessage | undefined {
  const bundle = getFocusedCustomerBundle(context);
  if (!bundle) return undefined;

  const mentionsAnotherScope = [
    "pipeline",
    "deal",
    "cơ hội nào",
    "báo giá nào",
    "support cases",
    "phiếu hỗ trợ nào",
  ].some((token) => question.includes(token));
  const asksReturn =
    question.includes("đổi") ||
    question.includes("trả") ||
    question.includes("return");
  const asksEvidence =
    question.includes("bằng chứng") ||
    question.includes("evidence") ||
    question.includes("tại sao") ||
    question.includes("why");
  const asksPriority =
    question.includes("hôm nay") ||
    question.includes("làm gì") ||
    question.includes("ưu tiên") ||
    question.includes("priority") ||
    question.includes("attention");
  const asksRisk =
    question.includes("rủi ro") ||
    question.includes("risk") ||
    question.includes("tín hiệu") ||
    question.includes("signal");
  const asksSummary =
    question.includes("tóm tắt") ||
    question.includes("summary") ||
    question.includes("khách hàng này") ||
    question.includes("khách hàng này") ||
    question.includes("this customer");

  if (
    mentionsAnotherScope &&
    !asksReturn &&
    !question.includes("khách hàng này") &&
    !question.includes("this customer")
  )
    return undefined;
  if (asksReturn)
    return buildFocusedCustomerReturnAnswer(lang, bundle, assistantMessage);
  if (asksEvidence)
    return buildFocusedCustomerEvidenceAnswer(lang, bundle, assistantMessage);
  if (asksPriority || asksRisk)
    return buildFocusedCustomerPriorityAnswer(lang, bundle, assistantMessage);
  if (asksSummary)
    return buildFocusedCustomerSummary(lang, context, assistantMessage);
  return undefined;
}

function getFocusedCustomerBundle(context: AiContextWrapper):
  | {
      customer: CanonicalCustomer;
      readModel: Customer360ReadModel;
      intelligence: CustomerRelationshipAssessment;
    }
  | undefined {
  const focused = context.focusedItem;
  if (focused?.entityType !== "customer") return undefined;
  const readModel = focused.relatedItems?.readModel as
    Customer360ReadModel | undefined;
  const intelligence = focused.relatedItems?.intelligence as
    CustomerRelationshipAssessment | undefined;
  if (!readModel || !intelligence) return undefined;
  return {
    customer: focused.data as CanonicalCustomer,
    readModel,
    intelligence,
  };
}

export function buildFocusedCustomerSummary(
  lang: "vi" | "en",
  context: AiContextWrapper,
  assistantMessage: AssistantMessageFactory,
): AiChatMessage | undefined {
  const bundle = getFocusedCustomerBundle(context);
  if (!bundle) return undefined;
  const { readModel, intelligence } = bundle;
  const risks = intelligence.signals.filter(
    (signal) => signal.kind !== "POSITIVE",
  );
  const signalLines = risks
    .slice(0, 3)
    .map(
      (signal) =>
        `- ${signal.kind === "RISK" ? "🔴" : "🟠"} **${lang === "vi" ? signal.labelVi : signal.labelEn}**: ${lang === "vi" ? signal.detailVi : signal.detailEn}`,
    )
    .join("\n");
  const returnsLine =
    lang === "vi"
      ? `- **Đổi / Trả**: ${readModel.metrics.activeReturnCount} đang hoạt động, ${readModel.metrics.returnAttentionCount} cần chú ý.`
      : `- **Returns**: ${readModel.metrics.activeReturnCount} active, ${readModel.metrics.returnAttentionCount} need attention.`;
  const text =
    lang === "vi"
      ? `### 👥 Tổng quan khách hàng: **${readModel.identity.displayName}**\n` +
        `- **Sức khỏe tính toán**: ${intelligence.score}/100 · ${intelligence.level} · ${intelligence.trend}.\n` +
        `- **Doanh thu đã ghi nhận**: ${readModel.metrics.revenue === undefined ? "chưa có dữ liệu" : formatAiMoney(readModel.metrics.revenue, "vi-VN")} · **Cơ hội đang mở**: ${readModel.metrics.openDealCount ?? "chưa có dữ liệu"} cơ hội.\n` +
        `- **Ngoại lệ vận hành**: ${readModel.metrics.overdueTaskCount} việc quá hạn · ${readModel.metrics.supportRiskCount} yêu cầu hỗ trợ có rủi ro.\n` +
        `${returnsLine}\n` +
        `- **Hành động tiếp theo**: ${intelligence.nextActionVi}\n\n` +
        `${signalLines || "✅ Chưa có tín hiệu bất thường cần ưu tiên."}`
      : `### 👥 Tổng quan khách hàng: **${readModel.identity.displayName}**\n` +
        `- **Computed health**: ${intelligence.score}/100 · ${intelligence.level} · ${intelligence.trend}.\n` +
        `- **Recognized revenue**: ${readModel.metrics.revenue === undefined ? "unavailable" : formatAiMoney(readModel.metrics.revenue, "en-US")} · **Open pipeline**: ${readModel.metrics.openDealCount ?? "unavailable"} opportunities.\n` +
        `- **Operational exceptions**: ${readModel.metrics.overdueTaskCount} overdue tasks · ${readModel.metrics.supportRiskCount} support risks.\n` +
        `${returnsLine}\n` +
        `- **Next action**: ${intelligence.nextActionEn}\n\n` +
        `${signalLines || "✅ No abnormal priority signal is currently detected."}`;
  return assistantMessage(
    text,
    actionToSuggestedActions(
      intelligence.primaryAction,
      readModel.customer.id,
      lang,
    ),
  );
}

function buildFocusedCustomerPriorityAnswer(
  lang: "vi" | "en",
  bundle: FocusedCustomerBundle,
  assistantMessage: AssistantMessageFactory,
): AiChatMessage {
  const { readModel, intelligence } = bundle;
  const priorities = intelligence.signals
    .filter((signal) => signal.kind !== "POSITIVE")
    .slice(0, 4);
  const lines = priorities
    .map(
      (signal, index) =>
        `${index + 1}. **${lang === "vi" ? signal.labelVi : signal.labelEn}** — ${lang === "vi" ? signal.detailVi : signal.detailEn}`,
    )
    .join("\n");
  const text =
    lang === "vi"
      ? `### 🎯 Ưu tiên cho **${readModel.identity.displayName}**\n\n${lines || "✅ Không có ngoại lệ cần ưu tiên ngay."}\n\n**Next best action:** ${intelligence.nextActionVi}`
      : `### 🎯 Priorities for **${readModel.identity.displayName}**\n\n${lines || "✅ No exception needs immediate priority."}\n\n**Next best action:** ${intelligence.nextActionEn}`;
  return assistantMessage(
    text,
    actionToSuggestedActions(
      intelligence.primaryAction,
      readModel.customer.id,
      lang,
    ),
  );
}

function buildFocusedCustomerReturnAnswer(
  lang: "vi" | "en",
  bundle: FocusedCustomerBundle,
  assistantMessage: AssistantMessageFactory,
): AiChatMessage {
  const { readModel } = bundle;
  const active = readModel.returns.filter(
    (request) => !["CLOSED", "REJECTED"].includes(request.status),
  );
  const failedIntents = readModel.returnIntents.filter(
    (intent) => intent.status === "FAILED",
  );
  if (active.length === 0 && failedIntents.length === 0) {
    return assistantMessage(
      lang === "vi"
        ? `✅ **${readModel.identity.displayName}** không có yêu cầu đổi / trả đang hoạt động hoặc tác vụ xử lý bị lỗi.`
        : `✅ **${readModel.identity.displayName}** has no active return request or failed resolution action.`,
    );
  }
  const lines = active
    .slice(0, 5)
    .map(
      (request) =>
        `- **${request.code}** · ${request.status} · ${request.reason} · ${request.requestedResolution}`,
    )
    .join("\n");
  const failedLine =
    failedIntents.length > 0
      ? lang === "vi"
        ? `\n⚠️ Có **${failedIntents.length}** tác vụ refund/vận chuyển bị lỗi.`
        : `\n⚠️ **${failedIntents.length}** refund/shipping action(s) failed.`
      : "";
  const first = active[0];
  const actions = first
    ? [
        {
          id: makeAiId("sa"),
          label: lang === "vi" ? `Mở ${first.code}` : `Open ${first.code}`,
          actionType: "navigate" as const,
          route: `/returns/${first.id}`,
        },
      ]
    : [];
  return assistantMessage(
    lang === "vi"
      ? `### 🔄 Đổi / Trả của **${readModel.identity.displayName}**\n\n${lines || "Không có yêu cầu đang hoạt động."}${failedLine}`
      : `### 🔄 Returns for **${readModel.identity.displayName}**\n\n${lines || "No active requests."}${failedLine}`,
    actions,
  );
}

function buildFocusedCustomerEvidenceAnswer(
  lang: "vi" | "en",
  bundle: FocusedCustomerBundle,
  assistantMessage: AssistantMessageFactory,
): AiChatMessage {
  const { readModel, intelligence } = bundle;
  const primary =
    intelligence.signals.find((signal) => signal.kind !== "POSITIVE") ??
    intelligence.signals[0];
  if (!primary)
    return assistantMessage(
      lang === "vi"
        ? "Chưa có tín hiệu để giải thích."
        : "There is no signal to explain yet.",
    );
  const evidence = primary.evidence
    .map(
      (item) =>
        `- **${item.sourceType}** · ${lang === "vi" ? item.factVi : item.factEn}`,
    )
    .join("\n");
  const text =
    lang === "vi"
      ? `### 🔎 Bằng chứng cho tín hiệu **${primary.labelVi}**\n\n${evidence}\n\nAI chỉ diễn giải từ các bản ghi trên; không sử dụng dữ liệu sử dụng hoặc giả định ngoài CRM.`
      : `### 🔎 Evidence for **${primary.labelEn}**\n\n${evidence}\n\nThe assistant only interprets the records above; it does not assume usage data outside the CRM.`;
  return assistantMessage(
    text,
    actionToSuggestedActions(
      primary.recommendedAction,
      readModel.customer.id,
      lang,
    ),
  );
}
