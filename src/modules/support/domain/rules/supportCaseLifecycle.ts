import { 
  SupportCase, 
  SupportCaseStatus, 
  SupportCasePriority, 
  SupportCaseSlaStatus, 
  SupportCaseActivity,
  SupportCaseActivityType
} from "../model/supportCase.types";
import { SUPPORT_CASE_SLA_RULES } from "./supportCase.config";

const TRANSITIONS: Record<SupportCaseStatus, SupportCaseStatus[]> = {
  new: ["in_progress", "waiting_customer", "cancelled"],
  in_progress: ["waiting_customer", "waiting_internal", "resolved", "cancelled"],
  waiting_customer: ["in_progress", "resolved", "cancelled"],
  waiting_internal: ["in_progress", "resolved", "cancelled"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: ["in_progress", "waiting_customer", "resolved"],
  cancelled: ["reopened"]
};

export function canTransitionSupportCaseStatus(from: SupportCaseStatus, to: SupportCaseStatus): boolean {
  if (from === to) return true;
  const allowed = TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function getAllowedSupportCaseTransitions(status: SupportCaseStatus): SupportCaseStatus[] {
  return TRANSITIONS[status] || [];
}

export function calculateSupportCaseSla(priority: SupportCasePriority, createdAt: string | Date = new Date()) {
  const createdDate = new Date(createdAt);
  const rules = SUPPORT_CASE_SLA_RULES[priority];
  const firstResponseDueAt = new Date(createdDate.getTime() + rules.firstResponseMinutes * 60 * 1000).toISOString();
  const resolutionDueAt = new Date(createdDate.getTime() + rules.resolutionMinutes * 60 * 1000).toISOString();
  
  return { firstResponseDueAt, resolutionDueAt };
}

export function calculateSupportCaseSlaStatus(caseItem: Partial<SupportCase>, nowStr?: string): SupportCaseSlaStatus {
  if (caseItem.status === "resolved" || caseItem.status === "closed" || caseItem.status === "cancelled") {
    return "not_applicable";
  }

  const firstResponseDue = caseItem.firstResponseDueAt;
  const resolutionDue = caseItem.resolutionDueAt;

  if (!firstResponseDue && !resolutionDue) {
    return "not_applicable";
  }

  const now = nowStr ? new Date(nowStr) : new Date();
  const mainDueStr = resolutionDue || firstResponseDue;
  if (!mainDueStr) return "on_track";

  const dueDate = new Date(mainDueStr);
  const diffMs = dueDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "breached";
  }

  // At risk if remaining time is small relative to limits
  const priority = caseItem.priority || "medium";
  const rule = SUPPORT_CASE_SLA_RULES[priority];
  const totalLimitMs = (rule?.resolutionMinutes || 1440) * 60 * 1000;
  
  // At risk if less than 20% of limit or less than 1 hour remaining
  const atRiskLimitMs = Math.max(3600 * 1000, totalLimitMs * 0.2);

  if (diffMs < atRiskLimitMs) {
    return "at_risk";
  }

  return "on_track";
}

export function createSupportCaseActivity(
  type: SupportCaseActivityType,
  title: string,
  description: string,
  actorName: string,
  metadata?: Record<string, unknown>
): SupportCaseActivity {
  return {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type,
    title,
    description,
    createdAt: new Date().toISOString(),
    actorName,
    metadata
  };
}

export function transitionSupportCaseStatus(
  caseItem: SupportCase,
  nextStatus: SupportCaseStatus,
  actorName: string
): SupportCase {
  const updatedCase = { ...caseItem };
  const oldStatus = caseItem.status;

  if (oldStatus !== nextStatus) {
    if (!canTransitionSupportCaseStatus(oldStatus, nextStatus)) {
      throw new Error(`SUPPORT_CASE_INVALID_TRANSITION:${oldStatus}:${nextStatus}`);
    }
    updatedCase.status = nextStatus;
    updatedCase.updatedAt = new Date().toISOString();

    if (nextStatus === "resolved") {
      if (!updatedCase.resolvedAt) {
        updatedCase.resolvedAt = new Date().toISOString();
      }
    } else if (nextStatus === "closed") {
      if (!updatedCase.closedAt) {
        updatedCase.closedAt = new Date().toISOString();
      }
    } else if (nextStatus === "reopened") {
      updatedCase.reopenedAt = new Date().toISOString();
      updatedCase.closedAt = undefined;
      updatedCase.resolvedAt = undefined;
    }

    const activity = createSupportCaseActivity(
      "status_changed",
      `Trạng thái đổi thành: ${nextStatus}`,
      `Đã chuyển đổi trạng thái từ "${oldStatus}" sang "${nextStatus}".`,
      actorName,
      { oldStatus, nextStatus }
    );

    updatedCase.activities = [...(updatedCase.activities || []), activity];
    updatedCase.slaStatus = calculateSupportCaseSlaStatus(updatedCase);
  }

  return updatedCase;
}

export function generateSupportCaseNumber(existingCases: SupportCase[]): string {
  const year = new Date().getFullYear();
  const prefix = `CASE-${year}-`;
  let maxNum = 0;
  
  if (existingCases && existingCases.length > 0) {
    existingCases.forEach(c => {
      if (c.caseNumber && c.caseNumber.startsWith(prefix)) {
        const suffixStr = c.caseNumber.substring(prefix.length);
        const num = parseInt(suffixStr, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
  }
  
  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(4, "0");
  return `${prefix}${padded}`;
}
