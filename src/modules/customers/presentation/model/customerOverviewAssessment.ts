import type { Customer360ReadModel } from "./customer360ReadModel";
import {
  buildNextActionEn,
  buildNextActionVi,
  buildSummaryEn,
  buildSummaryVi,
  clamp,
  compareSignals,
  dateMs,
} from "./customerAssessmentHelpers";
import { addReturnSignals } from "./customerAssessmentReturnSignals";
import type {
  CustomerAssessmentLevel,
  CustomerAssessmentSignal,
  CustomerAssessmentTrend,
  CustomerRelationshipAssessment,
  SignalDraft,
} from "./customerAssessment.types";

export type * from "./customerAssessment.types";

const DAY = 24 * 60 * 60 * 1000;
export function buildCustomerRelationshipAssessment(
  model: Customer360ReadModel,
  now: Date = new Date(),
): CustomerRelationshipAssessment {
  const nowMs = now.getTime();
  const signals: CustomerAssessmentSignal[] = [];
  let score = 72;

  const addSignal = (draft: SignalDraft) => {
    const evidenceTimes = draft.evidence
      .map((item) => item.occurredAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    const detectedAt =
      evidenceTimes[0] ?? model.customer.updatedAt ?? model.customer.createdAt;
    const lastChangedAt = evidenceTimes[evidenceTimes.length - 1] ?? detectedAt;
    signals.push({ ...draft, status: "ACTIVE", detectedAt, lastChangedAt });
    score += draft.impact;
  };

  // Manual health is treated as one source signal, not as the final computed health.
  if (model.customer.health === "GOOD") {
    addSignal({
      id: "declared-health-good",
      category: "RELATIONSHIP",
      kind: "POSITIVE",
      severity: "LOW",
      labelVi: "Sức khỏe quan hệ được đánh dấu tốt",
      labelEn: "Relationship health is marked good",
      detailVi: "Trạng thái do người dùng duy trì đang ở mức tốt.",
      detailEn: "The user-maintained health state is currently good.",
      impact: 5,
      evidence: [
        {
          sourceType: "CUSTOMER",
          recordId: model.customer.id,
          factVi: "Trạng thái sức khỏe = Tốt",
          factEn: "Health = GOOD",
          occurredAt: model.customer.updatedAt,
        },
      ],
    });
  } else if (model.customer.health === "WATCH") {
    addSignal({
      id: "declared-health-watch",
      category: "RELATIONSHIP",
      kind: "ATTENTION",
      severity: "MEDIUM",
      labelVi: "Khách hàng đang được đánh dấu cần theo dõi",
      labelEn: "Customer is marked for monitoring",
      detailVi:
        "Đây là trạng thái do người dùng duy trì và được dùng như một tín hiệu đầu vào.",
      detailEn: "This user-maintained state is used as one input signal.",
      impact: -6,
      evidence: [
        {
          sourceType: "CUSTOMER",
          recordId: model.customer.id,
          factVi: "Trạng thái sức khỏe = Cần theo dõi",
          factEn: "Health = WATCH",
          occurredAt: model.customer.updatedAt,
        },
      ],
    });
  } else {
    addSignal({
      id: "declared-health-risk",
      category: "RELATIONSHIP",
      kind: "RISK",
      severity: "HIGH",
      labelVi: "Khách hàng đang được đánh dấu rủi ro",
      labelEn: "Customer is marked at risk",
      detailVi:
        "Cần đối chiếu trạng thái thủ công với các bằng chứng vận hành hiện tại.",
      detailEn: "Compare the manual state with current operational evidence.",
      impact: -16,
      evidence: [
        {
          sourceType: "CUSTOMER",
          recordId: model.customer.id,
          factVi: "Trạng thái sức khỏe = Rủi ro",
          factEn: "Health = RISK",
          occurredAt: model.customer.updatedAt,
        },
      ],
    });
  }

  const activeSupport = model.supportCases.filter(
    (item) => !["resolved", "closed", "cancelled"].includes(item.status),
  );
  const breachedSupport = activeSupport.filter(
    (item) => item.slaStatus === "breached",
  );
  const atRiskSupport = activeSupport.filter(
    (item) => item.slaStatus === "at_risk",
  );
  const criticalSupport = activeSupport.filter(
    (item) => item.priority === "critical",
  );

  if (breachedSupport.length > 0) {
    const first = breachedSupport[0];
    addSignal({
      id: "support-sla-breached",
      category: "SUPPORT",
      kind: "RISK",
      severity: "CRITICAL",
      labelVi: `${breachedSupport.length} phiếu hỗ trợ vi phạm SLA`,
      labelEn: `${breachedSupport.length} support case(s) breached SLA`,
      detailVi:
        "Ưu tiên xử lý và cập nhật khách hàng trước khi rủi ro quan hệ tăng thêm.",
      detailEn:
        "Resolve and update the customer before relationship risk grows.",
      impact: -Math.min(36, breachedSupport.length * 18),
      evidence: breachedSupport
        .slice(0, 3)
        .map((item) => ({
          sourceType: "SUPPORT",
          recordId: item.id,
          factVi: `${item.title} · SLA breached`,
          factEn: `${item.title} · SLA breached`,
          occurredAt: item.updatedAt || item.createdAt,
        })),
      recommendedAction: {
        actionType: "OPEN_RECORD",
        labelVi: "Xử lý phiếu SLA",
        labelEn: "Resolve SLA case",
        targetModule: "support/cases",
        targetRecordId: first.id,
      },
    });
  } else if (atRiskSupport.length > 0 || criticalSupport.length > 0) {
    const first = atRiskSupport[0] ?? criticalSupport[0];
    addSignal({
      id: "support-sla-at-risk",
      category: "SUPPORT",
      kind: "ATTENTION",
      severity: "HIGH",
      labelVi: "Hỗ trợ cần chú ý",
      labelEn: "Support needs attention",
      detailVi: `${atRiskSupport.length} phiếu có nguy cơ SLA, ${criticalSupport.length} phiếu mức critical.`,
      detailEn: `${atRiskSupport.length} case(s) at SLA risk and ${criticalSupport.length} critical case(s).`,
      impact: -Math.min(
        20,
        atRiskSupport.length * 8 + criticalSupport.length * 6,
      ),
      evidence: [...atRiskSupport, ...criticalSupport]
        .slice(0, 3)
        .map((item) => ({
          sourceType: "SUPPORT",
          recordId: item.id,
          factVi: `${item.title} · ${item.slaStatus || item.priority}`,
          factEn: `${item.title} · ${item.slaStatus || item.priority}`,
          occurredAt: item.updatedAt || item.createdAt,
        })),
      recommendedAction: first
        ? {
            actionType: "OPEN_RECORD",
            labelVi: "Mở phiếu hỗ trợ",
            labelEn: "Open support case",
            targetModule: "support/cases",
            targetRecordId: first.id,
          }
        : undefined,
    });
  }

  const openTasks = model.tasks.filter((task) => task.status === "OPEN");
  const overdueTasks = openTasks.filter(
    (task) => new Date(task.dueAt).getTime() < nowMs,
  );
  const urgentTasks = openTasks.filter((task) => task.priority === "URGENT");
  if (overdueTasks.length > 0) {
    const first = [...overdueTasks].sort((left, right) =>
      left.dueAt.localeCompare(right.dueAt),
    )[0];
    addSignal({
      id: "overdue-work",
      category: "WORK",
      kind: "RISK",
      severity: overdueTasks.length >= 3 ? "CRITICAL" : "HIGH",
      labelVi: `${overdueTasks.length} công việc quá hạn`,
      labelEn: `${overdueTasks.length} overdue task(s)`,
      detailVi: "Công việc quá hạn làm giảm độ tin cậy của kế hoạch chăm sóc.",
      detailEn:
        "Overdue work reduces the reliability of the relationship plan.",
      impact: -Math.min(24, overdueTasks.length * 6),
      evidence: overdueTasks
        .slice(0, 3)
        .map((task) => ({
          sourceType: "TASK",
          recordId: task.id,
          factVi: `${task.title} · hạn ${task.dueAt}`,
          factEn: `${task.title} · due ${task.dueAt}`,
          occurredAt: task.updatedAt,
        })),
      recommendedAction: {
        actionType: "OPEN_RECORD",
        labelVi: "Xử lý việc quá hạn",
        labelEn: "Handle overdue task",
        targetModule: "tasks",
        targetRecordId: first.id,
      },
    });
  } else if (urgentTasks.length > 0) {
    const first = urgentTasks[0];
    addSignal({
      id: "urgent-work",
      category: "WORK",
      kind: "ATTENTION",
      severity: "HIGH",
      labelVi: `${urgentTasks.length} công việc khẩn cấp`,
      labelEn: `${urgentTasks.length} urgent task(s)`,
      detailVi: "Cần bảo đảm có người xử lý và thời hạn rõ ràng.",
      detailEn: "Ensure clear ownership and deadlines.",
      impact: -Math.min(12, urgentTasks.length * 4),
      evidence: urgentTasks
        .slice(0, 3)
        .map((task) => ({
          sourceType: "TASK",
          recordId: task.id,
          factVi: `${task.title} · URGENT`,
          factEn: `${task.title} · URGENT`,
          occurredAt: task.updatedAt,
        })),
      recommendedAction: {
        actionType: "OPEN_RECORD",
        labelVi: "Mở công việc khẩn",
        labelEn: "Open urgent task",
        targetModule: "tasks",
        targetRecordId: first.id,
      },
    });
  }

  const openDeals = model.deals.filter(
    (deal) => !["WON", "LOST"].includes(String(deal.stage).toUpperCase()),
  );
  const staleDeals = openDeals.filter((deal) => {
    const nextActionAt = dateMs(deal.nextActionAt);
    const closeAt = dateMs(deal.expectedCloseDate);
    return (
      (nextActionAt !== undefined && nextActionAt < nowMs) ||
      (closeAt !== undefined && closeAt < nowMs)
    );
  });
  if (staleDeals.length > 0) {
    const first = staleDeals[0];
    addSignal({
      id: "stale-opportunities",
      category: "COMMERCIAL",
      kind: "ATTENTION",
      severity: "MEDIUM",
      labelVi: `${staleDeals.length} cơ hội cần cập nhật`,
      labelEn: `${staleDeals.length} opportunity record(s) need updates`,
      detailVi: "Bước tiếp theo hoặc ngày đóng dự kiến đã quá hạn.",
      detailEn: "The next action or expected close date is overdue.",
      impact: -Math.min(21, staleDeals.length * 7),
      evidence: staleDeals
        .slice(0, 3)
        .map((deal) => ({
          sourceType: "DEAL",
          recordId: deal.id,
          factVi: `${deal.name} · cần cập nhật bước tiếp theo`,
          factEn: `${deal.name} · next action needs update`,
          occurredAt: deal.updatedAt || deal.createdAt,
        })),
      recommendedAction: {
        actionType: "OPEN_RECORD",
        labelVi: "Cập nhật cơ hội",
        labelEn: "Update opportunity",
        targetModule: "deals",
        targetRecordId: first.id,
      },
    });
  }

  addReturnSignals(model, addSignal);

  const lastPurchaseAt = dateMs(model.customer.lastPurchaseAt ?? undefined);
  if (lastPurchaseAt !== undefined) {
    const daysSincePurchase = Math.max(
      0,
      Math.floor((nowMs - lastPurchaseAt) / DAY),
    );
    if (daysSincePurchase > 365) {
      addSignal({
        id: "purchase-inactivity",
        category: "PURCHASE",
        kind: "ATTENTION",
        severity: "MEDIUM",
        labelVi: "Khoảng cách mua hàng kéo dài",
        labelEn: "Long purchase inactivity",
        detailVi: `Đã ${daysSincePurchase} ngày kể từ lần mua gần nhất.`,
        detailEn: `${daysSincePurchase} days have passed since the latest purchase.`,
        impact: -12,
        evidence: [
          {
            sourceType: "CUSTOMER",
            recordId: model.customer.id,
            factVi: `Lần mua gần nhất: ${model.customer.lastPurchaseAt}`,
            factEn: `Latest purchase: ${model.customer.lastPurchaseAt}`,
            occurredAt: model.customer.lastPurchaseAt ?? undefined,
          },
        ],
        recommendedAction: {
          actionType: "CREATE_CARE",
          labelVi: "Tạo hoạt động tái kết nối",
          labelEn: "Create re-engagement activity",
        },
      });
    } else if (daysSincePurchase <= 90) {
      score += 7;
    }
  }

  const completedOrders = model.orders.filter(
    (order) => order.state === "COMPLETED",
  );
  if (completedOrders.length >= 3) score += 6;
  else if (completedOrders.length > 0) score += 3;

  const nextCareAt = dateMs(model.customer.nextCareAt);
  if (nextCareAt !== undefined && nextCareAt < nowMs) {
    addSignal({
      id: "care-overdue",
      category: "WORK",
      kind: "ATTENTION",
      severity: "MEDIUM",
      labelVi: "Mốc chăm sóc tiếp theo đã quá hạn",
      labelEn: "Next care checkpoint is overdue",
      detailVi: "Cần tạo hoặc cập nhật công việc chăm sóc kế tiếp.",
      detailEn: "Create or update the next customer-care task.",
      impact: -10,
      evidence: [
        {
          sourceType: "CUSTOMER",
          recordId: model.customer.id,
          factVi: `Mốc chăm sóc tiếp theo: ${model.customer.nextCareAt}`,
          factEn: `Next care: ${model.customer.nextCareAt}`,
          occurredAt: model.customer.nextCareAt,
        },
      ],
      recommendedAction: {
        actionType: "CREATE_CARE",
        labelVi: "Tạo mốc chăm sóc",
        labelEn: "Create care checkpoint",
      },
    });
  }

  const lastTimelineAt = model.timeline[0]?.occurredAt
    ? dateMs(model.timeline[0].occurredAt)
    : undefined;
  if (lastTimelineAt !== undefined) {
    const daysSinceActivity = Math.max(
      0,
      Math.floor((nowMs - lastTimelineAt) / DAY),
    );
    if (daysSinceActivity <= 30) score += 5;
    else if (daysSinceActivity > 120) {
      addSignal({
        id: "relationship-silence",
        category: "RELATIONSHIP",
        kind: "ATTENTION",
        severity: "MEDIUM",
        labelVi: "Tương tác bị gián đoạn",
        labelEn: "Relationship activity has gone quiet",
        detailVi: `Không có tương tác mới trong ${daysSinceActivity} ngày.`,
        detailEn: `No new interaction for ${daysSinceActivity} days.`,
        impact: -8,
        evidence: [
          {
            sourceType: model.timeline[0].kind,
            recordId: model.timeline[0].id,
            factVi: `Hoạt động gần nhất cách đây ${daysSinceActivity} ngày`,
            factEn: `Latest activity was ${daysSinceActivity} days ago`,
            occurredAt: model.timeline[0].occurredAt,
          },
        ],
        recommendedAction: {
          actionType: "CREATE_TASK",
          labelVi: "Tạo tương tác tiếp theo",
          labelEn: "Create next interaction",
        },
      });
    }
  }

  if (model.customer.type === "B2B" && !model.identity.primaryContact) {
    addSignal({
      id: "missing-primary-contact",
      category: "RELATIONSHIP",
      kind: "RISK",
      severity: "HIGH",
      labelVi: "Thiếu liên hệ chính",
      labelEn: "Missing primary contact",
      detailVi:
        "Khách hàng B2B chưa có người liên hệ đại diện chính để duy trì quan hệ.",
      detailEn:
        "The B2B Customer has no primary Contact for relationship continuity.",
      impact: -16,
      evidence: [
        {
          sourceType: "ORGANIZATION",
          recordId: model.customer.relationshipRef.id,
          factVi: "Chưa xác định người liên hệ chính",
          factEn: "No primary Contact is defined",
          occurredAt: model.customer.updatedAt,
        },
      ],
      recommendedAction: {
        actionType: "OPEN_CUSTOMER_TAB",
        labelVi: "Quản lý liên hệ",
        labelEn: "Manage contacts",
        customerTab: "contacts",
      },
    });
  }

  score = clamp(Math.round(score), 0, 100);
  const level =
    score >= 80
      ? "HEALTHY"
      : score >= 60
        ? "WATCH"
        : score >= 40
          ? "RISK"
          : "CRITICAL";
  const negativeImpact = signals
    .filter((signal) => signal.impact < 0)
    .reduce((sum, signal) => sum + Math.abs(signal.impact), 0);
  const positiveAdjustment = Math.max(0, score - 72);
  const trend: CustomerAssessmentTrend =
    negativeImpact >= positiveAdjustment + 16
      ? "DECLINING"
      : positiveAdjustment >= negativeImpact + 12
        ? "IMPROVING"
        : "STABLE";
  const coverageSources = [
    model.timeline.length > 0,
    model.orders.length > 0 || model.purchaseEvidence.length > 0,
    model.tasks.length > 0,
    model.supportCases.length > 0,
    model.deals.length > 0,
    model.identity.contacts.length > 0,
    model.returns.length > 0,
  ].filter(Boolean).length;
  const confidence = clamp(48 + coverageSources * 7, 48, 96);

  const sortedSignals = [...signals].sort(compareSignals);
  const primarySignal =
    sortedSignals.find((signal) => signal.kind !== "POSITIVE") ??
    sortedSignals[0];
  const nextActionVi =
    primarySignal?.recommendedAction?.labelVi ??
    buildNextActionVi(primarySignal?.id, model);
  const nextActionEn =
    primarySignal?.recommendedAction?.labelEn ??
    buildNextActionEn(primarySignal?.id, model);

  return {
    score,
    confidence,
    level,
    trend,
    summaryVi: buildSummaryVi(level, sortedSignals),
    summaryEn: buildSummaryEn(level, sortedSignals),
    nextActionVi,
    nextActionEn,
    primaryAction: primarySignal?.recommendedAction,
    signals: sortedSignals.slice(0, 6),
  };
}
