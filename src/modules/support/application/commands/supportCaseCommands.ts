import type { RelationshipRef } from "@/platform/identity";
import type {
  SupportCase,
  SupportCaseActivity,
  SupportCaseComment,
  SupportCaseStatus,
} from "../../domain/model/supportCase.types";
import {
  calculateSupportCaseSlaStatus,
  createSupportCaseActivity,
  generateSupportCaseNumber,
  transitionSupportCaseStatus,
} from "../../domain/rules/supportCaseLifecycle";

export interface CreateSupportCaseInput {
  title: string;
  description: string;
  priority: SupportCase["priority"];
  category: SupportCase["category"];
  source: SupportCase["source"];
  /** Optional Customer enrichment; absent until effective purchase evidence creates a Customer. */
  customerId?: string;
  customerName?: string;
  relationshipRef: RelationshipRef;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  relatedOrderId?: string;
  relatedOrderNumber?: string;
  relatedProductId?: string;
  relatedProductName?: string;
  relatedOwnedProductId?: string;
  ownerId?: string;
  ownerName?: string;
  nextFollowUpAt?: string;
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  locale?: "vi" | "en";
}

export function createSupportCase(
  cases: readonly SupportCase[],
  input: CreateSupportCaseInput,
  now = new Date(),
): SupportCase {
  const createdAt = now.toISOString();
  const caseNumber = generateSupportCaseNumber([...cases]);
  const isVietnamese = input.locale !== "en";
  // relationshipRef is the canonical relationship identity and stays required. Customer
  // enrichment does not: a Customer aggregate exists only once effective purchase evidence has
  // been recorded, so a pre-purchase Support Case legitimately carries neither customer field.
  if (!input.relationshipRef?.id?.trim()) throw new Error("Support Case requires a canonical customer relationship.");

  return {
    id: `cs_${now.getTime()}`,
    caseNumber,
    title: input.title,
    description: input.description,
    status: "new",
    priority: input.priority,
    category: input.category,
    source: input.source,
    customerId: input.customerId,
    customerName: input.customerName,
    relationshipRef: input.relationshipRef,
    contactId: input.contactId,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    relatedOrderId: input.relatedOrderId,
    relatedOrderNumber: input.relatedOrderNumber,
    relatedProductId: input.relatedProductId,
    relatedProductName: input.relatedProductName,
    relatedOwnedProductId: input.relatedOwnedProductId,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    createdAt,
    updatedAt: createdAt,
    firstResponseDueAt: input.firstResponseDueAt,
    resolutionDueAt: input.resolutionDueAt,
    nextFollowUpAt: input.nextFollowUpAt,
    slaStatus: calculateSupportCaseSlaStatus({ status: "new", priority: input.priority, firstResponseDueAt: input.firstResponseDueAt, resolutionDueAt: input.resolutionDueAt }),
    activities: [
      {
        id: `act_${now.getTime()}`,
        type: "created",
        title: isVietnamese ? "Đã tạo phiếu hỗ trợ" : "Support ticket created",
        description: isVietnamese
          ? `Phiếu hỗ trợ ${caseNumber} đã được tạo.`
          : `Support ticket ${caseNumber} was created.`,
        createdAt,
        actorName: "CRM System",
      },
    ],
    comments: [],
    checklist: [],
    resolutionSteps: [],
  };
}

export function updateSupportCase(
  current: SupportCase,
  patch: Partial<SupportCase>,
  now = new Date().toISOString(),
): SupportCase {
  return { ...current, ...patch, id: current.id, caseNumber: current.caseNumber, updatedAt: now };
}

export function transitionCase(
  current: SupportCase,
  nextStatus: SupportCaseStatus,
  options: { actorName: string; locale: "vi" | "en"; resolutionSummary?: string },
): SupportCase {
  let updated = transitionSupportCaseStatus(current, nextStatus, options.actorName);
  const isVietnamese = options.locale === "vi";

  if (nextStatus === "resolved") {
    updated.resolvedAt = new Date().toISOString();
    updated.resolutionSummary = options.resolutionSummary || (isVietnamese ? "Đã hoàn tất xử lý yêu cầu chăm sóc." : "Care request completed.");
    updated.activities = [...(updated.activities ?? []), createSupportCaseActivity(
      "resolved",
      isVietnamese ? "Đã giải quyết phiếu" : "Support ticket resolved",
      isVietnamese
        ? `Đã hoàn tất xử lý phiếu hỗ trợ: ${updated.resolutionSummary}`
        : `Support ticket completed. Summary: ${updated.resolutionSummary}`,
      options.actorName,
    )];
  } else if (nextStatus === "closed") {
    updated.closedAt = new Date().toISOString();
    updated.activities = [...(updated.activities ?? []), createSupportCaseActivity(
      "closed",
      isVietnamese ? "Đóng phiếu" : "Support ticket closed",
      isVietnamese ? "Đã đóng phiếu hỗ trợ." : "Support ticket closed.",
      options.actorName,
    )];
  } else if (nextStatus === "reopened") {
    updated.reopenedAt = new Date().toISOString();
    updated.resolvedAt = undefined;
    updated.closedAt = undefined;
    updated.activities = [...(updated.activities ?? []), createSupportCaseActivity(
      "reopened",
      isVietnamese ? "Mở lại phiếu" : "Support ticket reopened",
      isVietnamese ? "Phiếu được mở lại để tiếp tục chăm sóc." : "Support ticket reopened for further handling.",
      options.actorName,
    )];
  }

  updated.slaStatus = calculateSupportCaseSlaStatus(updated);
  return updated;
}

export function addSupportCaseReply(
  current: SupportCase,
  body: string,
  options: { senderType: "agent" | "customer"; locale: "vi" | "en"; actorName?: string },
  now = new Date(),
): SupportCase {
  const createdAt = now.toISOString();
  const isAgent = options.senderType === "agent";
  const actorName = options.actorName ?? (isAgent ? "CRM User" : current.contactName || "Customer");
  const comment: SupportCaseComment = {
    id: `comment_${now.getTime()}`,
    type: isAgent ? "agent_reply" : "customer_reply",
    body,
    authorName: actorName,
    createdAt,
    isInternal: false,
  };

  const activities = [...(current.activities ?? []), createSupportCaseActivity(
    "comment_added",
    isAgent
      ? (options.locale === "vi" ? "Phản hồi từ nhân viên" : "Reply from care owner")
      : (options.locale === "vi" ? "Phản hồi từ khách hàng" : "Reply from Customer"),
    body.length > 60 ? `${body.substring(0, 60)}...` : body,
    actorName,
  )];

  let firstRespondedAt = current.firstRespondedAt;
  if (isAgent && !firstRespondedAt) {
    firstRespondedAt = createdAt;
    activities.push(createSupportCaseActivity(
      "first_response",
      options.locale === "vi" ? "Phản hồi đầu tiên" : "First response logged",
      options.locale === "vi"
        ? "Đã ghi nhận phản hồi đầu tiên cho khách hàng."
        : "First customer response recorded.",
      actorName,
    ));
  }

  const updated: SupportCase = {
    ...current,
    comments: [...(current.comments ?? []), comment],
    activities,
    firstRespondedAt,
    updatedAt: createdAt,
  };
  updated.slaStatus = calculateSupportCaseSlaStatus(updated);
  return updated;
}

export function addSupportCaseInternalNote(
  current: SupportCase,
  body: string,
  options: { locale: "vi" | "en"; actorName?: string },
  now = new Date(),
): SupportCase {
  const createdAt = now.toISOString();
  const actorName = options.actorName ?? "CRM User";
  const comment: SupportCaseComment = {
    id: `note_${now.getTime()}`,
    type: "internal_note",
    body,
    authorName: actorName,
    createdAt,
    isInternal: true,
  };
  const activity = createSupportCaseActivity(
    "internal_note_added",
    options.locale === "vi" ? "Đã thêm ghi chú nội bộ" : "Internal note added",
    body.length > 60 ? `${body.substring(0, 60)}...` : body,
    actorName,
  );
  return {
    ...current,
    comments: [...(current.comments ?? []), comment],
    activities: [...(current.activities ?? []), activity],
    updatedAt: createdAt,
  };
}

export function toggleSupportCaseChecklist(
  current: SupportCase,
  stepId: string,
  options: { locale: "vi" | "en"; actorName?: string },
  now = new Date(),
): SupportCase {
  const actorName = options.actorName ?? "CRM User";
  const createdAt = now.toISOString();
  let resolutionSteps = (current.resolutionSteps ?? []).map((step) =>
    step.id === stepId ? { ...step, isCompleted: !step.isCompleted } : step,
  );
  let checklist = (current.checklist ?? []).map((item) =>
    item.id === stepId
      ? {
          ...item,
          completed: !item.completed,
          completedAt: !item.completed ? createdAt : undefined,
          completedBy: !item.completed ? actorName : undefined,
        }
      : item,
  );

  if (resolutionSteps.length === 0 && checklist.length > 0) {
    resolutionSteps = checklist.map((item) => ({ id: item.id, text: item.label, isCompleted: item.completed }));
  } else if (checklist.length === 0 && resolutionSteps.length > 0) {
    checklist = resolutionSteps.map((step) => ({ id: step.id, label: step.text, completed: step.isCompleted }));
  }

  const toggled = resolutionSteps.find((step) => step.id === stepId);
  const activity = createSupportCaseActivity(
    "linked_record_changed",
    options.locale === "vi" ? "Cập nhật checklist" : "Checklist update",
    toggled ? `Checklist "${toggled.text}": ${toggled.isCompleted ? "HOÀN THÀNH" : "CHƯA HOÀN THÀNH"}` : "Đã cập nhật mục hành động",
    actorName,
  );

  return {
    ...current,
    resolutionSteps,
    checklist,
    activities: [...(current.activities ?? []), activity],
    updatedAt: createdAt,
  };
}

export function reassignSupportCase(
  current: SupportCase,
  owner: { id: string; name: string },
  options: { locale: "vi" | "en"; actorName?: string },
  now = new Date(),
): SupportCase {
  const actorName = options.actorName ?? "CRM User";
  const previousOwnerName = current.ownerName || (options.locale === "vi" ? "Chưa gán" : "Unassigned");
  const activity = createSupportCaseActivity(
    "assigned",
    options.locale === "vi" ? "Chuyển người phụ trách" : "Support ticket reassigned",
    options.locale === "vi"
      ? `Chuyển người phụ trách từ "${previousOwnerName}" sang "${owner.name}".`
      : `Reassigned from "${previousOwnerName}" to "${owner.name}".`,
    actorName,
  );
  return {
    ...current,
    ownerId: owner.id,
    ownerName: owner.name,
    activities: [...(current.activities ?? []), activity],
    updatedAt: now.toISOString(),
  };
}

export function appendSupportCaseActivity(current: SupportCase, activity: SupportCaseActivity): SupportCase {
  return {
    ...current,
    activities: [...(current.activities ?? []), activity],
    updatedAt: activity.createdAt,
  };
}
