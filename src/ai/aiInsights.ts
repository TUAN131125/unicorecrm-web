import type { AiInsight } from "./aiTypes";
import type { AiContextWrapper } from "./aiContextBuilder";
import type { Deal } from "@/modules/deals";
import { QuoteStatus, type Quote } from "@/modules/quotes";
import type { SupportCase } from "@/modules/support";
import type { CustomerOrder } from "@/modules/orders";
import {
  type Customer as CanonicalCustomer,
  type Customer360ReadModel,
  type CustomerRelationshipAssessment,
} from "@/modules/customers";
import { draftDealNextStep, draftQuoteReminder, draftSupportReply } from "./aiMessageDrafts";
import { actionToSuggestedActions, makeAiId } from "./aiMockEngine.shared";

export function generateGlobalInsights(context: AiContextWrapper): AiInsight[] {
  const insights: AiInsight[] = [];

  // Insight A: Overdue Deals (High Severity)
  const overdueDeals = context.deals.filter((d) => {
    if (!d.expectedCloseDate) return false;
    return (
      new Date(d.expectedCloseDate) < new Date() &&
      String(d.stage).toUpperCase() !== "WON" &&
      String(d.stage).toUpperCase() !== "LOST"
    );
  });
  if (overdueDeals.length > 0) {
    const d = overdueDeals[0];
    const draft = draftDealNextStep(d);
    insights.push({
      id: makeAiId("ins_deal"),
      type: "risk",
      severity: "high",
      title: `⚠️ Phát hiện giao dịch trễ hạn: ${d.name}`,
      description: `Hợp đồng dự kiến đóng ngày ${new Date(d.expectedCloseDate!).toLocaleDateString("vi-VN")} nhưng chưa được chuyển trạng thái đóng. Có rủi ro mất giao dịch.`,
      reasons: [
        "Quá hạn dự kiến đóng",
        "Chưa có báo giá hoàn tất gửi khách hàng",
        "Cần liên hệ cập nhật tiến độ",
      ],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Mở cơ hội",
          actionType: "navigate",
          route: `/deals/${d.id}`,
        },
        {
          id: makeAiId("act"),
          label: "Sao chép thư soạn nháp",
          actionType: "copy",
          payload: draft,
        },
      ],
      relatedEntityType: "deal",
      relatedEntityId: d.id,
      createdAt: new Date().toISOString(),
    });
  }

  // Insight B: Accepted Quotes No Orders (Medium Severity)
  const acceptedNoOrder = context.quotes.filter(
    (q) => q.status === QuoteStatus.ACCEPTED,
  );
  if (acceptedNoOrder.length > 0) {
    const q = acceptedNoOrder[0];
    insights.push({
      id: makeAiId("ins_quote"),
      type: "opportunity",
      severity: "medium",
      title: `📜 Báo giá duyệt nhưng chưa tạo Đơn hàng: ${q.quoteNumber || q.id.substring(0, 5)}`,
      description: `Khách hàng đã chấp thuận báo giá trị giá ${q.grandTotal?.toLocaleString("vi-VN") || "0"} ₫. Hãy nhanh chóng mở đơn hàng để lưu lịch sử sở hữu sản phẩm.`,
      reasons: [
        "Báo giá đã được khách hàng chấp thuận",
        "Chưa có lệnh bán / Đơn hàng tương thích",
        "Để tránh làm chậm trễ tiến trình bàn giao dịch vụ",
      ],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Xem báo giá",
          actionType: "navigate",
          route: `/quotes/${q.id}`,
        },
        {
          id: makeAiId("act"),
          label: "Soạn nháp email nhắc khách",
          actionType: "copy",
          payload: draftQuoteReminder(q),
        },
      ],
      relatedEntityType: "quote",
      relatedEntityId: q.id,
      createdAt: new Date().toISOString(),
    });
  }

  // Insight C: High-priority Support Tickets
  const criticalCases = context.cases.filter(
    (c) =>
      c.status !== "resolved" &&
      c.status !== "closed" &&
      c.priority === "critical",
  );
  if (criticalCases.length > 0) {
    const c = criticalCases[0];
    const draft = draftSupportReply(c);
    insights.push({
      id: makeAiId("ins_case"),
      type: "support",
      severity: "critical",
      title: `💜 Phiếu hỗ trợ ưu tiên: ${c.title}`,
      description: `Phiếu hỗ trợ có mức ưu tiên cao và cần người phụ trách theo dõi bước tiếp theo.`,
      reasons: [
        "Mức ưu tiên khẩn cấp",
        "Trạng thái chưa được Giải quyết",
        "Cần xác nhận bước xử lý và lịch theo dõi tiếp theo",
      ],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Mở Phiếu hỗ trợ",
          actionType: "navigate",
          route: `/support/cases`,
        },
        {
          id: makeAiId("act"),
          label: "Soạn phản hồi chăm sóc",
          actionType: "copy",
          payload: draft,
        },
      ],
      relatedEntityType: "case",
      relatedEntityId: c.id,
      createdAt: new Date().toISOString(),
    });
  }

  // Fallback defaults if list is too dry
  if (insights.length === 0) {
    insights.push({
      id: makeAiId("ins_empty"),
      type: "summary",
      severity: "info",
      title: "😊 Không phát hiện tín hiệu rủi ro nghiệp vụ",
      description:
        "Dữ liệu vận hành CRM hiện tại rất đồng bộ và khỏe mạnh. Unicore AI khuyên bạn nên chăm sóc thêm các khách hàng tiềm năng mới được giao.",
      reasons: [
        "Không có cơ hội quá hạn",
        "Mọi báo giá hoạt động ổn định",
        "Không có Phiếu hỗ trợ ưu tiên cao đang chờ xử lý",
      ],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Xem danh sách khách hàng tiềm năng",
          actionType: "navigate",
          route: "/leads",
        },
      ],
      createdAt: new Date().toISOString(),
    });
  }

  return insights;
}

export function generateCustomerInsights(
  customer: CanonicalCustomer,
  context: AiContextWrapper,
): AiInsight[] {
  const focused =
    context.focusedItem?.entityType === "customer"
      ? context.focusedItem
      : undefined;
  const readModel = focused?.relatedItems?.readModel as
    Customer360ReadModel | undefined;
  const intelligence = focused?.relatedItems?.intelligence as
    CustomerRelationshipAssessment | undefined;
  if (!readModel || !intelligence || readModel.customer.id !== customer.id)
    return [];

  const sourceSignals = intelligence.signals.filter(
    (signal) => signal.kind !== "POSITIVE",
  );
  const selectedSignals =
    sourceSignals.length > 0
      ? sourceSignals.slice(0, 3)
      : intelligence.signals.slice(0, 1);
  return selectedSignals.map((signal) => ({
    id: `customer_signal_${customer.id}_${signal.id}`,
    type:
      signal.category === "SUPPORT"
        ? "support"
        : signal.category === "COMMERCIAL"
          ? "opportunity"
          : signal.kind === "RISK"
            ? "risk"
            : "priority",
    severity: signal.severity.toLowerCase() as AiInsight["severity"],
    title: signal.labelVi,
    description: signal.detailVi,
    reasons: signal.evidence.map((item) => item.factVi),
    suggestedActions: actionToSuggestedActions(
      signal.recommendedAction,
      customer.id,
      "vi",
    ),
    relatedEntityType: "customer",
    relatedEntityId: customer.id,
    createdAt: signal.lastChangedAt,
  }));
}

export function generateDealInsights(
  deal: Deal,
  context: AiContextWrapper,
): AiInsight[] {
  const insights: AiInsight[] = [];
  const risk =
    deal.expectedCloseDate &&
    new Date(deal.expectedCloseDate) < new Date() &&
    String(deal.stage).toUpperCase() !== "WON" &&
    String(deal.stage).toUpperCase() !== "LOST";

  if (risk) {
    insights.push({
      id: makeAiId("ins_d_risk"),
      type: "risk",
      severity: "high",
      title: `AI cảnh báo: Cơ hội trễ hạn`,
      description: `Giao dịch đã vượt qua ngày dự kiến hoàn thành đóng thầu (${new Date(deal.expectedCloseDate!).toLocaleDateString("vi-VN")}).`,
      reasons: [
        "Ngày mong muốn đóng đã quá khứ",
        "Nỗ lực tương tác đàm phán gần nhất bị giãn cách",
      ],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Soạn và gửi thông điệp hâm nóng",
          actionType: "copy",
          payload: draftDealNextStep(deal),
        },
      ],
      createdAt: new Date().toISOString(),
    });
  } else {
    insights.push({
      id: makeAiId("ins_d_ok"),
      type: "next_action",
      severity: "info",
      title: `AI kiến nghị hành động tiếp theo`,
      description: `Giao dịch đang tiến triển bình thường. Đề xuất của AI là chuẩn bị tài liệu hóa thuyết trình dự án hoặc mời khách đi cafe chốt tiến độ.`,
      reasons: ["Timeline cơ hội trong hạn cho phép"],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Xem báo giá",
          actionType: "navigate",
          route: "/quotes",
        },
      ],
      createdAt: new Date().toISOString(),
    });
  }

  return insights;
}

export function generateQuoteInsights(
  quote: Quote,
  context: AiContextWrapper,
): AiInsight[] {
  const insights: AiInsight[] = [];
  const isAccepted = quote.status === QuoteStatus.ACCEPTED;

  if (isAccepted) {
    insights.push({
      id: makeAiId("ins_q_action"),
      type: "opportunity",
      severity: "medium",
      title: `Remind: Tạo đơn hàng từ báo giá`,
      description:
        "Thỏa thuận thương thảo thầu đã được ký phê duyệt từ đối tác. Hệ thống đề xuất lập tức cấu tạo đơn hàng tương thích để vận hành giao dịch.",
      reasons: [
        "Báo giá đã ở trạng thái được chấp thuận",
        "Cần đồng bộ hóa để tính products owned dịch vụ",
      ],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Xem danh mục đơn hàng",
          actionType: "navigate",
          route: "/orders",
        },
      ],
      createdAt: new Date().toISOString(),
    });
  } else {
    insights.push({
      id: makeAiId("ins_q_reminder"),
      type: "next_action",
      severity: "low",
      title: `Hỗ trợ chuẩn bị thư nhắc duyệt báo giá`,
      description:
        "Báo giá nháp hoặc đã gửi đang chờ phê duyệt từ phía người dĩ quản đối tác. Soạn thảo email nhắc nhở để hối thúc chốt số thầu nhanh hơn.",
      reasons: ["Báo giá chưa chuyển trạng thái sang Accepted"],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Sao chép thư soạn nháp",
          actionType: "copy",
          payload: draftQuoteReminder(quote),
        },
      ],
      createdAt: new Date().toISOString(),
    });
  }

  return insights;
}

export function generateOrderInsights(
  order: CustomerOrder | any,
  context: AiContextWrapper,
): AiInsight[] {
  const insights: AiInsight[] = [];
  const isIncomplete =
    order.state !== "COMPLETED" && order.state !== "CANCELLED";

  if (isIncomplete) {
    insights.push({
      id: makeAiId("ins_o_incomplete"),
      type: "priority",
      severity: "medium",
      title: `Rà soát Hoàn tất Đơn hàng`,
      description: `Đơn hàng đang ở trạng thái "${order.state}". Khi đơn hàng được chuyển sang trạng thái Hoàn thành (completed), AI sẽ tự động đồng bộ hóa để tạo sản phẩm sở hữu cho hồ sơ khách hàng.`,
      reasons: [
        "Đơn hàng chưa kết đơn thanh toán / triển khai",
        "Sản phẩm của đối tác chưa kích hoạt trên hệ thống CRM",
      ],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Xem chi tiết đơn hàng",
          actionType: "navigate",
          route: "/orders",
        },
      ],
      createdAt: new Date().toISOString(),
    });
  } else {
    insights.push({
      id: makeAiId("ins_o_done"),
      type: "summary",
      severity: "info",
      title: `Đơn hàng đã hoàn thành`,
      description:
        "Đơn hàng của khách hàng này đã đóng sổ kế toán hoàn tất và bàn giao. Không có hành động khẩn cấp bổ sung.",
      reasons: ["Status completed"],
      suggestedActions: [],
      createdAt: new Date().toISOString(),
    });
  }

  return insights;
}

export function generateSupportCaseInsights(
  caseItem: SupportCase,
  context: AiContextWrapper,
): AiInsight[] {
  const insights: AiInsight[] = [];
  const open = caseItem.status !== "resolved" && caseItem.status !== "closed";
  const draft = draftSupportReply(caseItem);

  if (open) {
    insights.push({
      id: makeAiId("ins_sc_reply"),
      type: "support",
      severity: caseItem.priority === "critical" ? "critical" : "high",
      title: `AI đề xuất bản nháp trả lời ưu tiên`,
      description:
        "Gợi ý một phản hồi rõ ràng để xác nhận tình trạng và bước theo dõi tiếp theo với khách hàng.",
      reasons: [
        "Phiếu hỗ trợ đang mở",
        "Cần duy trì nhịp chăm sóc và thông tin minh bạch với khách hàng",
      ],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Sao chép thư soạn nháp",
          actionType: "copy",
          payload: draft,
        },
      ],
      createdAt: new Date().toISOString(),
    });
  }

  return insights;
}

export function generateReportSummary(context: AiContextWrapper): AiInsight[] {
  const pipelineValue = context.globalContext.totalPipelineValue;
  const weighted = context.globalContext.totalExpectedRevenue;
  const quotesCount = context.quotes.filter(
    (q) => q.status === QuoteStatus.SENT,
  ).length;

  return [
    {
      id: makeAiId("ins_rep_pipeline"),
      type: "forecast",
      severity: "info",
      title: "📊 Phân tích Pipeline từ AI",
      description: `Pipeline có trọng số đang đạt **${weighted.toLocaleString("vi-VN")} ₫**. Đang phân bổ chủ yếu ở giai đoạn Thương lượng.`,
      reasons: [
        "Sức khỏe pipeline đạt 82%",
        "Có cơ sở chuyển đổi tích cực trong quý",
      ],
      suggestedActions: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: makeAiId("ins_rep_quote"),
      type: "opportunity",
      severity: "medium",
      title: `📜 Khuyến nghị chốt số doanh số`,
      description: `Đang có **${quotesCount} báo giá đã gửi** nhưng chưa nhận được lệnh phản hồi. Nếu chuyển đổi thành công 50% sẽ đóng góp đáng kể cho chỉ số MRR kỳ này.`,
      reasons: [
        "Báo giá chờ phê duyệt thương thầu",
        "Tăng trưởng doanh thu bán hàng định kỳ liên kết",
      ],
      suggestedActions: [
        {
          id: makeAiId("act"),
          label: "Truy cập kho báo giá",
          actionType: "navigate",
          route: "/quotes",
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
}
