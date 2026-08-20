import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import { SupportCase } from "../../domain/model/supportCase.types";

export function getSupportCasesByCustomer(cases: SupportCase[] | undefined, customerId: string): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.customerId === customerId);
}

export function getSupportCasesByRelationship(cases: SupportCase[] | undefined, relationshipRef: RelationshipRef): SupportCase[] {
  if (!cases) return [];
  const key = relationshipRefKey(relationshipRef);
  return cases.filter((supportCase) => supportCase.relationshipRef && relationshipRefKey(supportCase.relationshipRef) === key);
}

export function getOpenSupportCases(cases: SupportCase[] | undefined): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.status !== "closed" && c.status !== "resolved" && c.status !== "cancelled");
}

export function getClosedSupportCases(cases: SupportCase[] | undefined): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.status === "closed");
}

export function getResolvedSupportCases(cases: SupportCase[] | undefined): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.status === "resolved");
}

export function getBreachedSlaCases(cases: SupportCase[] | undefined): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.slaStatus === "breached");
}

export function getAtRiskSlaCases(cases: SupportCase[] | undefined): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.slaStatus === "at_risk");
}

export function getSupportCasesByStatus(cases: SupportCase[] | undefined, status: string): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.status === status);
}

export function getSupportCasesByPriority(cases: SupportCase[] | undefined, priority: string): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.priority === priority);
}

export function getSupportCasesByCategory(cases: SupportCase[] | undefined, category: string): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.category === category);
}

export function getSupportCasesForOwnedProduct(cases: SupportCase[] | undefined, ownedProductId: string): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.relatedOwnedProductId === ownedProductId);
}

export function getSupportCasesForOrder(cases: SupportCase[] | undefined, orderId: string): SupportCase[] {
  if (!cases) return [];
  return cases.filter(c => c.relatedOrderId === orderId);
}

export interface SupportCaseStats {
  total: number;
  open: number;
  inProgress: number;
  waitingCustomer: number;
  waitingInternal: number;
  resolved: number;
  closed: number;
  breachedSla: number;
  atRiskSla: number;
  critical: number;
  highPriority: number;
  warranty: number;
  complaint: number;
}

export function getSupportCaseStats(cases: SupportCase[] | undefined): SupportCaseStats {
  const list = cases || [];
  
  const stats: SupportCaseStats = {
    total: list.length,
    open: 0,
    inProgress: 0,
    waitingCustomer: 0,
    waitingInternal: 0,
    resolved: 0,
    closed: 0,
    breachedSla: 0,
    atRiskSla: 0,
    critical: 0,
    highPriority: 0,
    warranty: 0,
    complaint: 0
  };

  list.forEach(c => {
    // Open statuses: new, in_progress, waiting_customer, waiting_internal, reopened
    if (c.status !== "closed" && c.status !== "resolved" && c.status !== "cancelled") {
      stats.open++;
    }
    
    // Exact status mapping
    if (c.status === "in_progress") stats.inProgress++;
    else if (c.status === "waiting_customer") stats.waitingCustomer++;
    else if (c.status === "waiting_internal") stats.waitingInternal++;
    else if (c.status === "resolved") stats.resolved++;
    else if (c.status === "closed") stats.closed++;

    // SLA status mapping
    if (c.slaStatus === "breached") stats.breachedSla++;
    else if (c.slaStatus === "at_risk") stats.atRiskSla++;

    // Priority mapping
    if (c.priority === "critical") stats.critical++;
    else if (c.priority === "high") stats.highPriority++;

    // Category mapping
    if (c.category === "warranty") stats.warranty++;
    else if (c.category === "complaint") stats.complaint++;
  });

  return stats;
}

export interface SupportCaseListFilters {
  customerId?: string | null;
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  slaStatus?: string;
  owner?: string;
}

export function querySupportCases(
  cases: readonly SupportCase[],
  filters: SupportCaseListFilters,
): SupportCase[] {
  const search = filters.search?.trim().toLowerCase() ?? "";

  return cases.filter((supportCase) => {
    if (filters.customerId && supportCase.customerId !== filters.customerId) return false;

    if (search) {
      const searchable = [
        supportCase.caseNumber,
        supportCase.title,
        supportCase.customerName,
        supportCase.contactName,
      ].map((value) => (value ?? "").toLowerCase());
      if (!searchable.some((value) => value.includes(search))) return false;
    }

    if (filters.status && filters.status !== "all" && supportCase.status !== filters.status) return false;
    if (filters.priority && filters.priority !== "all" && supportCase.priority !== filters.priority) return false;
    if (filters.category && filters.category !== "all" && supportCase.category !== filters.category) return false;
    if (filters.slaStatus && filters.slaStatus !== "all" && supportCase.slaStatus !== filters.slaStatus) return false;

    if (filters.owner && filters.owner !== "all") {
      if (filters.owner === "unassigned") {
        if (supportCase.ownerId && supportCase.ownerId !== "unassigned") return false;
      } else if (supportCase.ownerId !== filters.owner && supportCase.ownerName !== filters.owner) {
        return false;
      }
    }

    return true;
  });
}

export function getSupportCaseSlaCompliance(cases: readonly SupportCase[]): number {
  const completed = cases.filter((supportCase) => supportCase.status === "resolved" || supportCase.status === "closed");
  if (completed.length === 0) return 100;
  const withinSla = completed.filter((supportCase) => supportCase.slaStatus !== "breached");
  return Math.round((withinSla.length / completed.length) * 1000) / 10;
}

export function getResolvedSupportCasesOnDate(cases: readonly SupportCase[], date = new Date()): number {
  const datePrefix = date.toISOString().split("T")[0];
  return cases.filter((supportCase) =>
    (supportCase.status === "resolved" || supportCase.status === "closed")
    && (supportCase.resolvedAt?.startsWith(datePrefix) || supportCase.updatedAt?.startsWith(datePrefix)),
  ).length;
}

export function getSupportCaseOwners(
  cases: readonly SupportCase[],
  unassignedLabel: string,
): Array<{ id: string; name: string }> {
  const owners = new Map<string, string>();
  cases.forEach((supportCase) => {
    owners.set(supportCase.ownerId || "unassigned", supportCase.ownerName || unassignedLabel);
  });
  return Array.from(owners.entries()).map(([id, name]) => ({ id, name }));
}
