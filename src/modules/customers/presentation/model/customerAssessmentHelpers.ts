import type { Customer360ReadModel } from "./customer360ReadModel";
import type {
  CustomerAssessmentLevel,
  CustomerAssessmentSignal,
  CustomerAssessmentSignalKind,
  CustomerAssessmentSignalSeverity,
} from "./customerAssessment.types";

export function compareSignals(
  left: CustomerAssessmentSignal,
  right: CustomerAssessmentSignal,
): number {
  const kindRank: Record<CustomerAssessmentSignalKind, number> = {
    RISK: 0,
    ATTENTION: 1,
    POSITIVE: 2,
  };
  const severityRank: Record<CustomerAssessmentSignalSeverity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };
  return (
    kindRank[left.kind] - kindRank[right.kind] ||
    severityRank[left.severity] - severityRank[right.severity] ||
    Math.abs(right.impact) - Math.abs(left.impact)
  );
}

export function buildSummaryVi(
  level: CustomerAssessmentLevel,
  signals: CustomerAssessmentSignal[],
): string {
  const activeRisks = signals.filter((signal) => signal.kind !== "POSITIVE");
  if (activeRisks.length === 0)
    return "Chưa có tín hiệu bất thường cần ưu tiên từ dữ liệu quan hệ hiện tại.";
  const categories = [
    ...new Set(activeRisks.slice(0, 3).map((signal) => categoryLabelVi(signal.category))),
  ].join(", ");
  if (level === "CRITICAL")
    return `Quan hệ đang ở mức cảnh báo cao. Ưu tiên xử lý tín hiệu ${categories} trước khi mở rộng hoạt động thương mại.`;
  if (level === "RISK")
    return `Có tín hiệu ảnh hưởng trực tiếp đến quan hệ ở nhóm ${categories}; cần xác định người xử lý và thời hạn rõ ràng.`;
  if (level === "WATCH")
    return `Quan hệ nhìn chung ổn nhưng có tín hiệu ${categories} cần được theo dõi và xử lý sớm.`;
  return `Quan hệ đang khỏe; vẫn còn tín hiệu ${categories} cần giữ trong nhịp theo dõi.`;
}

export function buildSummaryEn(
  level: CustomerAssessmentLevel,
  signals: CustomerAssessmentSignal[],
): string {
  const activeRisks = signals.filter((signal) => signal.kind !== "POSITIVE");
  if (activeRisks.length === 0)
    return "No abnormal priority signal is currently detected from relationship data.";
  const categories = [
    ...new Set(activeRisks.slice(0, 3).map((signal) => categoryLabelEn(signal.category))),
  ].join(", ");
  if (level === "CRITICAL")
    return `The relationship is at high alert. Resolve ${categories} signals before expanding commercial activity.`;
  if (level === "RISK")
    return `Signals in ${categories} are directly affecting the relationship and need clear ownership and deadlines.`;
  if (level === "WATCH")
    return `The relationship is generally stable, but ${categories} signals need early attention.`;
  return `The relationship is healthy; keep ${categories} signals within the monitoring rhythm.`;
}

export function buildNextActionVi(
  signalId: string | undefined,
  model: Customer360ReadModel,
): string {
  switch (signalId) {
    case "support-sla-breached":
      return "Xử lý phiếu hỗ trợ vi phạm SLA và cập nhật khách hàng ngay trong ngày.";
    case "return-resolution-failed":
      return "Xử lý lỗi refund hoặc vận chuyển của yêu cầu đổi/trả trước khi thực hiện bước tiếp theo.";
    case "return-received-unresolved":
      return "Hoàn tất phương án xử lý cho yêu cầu đổi/trả đã nhận hàng.";
    case "return-awaiting-decision":
      return "Đánh giá điều kiện và ra quyết định cho yêu cầu đổi/trả đang chờ.";
    case "missing-primary-contact":
      return "Xác định người liên hệ đại diện chính trước khi tiếp tục quy trình bán hàng B2B.";
    case "overdue-work":
      return "Rà soát công việc quá hạn, xác nhận người xử lý và đặt lại thời hạn phù hợp.";
    case "care-overdue":
      return "Tạo mốc chăm sóc tiếp theo và giao công việc cho người chịu trách nhiệm.";
    case "stale-opportunities":
      return "Cập nhật bước tiếp theo của cơ hội đang mở và xác nhận hành động thương mại kế tiếp.";
    case "purchase-inactivity":
      return "Tạo hoạt động tái kết nối dựa trên lịch sử sản phẩm và lần mua gần nhất.";
    case "relationship-silence":
      return "Chủ động tạo một tương tác mới và ghi lại kết quả vào dòng hoạt động.";
    default:
      return (model.metrics.openDealCount ?? 0) > 0
        ? "Duy trì bước tiếp theo cho các cơ hội đang mở và theo dõi công việc chăm sóc."
        : "Duy trì nhịp chăm sóc và theo dõi các ngoại lệ mới.";
  }
}

export function buildNextActionEn(
  signalId: string | undefined,
  model: Customer360ReadModel,
): string {
  switch (signalId) {
    case "support-sla-breached":
      return "Resolve the breached support case and update the customer today.";
    case "return-resolution-failed":
      return "Resolve the failed refund or shipping action before the return proceeds.";
    case "return-received-unresolved":
      return "Complete the resolution for the received return request.";
    case "return-awaiting-decision":
      return "Evaluate eligibility and decide the pending return request.";
    case "missing-primary-contact":
      return "Identify the primary Contact before continuing the B2B sales process.";
    case "overdue-work":
      return "Review overdue work, confirm ownership and reset realistic deadlines.";
    case "care-overdue":
      return "Create the next care checkpoint and assign a Task to a responsible person.";
    case "stale-opportunities":
      return "Update the next action for open opportunities and confirm the next commercial step.";
    case "purchase-inactivity":
      return "Create a re-engagement activity based on product and purchase history.";
    case "relationship-silence":
      return "Create a new interaction and record the outcome in the timeline.";
    default:
      return (model.metrics.openDealCount ?? 0) > 0
        ? "Maintain next-action discipline across the pipeline and monitor open care work."
        : "Maintain the care rhythm and monitor new exceptions.";
  }
}

export function dateMs(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function categoryLabelVi(category: CustomerAssessmentSignal["category"]): string {
  const labels: Record<CustomerAssessmentSignal["category"], string> = {
    RELATIONSHIP: "quan hệ",
    SUPPORT: "hỗ trợ",
    WORK: "công việc",
    COMMERCIAL: "bán hàng",
    PURCHASE: "mua hàng",
    RETURN: "đổi/trả",
  };
  return labels[category];
}

function categoryLabelEn(category: CustomerAssessmentSignal["category"]): string {
  const labels: Record<CustomerAssessmentSignal["category"], string> = {
    RELATIONSHIP: "relationship",
    SUPPORT: "support",
    WORK: "work",
    COMMERCIAL: "commercial",
    PURCHASE: "purchase",
    RETURN: "returns",
  };
  return labels[category];
}
