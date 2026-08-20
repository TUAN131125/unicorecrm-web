import type { Customer360ReadModel } from "./customer360ReadModel";
import type { SignalDraft } from "./customerAssessment.types";

export function addReturnSignals(
  model: Customer360ReadModel,
  addSignal: (signal: SignalDraft) => void,
): void {
  const failedIntents = model.returnIntents.filter(
    (intent) => intent.status === "FAILED",
  );
  const receivedUnresolved = model.returns.filter(
    (request) => request.status === "RECEIVED",
  );
  const requested = model.returns.filter(
    (request) => request.status === "REQUESTED",
  );
  const awaitingItem = model.returns.filter(
    (request) =>
      request.status === "APPROVED" || request.status === "AWAITING_ITEM",
  );
  const resolvedNotClosed = model.returns.filter(
    (request) => request.status === "RESOLVED",
  );

  if (failedIntents.length > 0) {
    const firstIntent = failedIntents[0];
    const request = model.returns.find(
      (item) => item.id === firstIntent.returnId,
    );
    addSignal({
      id: "return-resolution-failed",
      category: "RETURN",
      kind: "RISK",
      severity: "CRITICAL",
      labelVi: `${failedIntents.length} xử lý đổi/trả bị lỗi`,
      labelEn: `${failedIntents.length} return resolution action(s) failed`,
      detailVi:
        "Refund hoặc vận chuyển liên quan đổi/trả chưa hoàn tất thành công.",
      detailEn:
        "A refund or return-related shipping action has not completed successfully.",
      impact: -Math.min(30, failedIntents.length * 15),
      evidence: failedIntents
        .slice(0, 3)
        .map((intent) => ({
          sourceType: `RETURN_${intent.target}`,
          recordId: intent.returnId,
          factVi: `${intent.action} thất bại${intent.failureReason ? ` · ${intent.failureReason}` : ""}`,
          factEn: `${intent.action} failed${intent.failureReason ? ` · ${intent.failureReason}` : ""}`,
          occurredAt: intent.completedAt || intent.createdAt,
        })),
      recommendedAction: request
        ? {
            actionType: "OPEN_RECORD",
            labelVi: "Xử lý lỗi đổi/trả",
            labelEn: "Resolve return failure",
            targetModule: "returns",
            targetRecordId: request.id,
          }
        : {
            actionType: "OPEN_CUSTOMER_TAB",
            labelVi: "Mở Đổi / Trả",
            labelEn: "Open Returns",
            customerTab: "returns",
          },
    });
    return;
  }

  if (receivedUnresolved.length > 0) {
    const first = receivedUnresolved[0];
    addSignal({
      id: "return-received-unresolved",
      category: "RETURN",
      kind: "RISK",
      severity: "HIGH",
      labelVi: `${receivedUnresolved.length} yêu cầu đổi/trả đã nhận hàng nhưng chưa xử lý`,
      labelEn: `${receivedUnresolved.length} return request(s) received but unresolved`,
      detailVi:
        "Hàng đã được xác nhận nhận về; cần hoàn tất quyết định refund, replacement, exchange hoặc repair.",
      detailEn:
        "Items were received; complete the refund, replacement, exchange or repair decision.",
      impact: -Math.min(24, receivedUnresolved.length * 12),
      evidence: receivedUnresolved
        .slice(0, 3)
        .map((request) => ({
          sourceType: "RETURN",
          recordId: request.id,
          factVi: `${request.code} · RECEIVED`,
          factEn: `${request.code} · RECEIVED`,
          occurredAt: request.receivedAt || request.updatedAt,
        })),
      recommendedAction: {
        actionType: "OPEN_RECORD",
        labelVi: "Hoàn tất xử lý đổi/trả",
        labelEn: "Complete return resolution",
        targetModule: "returns",
        targetRecordId: first.id,
      },
    });
  } else if (requested.length > 0) {
    const first = requested[0];
    addSignal({
      id: "return-awaiting-decision",
      category: "RETURN",
      kind: "ATTENTION",
      severity: "HIGH",
      labelVi: `${requested.length} yêu cầu đổi/trả chờ quyết định`,
      labelEn: `${requested.length} return request(s) awaiting decision`,
      detailVi:
        "Cần đánh giá điều kiện và ra quyết định approve/reject rõ ràng.",
      detailEn:
        "Evaluate eligibility and make a clear approve/reject decision.",
      impact: -Math.min(18, requested.length * 9),
      evidence: requested
        .slice(0, 3)
        .map((request) => ({
          sourceType: "RETURN",
          recordId: request.id,
          factVi: `${request.code} · ${request.reason}`,
          factEn: `${request.code} · ${request.reason}`,
          occurredAt: request.requestedAt,
        })),
      recommendedAction: {
        actionType: "OPEN_RECORD",
        labelVi: "Đánh giá yêu cầu đổi/trả",
        labelEn: "Review return request",
        targetModule: "returns",
        targetRecordId: first.id,
      },
    });
  } else if (resolvedNotClosed.length > 0) {
    const first = resolvedNotClosed[0];
    addSignal({
      id: "return-awaiting-close",
      category: "RETURN",
      kind: "ATTENTION",
      severity: "MEDIUM",
      labelVi: `${resolvedNotClosed.length} yêu cầu đổi/trả chờ đóng hồ sơ`,
      labelEn: `${resolvedNotClosed.length} return request(s) awaiting closure`,
      detailVi: "Nghiệp vụ chính đã xử lý nhưng hồ sơ chưa được đóng hoàn tất.",
      detailEn:
        "The main resolution is complete but the request is not closed.",
      impact: -Math.min(8, resolvedNotClosed.length * 4),
      evidence: resolvedNotClosed
        .slice(0, 3)
        .map((request) => ({
          sourceType: "RETURN",
          recordId: request.id,
          factVi: `${request.code} · RESOLVED`,
          factEn: `${request.code} · RESOLVED`,
          occurredAt: request.resolvedAt || request.updatedAt,
        })),
      recommendedAction: {
        actionType: "OPEN_RECORD",
        labelVi: "Đóng hồ sơ đổi/trả",
        labelEn: "Close return request",
        targetModule: "returns",
        targetRecordId: first.id,
      },
    });
  } else if (awaitingItem.length > 0) {
    const first = awaitingItem[0];
    addSignal({
      id: "return-awaiting-item",
      category: "RETURN",
      kind: "ATTENTION",
      severity: "MEDIUM",
      labelVi: `${awaitingItem.length} yêu cầu đổi/trả đang chờ hàng`,
      labelEn: `${awaitingItem.length} return request(s) awaiting item receipt`,
      detailVi: "Theo dõi vận chuyển trả hàng và xác nhận nhận hàng thực tế.",
      detailEn: "Track return shipping and confirm physical receipt.",
      impact: -Math.min(10, awaitingItem.length * 5),
      evidence: awaitingItem
        .slice(0, 3)
        .map((request) => ({
          sourceType: "RETURN",
          recordId: request.id,
          factVi: `${request.code} · ${request.status}`,
          factEn: `${request.code} · ${request.status}`,
          occurredAt: request.updatedAt,
        })),
      recommendedAction: {
        actionType: "OPEN_RECORD",
        labelVi: "Theo dõi đổi/trả",
        labelEn: "Track return request",
        targetModule: "returns",
        targetRecordId: first.id,
      },
    });
  }
}
