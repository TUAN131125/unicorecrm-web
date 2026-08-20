import type { SupportCaseRepository } from "../ports/SupportCaseRepository";
import type { SupportCase } from "../../domain/model/supportCase.types";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability, type Capability } from "@/platform/access-control";
import { publishNotification } from "@/platform/notifications";

export function supportStatusCapability(status: SupportCase["status"]): Capability {
  return status === "resolved" || status === "closed"
    ? CAPABILITIES.SUPPORT_COMPLETE
    : CAPABILITIES.SUPPORT_UPDATE;
}

export function saveSupportCase(repository: SupportCaseRepository, supportCase: SupportCase, capability?: Capability): void {
  const cases = repository.list();
  const previous = cases.find((item) => item.id === supportCase.id);
  const requiredCapabilities = new Set<Capability>([
    capability ?? (previous ? CAPABILITIES.SUPPORT_UPDATE : CAPABILITIES.SUPPORT_CREATE),
  ]);
  if (previous && previous.ownerId !== supportCase.ownerId) requiredCapabilities.add(CAPABILITIES.SUPPORT_ASSIGN);
  if (previous && previous.status !== supportCase.status) requiredCapabilities.add(supportStatusCapability(supportCase.status));
  requiredCapabilities.forEach((required) => assertRuntimeCommandAccess(required, "support", previous));
  const exists = Boolean(previous);
  repository.replace(exists
    ? cases.map((item) => item.id === supportCase.id ? supportCase : item)
    : [supportCase, ...cases]);

  const ownerChanged = Boolean(supportCase.ownerId) && previous?.ownerId !== supportCase.ownerId;
  const isNewAssignment = !previous && Boolean(supportCase.ownerId);
  if ((ownerChanged || isNewAssignment) && supportCase.ownerId) {
    publishNotification({
      id: `notification_care_assigned_${supportCase.id}_${supportCase.ownerId}_${supportCase.updatedAt}`,
      recipientMemberId: supportCase.ownerId,
      category: "care",
      type: "CARE_CASE_ASSIGNED",
      title: "Phiếu hỗ trợ được giao",
      message: `${supportCase.caseNumber} · ${supportCase.title}`,
      priority: supportCase.priority === "critical" ? "urgent" : supportCase.priority === "high" ? "high" : supportCase.priority === "low" ? "low" : "medium",
      entityRef: { moduleKey: "support", recordId: supportCase.id, label: supportCase.caseNumber },
      route: `/support/cases/${supportCase.id}`,
      dedupeKey: `care-assigned:${supportCase.id}:${supportCase.ownerId}:${supportCase.updatedAt}`,
      createdAt: supportCase.updatedAt,
    });
  }

  const previousCommentIds = new Set((previous?.comments ?? []).map((comment) => comment.id));
  const customerReply = (supportCase.comments ?? []).find((comment) => comment.type === "customer_reply" && !previousCommentIds.has(comment.id));
  if (customerReply && supportCase.ownerId) {
    publishNotification({
      id: `notification_care_reply_${supportCase.id}_${customerReply.id}`,
      recipientMemberId: supportCase.ownerId,
      category: "care",
      type: "CARE_CUSTOMER_REPLY",
      title: "Khách hàng đã phản hồi",
      message: `${supportCase.caseNumber} · ${supportCase.title}`,
      priority: supportCase.priority === "critical" ? "urgent" : supportCase.priority === "high" ? "high" : "medium",
      entityRef: { moduleKey: "support", recordId: supportCase.id, label: supportCase.caseNumber },
      route: `/support/cases/${supportCase.id}`,
      dedupeKey: `care-reply:${supportCase.id}:${customerReply.id}`,
      createdAt: customerReply.createdAt,
    });
  }
}

export function resetSupportCases(repository: SupportCaseRepository, seed: readonly SupportCase[]): void {
  assertRuntimeCapability(CAPABILITIES.SUPPORT_UPDATE);
  repository.replace(structuredClone([...seed]));
}
