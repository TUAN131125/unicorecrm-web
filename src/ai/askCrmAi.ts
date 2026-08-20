import type { AiChatMessage, AiSuggestedAction } from "./aiTypes";
import type { AiContextWrapper } from "./aiContextBuilder";
import { QuoteStatus } from "@/modules/quotes";
import type { SupportCase } from "@/modules/support";
import {
  buildCustomer360ReadModel,
  buildCustomerRelationshipAssessment,
} from "@/modules/customers";
import { draftSupportReply } from "./aiMessageDrafts";
import { answerFocusedCustomerQuestion, buildFocusedCustomerSummary } from "./focusedCustomerAi";
import { makeAiId } from "./aiMockEngine.shared";

const supportPriorityLabelVi = (priority?: string): string => ({
  low: "thấp",
  medium: "trung bình",
  high: "cao",
  critical: "khẩn cấp",
}[String(priority || "").toLowerCase()] || priority || "bình thường");

export function askCrmAi(
  question: string,
  context: AiContextWrapper,
): AiChatMessage {
  const qClean = question.trim().toLowerCase();
  const lang =
    qClean.includes("khách hàng") ||
    qClean.includes("cơ hội") ||
    qClean.includes("đơn hàng") ||
    qClean.includes("báo giá") ||
    qClean.includes("phiếu") ||
    qClean.includes("hôm nay") ||
    qClean.includes("tóm tắt")
      ? "vi"
      : "en";

  const assistantMessage = (
    content: string,
    actions: AiSuggestedAction[] = [],
  ): AiChatMessage => ({
    id: makeAiId("as"),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    suggestedActions: actions,
  });

  const focusedCustomerReply = answerFocusedCustomerQuestion(
    qClean,
    lang,
    context,
    assistantMessage,
  );
  if (focusedCustomerReply) return focusedCustomerReply;

  // Pattern 1: WORK PRIORITIZATION TODAY (Hôm nay nên làm gì / What should I work on today)
  if (
    qClean.includes("hôm nay") ||
    qClean.includes("nhất ngày") ||
    qClean.includes("làm gì") ||
    qClean.includes("attention") ||
    qClean.includes("priority") ||
    qClean.includes("work on today")
  ) {
    const overdueDeals = context.deals.filter((d) => {
      if (!d.expectedCloseDate) return false;
      return (
        new Date(d.expectedCloseDate) < new Date() &&
        String(d.stage).toUpperCase() !== "WON" &&
        String(d.stage).toUpperCase() !== "LOST"
      );
    });
    const subCases = context.cases.filter(
      (c) =>
        c.status !== "resolved" &&
        c.status !== "closed" &&
        c.priority === "critical",
    );
    const sentQuotes = context.quotes.filter(
      (q) => q.status === QuoteStatus.SENT,
    );

    let textVi = `### 📋 Đầu việc ưu tiên xử lý hôm nay:\n\n`;
    let textEn = `### 📋 Priority tasks for today:\n\n`;

    const actions: AiSuggestedAction[] = [];

    if (overdueDeals.length > 0) {
      const d = overdueDeals[0];
      textVi += `- ⚠️ **Bán hàng**: Cơ hội **${d.name}** đã quá hạn đóng hợp đồng (${new Date(d.expectedCloseDate!).toLocaleDateString("vi-VN")}). Cần liên hệ cập nhật tiến độ.\n`;
      textEn += `- ⚠️ **Sales**: Deal **${d.name}** has exceeded its expected close date (${new Date(d.expectedCloseDate!).toLocaleDateString()}). Update is required.\n`;
      actions.push({
        id: makeAiId("sa"),
        label: lang === "vi" ? `Mở cơ hội: ${d.name}` : `View Deal: ${d.name}`,
        actionType: "navigate",
        route: `/deals/${d.id}`,
      });
    } else {
      textVi += `- ✅ **Bán hàng**: Không có cơ hội bán hàng nào bị trễ hạn chốt hiện tại.\n`;
      textEn += `- ✅ **Sales**: No expired deals in your current pipe.\n`;
    }

    if (subCases.length > 0) {
      const c = subCases[0];
      textVi += `- 💜 **Chăm sóc khách hàng**: Phiếu **${c.caseNumber || `#CS-${c.id.substring(0, 4)}`}** - "${c.title}" đang ở mức ưu tiên ${supportPriorityLabelVi(c.priority)} và cần người phụ trách xử lý.\n`;
      textEn += `- 💜 **Customer care**: Support Ticket **${c.caseNumber || `#CS-${c.id.substring(0, 4)}`}** - "${c.title}" is ${c.priority} priority and needs owner attention.\n`;
      actions.push({
        id: makeAiId("sa"),
        label:
          lang === "vi"
            ? `Mở Phiếu hỗ trợ ${c.caseNumber || `#CS-${c.id.substring(0, 4)}`}`
            : `Open Support Ticket ${c.caseNumber || `#CS-${c.id.substring(0, 4)}`}`,
        actionType: "navigate",
        route: `/support/cases`,
      });
    }

    const acceptedQuotes = context.quotes.filter(
      (q) => q.status === QuoteStatus.ACCEPTED,
    );
    if (acceptedQuotes.length > 0) {
      const q = acceptedQuotes[0];
      textVi += `- 📜 **Báo giá**: Báo giá **${q.quoteNumber || q.id.substring(0, 4)}** đã được phê duyệt nhưng chưa có đơn hàng liên kết. Hãy xúc tiến lệnh dịch vụ.\n`;
      textEn += `- 📜 **Quotes**: Accepted quote **${q.quoteNumber || q.id.substring(0, 4)}** lacks an associated purchase order. Prompt follow-up requested.\n`;
      actions.push({
        id: makeAiId("sa"),
        label: lang === "vi" ? "Xem danh sách báo giá" : "View quote book",
        actionType: "navigate",
        route: "/quotes",
      });
    }

    textVi += `\n*Hãy nhấp vào các liên kết hành động bên dưới để truy cập nhanh hồ sơ chi tiết!*`;
    textEn += `\n*Select any recommendation below to navigate directly to the record.*`;

    return assistantMessage(lang === "vi" ? textVi : textEn, actions);
  }

  // Pattern 2: DEAL RISKS (Cơ hội nào có rủi ro cao / Which deals are risky)
  if (
    qClean.includes("rủi ro") ||
    qClean.includes("risky") ||
    qClean.includes("risk")
  ) {
    const risky = context.deals.filter((d) => {
      const isPast =
        d.expectedCloseDate && new Date(d.expectedCloseDate) < new Date();
      const isNegotiationAndOld =
        String(d.stage).toUpperCase() === "NEGOTIATION" &&
        (d.amount || 0) > 100000000;
      return (
        String(d.stage).toUpperCase() !== "WON" &&
        String(d.stage).toUpperCase() !== "LOST" &&
        (isPast || isNegotiationAndOld)
      );
    });

    if (risky.length === 0) {
      return assistantMessage(
        lang === "vi"
          ? "🌟 Tuyệt vời! Unicore AI không phát hiện rủi ro nghiêm trọng nào trong quy trình bán hàng hiện tại của bạn."
          : "🌟 Fantastic! No major high-risk deals were flagged in your active sales pipeline.",
      );
    }

    const actions = risky.slice(0, 2).map((r) => ({
      id: makeAiId("sa"),
      label: lang === "vi" ? `Xem cơ hội: ${r.name}` : `Inspect ${r.name}`,
      actionType: "navigate" as const,
      route: `/deals/${r.id}`,
    }));

    let text =
      lang === "vi"
        ? `### 🔍 AI rà soát rủi ro pipeline:\nPhát hiện **${risky.length}** cơ hội đang gặp tín hiệu bất thường:\n\n`
        : `### 🔍 Pipeline Risk Auditer:\nFound **${risky.length}** active sales opportunities with critical flags:\n\n`;

    risky.slice(0, 3).forEach((r) => {
      const daysOverdue = r.expectedCloseDate
        ? Math.ceil(
            (Date.now() - new Date(r.expectedCloseDate).getTime()) / 86400000,
          )
        : 0;
      if (lang === "vi") {
        text += `- **${r.name}** (Trị giá: ${r.amount?.toLocaleString("vi-VN")} ₫) - **Rủi ro cao**: Quá ngày đóng dự kiến **${daysOverdue} ngày**. Giai đoạn hiện tại: ${r.stage}.\n`;
      } else {
        text += `- **${r.name}** (Value: ${r.amount?.toLocaleString()} ₫) - **High Risk**: Expired by **${daysOverdue} days** with sluggish momentum at stage ${r.stage}.\n`;
      }
    });

    return assistantMessage(text, actions);
  }

  // Pattern 3: REVENUE/PIPELINE SUMMARY (Tóm tắt doanh thu và pipeline)
  if (
    qClean.includes("pipeline") ||
    qClean.includes("tóm tắt pipeline") ||
    qClean.includes("doanh thu") ||
    qClean.includes("revenue") ||
    qClean.includes("summarize pipeline")
  ) {
    const totalRaw = context.globalContext.totalPipelineValue;
    const totalWeighted = context.globalContext.totalExpectedRevenue;
    const closedWonValue = context.deals
      .filter((d) => String(d.stage).toUpperCase() === "WON")
      .reduce((s, d) => s + (d.amount || 0), 0);

    const textVi =
      `### 📊 Phân tích Pipeline và Doanh thu doanh nghiệp:\n\n` +
      `- 💎 **Tổng giá trị Pipeline**: **${totalRaw.toLocaleString("vi-VN")} ₫** (chưa bao gồm các cơ hội đã chốt).\n` +
      `- 🎯 **Dự báo có trọng số (Weighted Forecast)**: **${totalWeighted.toLocaleString("vi-VN")} ₫** (chiết khấu theo xác suất của từng giai đoạn).\n` +
      `- 🎉 **Doanh thu thực đạt (Won Revenue)**: **${closedWonValue.toLocaleString("vi-VN")} ₫** từ các giao dịch thành công.\n` +
      `- 📞 **Mẹo AI**: Pipeline đang tập trung 70% ở giai đoạn Thương lượng (Negotiation) và Báo giá. Hãy tập trung chăm sóc các khách hàng có báo giá thầu lớn để chốt số thành công.\n\n` +
      `AI kiến nghị bạn theo dõi sát các Báo giá đang chờ duyệt.`;

    const textEn =
      `### 📊 Sales Forecasting & Pipeline Analysis:\n\n` +
      `- 💎 **Unweighted Pipeline value**: **${totalRaw.toLocaleString()} ₫** (excluding closed items).\n` +
      `- 🎯 **AI Weighted Predictor**: **${totalWeighted.toLocaleString()} ₫** (adjusted by progressive probability metrics).\n` +
      `- 🎉 **Actual Booked Revenue**: **${closedWonValue.toLocaleString()} ₫** in Closed Won transactions.\n` +
      `- 💡 **AI Core Insight**: 70% of your current pipeline values are stuck in negotiation. Accelerate approvals by issuing custom terms.\n\n` +
      `We recommend reviewing pending quotes.`;

    return assistantMessage(lang === "vi" ? textVi : textEn, [
      {
        id: makeAiId("sa"),
        label: lang === "vi" ? "Mở báo cáo sales" : "Open Revenue Dashboard",
        actionType: "navigate",
        route: "/reports",
      },
    ]);
  }

  // Pattern 4: SPECIFIC CUSTOMER ATTENTION (Khách hàng nào cần ưu tiên hôm nay / Which customers need attention)
  if (
    qClean.includes("khách hàng") &&
    (qClean.includes("ưu tiên") ||
      qClean.includes("risky") ||
      qClean.includes("risk") ||
      qClean.includes("attention"))
  ) {
    const rankedCustomers = context.customers
      .map((record) => {
        const readModel = buildCustomer360ReadModel(record);
        const intelligence = buildCustomerRelationshipAssessment(readModel);
        const topSignal = intelligence.signals.find(
          (signal) => signal.kind !== "POSITIVE",
        );
        return { record, readModel, intelligence, topSignal };
      })
      .filter((item) => item.topSignal)
      .sort((left, right) => left.intelligence.score - right.intelligence.score)
      .slice(0, 3);

    if (rankedCustomers.length === 0) {
      return assistantMessage(
        lang === "vi"
          ? "Không có khách hàng nào đang có tín hiệu bất thường cần ưu tiên."
          : "No Customer currently has an abnormal signal that needs priority.",
      );
    }

    let text =
      lang === "vi"
        ? `### 👥 Khách hàng cần ưu tiên theo tín hiệu thực tế:\n`
        : `### 👥 Customers prioritized by current evidence:\n`;
    const actions: AiSuggestedAction[] = [];

    rankedCustomers.forEach(
      ({ record, readModel, intelligence, topSignal }) => {
        text +=
          lang === "vi"
            ? `- **${readModel.identity.displayName}** · ${intelligence.score}/100 — **${topSignal!.labelVi}**. ${topSignal!.detailVi}\n`
            : `- **${readModel.identity.displayName}** · ${intelligence.score}/100 — **${topSignal!.labelEn}**. ${topSignal!.detailEn}\n`;
        actions.push({
          id: makeAiId("sa"),
          label:
            lang === "vi"
              ? `Mở hồ sơ khách hàng: ${readModel.identity.displayName}`
              : `Open Customer 360: ${readModel.identity.displayName}`,
          actionType: "navigate",
          route: `/customers/${record.id}`,
        });
      },
    );

    return assistantMessage(text, actions);
  }

  // Pattern 5: QUOTES PREP (Báo giá nào nên theo dõi / accepted quote reminder / which quotes)
  if (qClean.includes("báo giá") || qClean.includes("quote")) {
    const pendingQuotes = context.quotes.filter(
      (q) => q.status === QuoteStatus.SENT,
    );
    const acceptedNoOrder = context.quotes.filter(
      (q) => q.status === QuoteStatus.ACCEPTED,
    );

    let text =
      lang === "vi"
        ? `### 📄 Rà soát hiệu lực báo giá:\n\n`
        : `### 📄 Sales Quote Health Audit:\n\n`;
    const actions: AiSuggestedAction[] = [];

    if (acceptedNoOrder.length > 0) {
      const q = acceptedNoOrder[0];
      text +=
        lang === "vi"
          ? `- 🌟 **Báo giá đã được chấp thuận**: Báo giá **${q.quoteNumber || q.id}** của khách hàng đã ĐỒNG Ý nhưng chưa tạo đơn hàng. Hãy sớm hoàn tất để tính sản phẩm sở hữu.\n`
          : `- 🌟 **Accepted & Unbilled**: Quote **${q.quoteNumber || q.id}** was accepted but lacks a registered Client Order. Finalize transaction now.\n`;

      actions.push({
        id: makeAiId("sa"),
        label: lang === "vi" ? "Xem báo giá" : "Goto Quote",
        actionType: "navigate",
        route: `/quotes/${q.id}`,
      });
    }

    if (pendingQuotes.length > 0) {
      const q = pendingQuotes[0];
      text +=
        lang === "vi"
          ? `- ⏳ **Đang gửi khách hàng**: Báo giá **${q.quoteNumber || q.id}** sắp quá hạn phản hồi. Hãy sử dụng thư nhắc nhở.\n`
          : `- ⏳ **Awaiting Client Signoff**: Quote **${q.quoteNumber || q.id}** has been sent but remains unapproved. Prepare terms follow-up.\n`;
    }

    return assistantMessage(text, actions);
  }

  // Pattern 6: ORDER SUCCESS (Đơn hàng nào cần hoàn tất)
  if (qClean.includes("đơn hàng") || qClean.includes("order")) {
    const incompleteOrders = context.orders.filter(
      (o) => o.state === "CONFIRMED",
    );
    if (incompleteOrders.length === 0) {
      return assistantMessage(
        lang === "vi"
          ? "Không có đơn hàng nào chờ xử lý thanh toán hay hoàn tất dịch vụ."
          : "All registered customer orders are completed.",
      );
    }

    let text =
      lang === "vi"
        ? `### 📦 Đơn hàng đề xuất hoàn tất:\n\n`
        : `### 📦 Pending Order Fulfilment Guidelines:\n\n`;
    const actions: AiSuggestedAction[] = [];

    incompleteOrders.slice(0, 2).forEach((o) => {
      text +=
        lang === "vi"
          ? `- **Đơn hàng ${o.orderNumber || o.id.substring(0, 5)}** (Tổng cộng: ${o.totalAmount?.toLocaleString("vi-VN")} ₫) trạng thái **${o.state === "CONFIRMED" ? "Chờ duyệt" : "Đang xử lý"}**. Có thể bấm Hoàn tất để kích hoạt danh sách sản phẩm sở hữu của khách hàng.\n`
          : `- **Order ${o.orderNumber || o.id.substring(0, 5)}** (Total: ${o.totalAmount?.toLocaleString()} ₫) marked as **${o.state}**. Mark fulfilled once provisioned.\n`;

      actions.push({
        id: makeAiId("sa"),
        label:
          lang === "vi"
            ? `Mở đơn ${o.orderNumber || o.id.substring(0, 5)}`
            : `Open Order`,
        actionType: "navigate",
        route: `/orders`,
      });
    });

    return assistantMessage(text, actions);
  }

  // Pattern 7: CARE CASES (customer-care follow-up / priority)
  if (
    qClean.includes("phiếu chăm sóc") ||
    qClean.includes("phiếu hỗ trợ") ||
    qClean.includes("ticket") ||
    qClean.includes("hỗ trợ") ||
    qClean.includes("support")
  ) {
    const careNeedingAttention = context.cases.filter(
      (c) =>
        c.status !== "resolved" &&
        c.status !== "closed" &&
        (c.priority === "critical" || c.priority === "high"),
    );

    if (careNeedingAttention.length === 0) {
      return assistantMessage(
        lang === "vi"
          ? "Không có Phiếu hỗ trợ ưu tiên cao nào đang cần xử lý."
          : "No high-priority Support Tickets currently need attention.",
      );
    }

    let text =
      lang === "vi"
        ? `### 💜 Phiếu hỗ trợ cần chú ý:\n\n`
        : `### 💜 Support Tickets needing attention:\n\n`;
    const actions: AiSuggestedAction[] = [];

    careNeedingAttention.slice(0, 2).forEach((c) => {
      text +=
        lang === "vi"
          ? `- **${c.caseNumber || `#CS-${c.id.substring(0, 4)}`}**: "${c.title}" - **Mức ưu tiên ${supportPriorityLabelVi(c.priority)}**. ${c.nextFollowUpAt ? `Hẹn tiếp: ${new Date(c.nextFollowUpAt).toLocaleString("vi-VN")}.` : "Chưa có lịch theo dõi tiếp theo."}\n`
          : `- **${c.caseNumber || `#CS-${c.id.substring(0, 4)}`}**: "${c.title}" - **${c.priority} priority**. ${c.nextFollowUpAt ? `Next follow-up: ${new Date(c.nextFollowUpAt).toLocaleString()}.` : "No next follow-up is scheduled."}\n`;
    });

    actions.push({
      id: makeAiId("sa"),
      label: lang === "vi" ? "Mở Phiếu hỗ trợ" : "Open Support Tickets",
      actionType: "navigate",
      route: "/support/cases",
    });

    return assistantMessage(text, actions);
  }

  // Pattern 8: RECORD FOCUS SUMMARIZATION (Customer / Support Ticket)
  if (qClean.includes("tóm tắt")) {
    const focused = context.focusedItem;
    if (!focused) {
      return assistantMessage(
        lang === "vi"
          ? "ℹ️ Hiện tại bạn chưa lựa chọn hồ sơ cụ thể nào. Hãy mở trang chi tiết một Khách hàng, Cơ hội hoặc Phiếu hỗ trợ, sau đó yêu cầu AI tóm tắt."
          : "ℹ️ No record context is currently focused. Open a Customer, Deal, or Support Ticket detail page, then try this query.",
      );
    }

    if (focused.entityType === "customer") {
      const customerReply = buildFocusedCustomerSummary(
        lang,
        context,
        assistantMessage,
      );
      if (customerReply) return customerReply;
    }

    if (focused.entityType === "case") {
      const sc = focused.data as SupportCase;
      const replyDraft = draftSupportReply(sc);
      const summary =
        lang === "vi"
          ? `### 💜 Tóm tắt Phiếu hỗ trợ: **${sc.caseNumber || `#CS-${sc.id.substring(0, 4)}`}**\n` +
            `- **Tiêu đề**: "${sc.title}"\n` +
            `- **Loại chăm sóc**: ${sc.category || "Yêu cầu"} | **Mức ưu tiên**: ${supportPriorityLabelVi(sc.priority)}\n` +
            `- **Khách hàng**: ${sc.customerName || sc.customerId}\n` +
            `- **Trạng thái xử lý**: ${sc.status}\n` +
            `- **Khuyến nghị**: Xác nhận bước xử lý tiếp theo và lịch theo dõi với khách hàng.`
          : `### 💜 Support Ticket Summary: **${sc.caseNumber || `#CS-${sc.id.substring(0, 4)}`}**\n` +
            `- **Subject**: "${sc.title}"\n` +
            `- **Classification**: ${sc.category || "General Inquiry"} | **Priority**: ${sc.priority}\n` +
            `- **Reporter**: Client Ref ${sc.customerId}\n` +
            `- **State**: ${sc.status}\n` +
            `- **AI Suggested Next Step**: Confirm the next action and follow-up schedule with the customer.`;

      return assistantMessage(summary, [
        {
          id: makeAiId("sa"),
          label:
            lang === "vi" ? "Sao chép phản hồi nháp" : "Copy Care Reply Draft",
          actionType: "copy",
          payload: replyDraft,
        },
      ]);
    }
  }

  // DEFAULT REPLY if no matched phrases
  const defaultVi =
    "🤖 Xin lỗi, tôi chưa giải mã được câu hỏi này. Bạn hãy thử click chọn các nút gợi ý hỏi nhanh ở dưới hoặc hỏi về các đề mục chính như: 'hôm nay nên làm gì', 'cơ hội rủi ro', 'báo giá theo dõi', 'tóm tắt' nhé!";
  const defaultEn =
    "🤖 Hello, Unicore AI is currently simulated inside your web browser. Try using the dynamic prompt chips below or asking specific queries like: 'what should I work on today', 'risky deals', 'summarize pipeline', or 'summarize this customer'.";

  return assistantMessage(lang === "vi" ? defaultVi : defaultEn);
}
