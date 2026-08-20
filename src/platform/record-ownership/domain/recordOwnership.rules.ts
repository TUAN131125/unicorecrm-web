import type {
  OwnershipMemberOption,
  OwnershipScopeView,
  RecordOwnershipContext,
} from "./recordOwnership.types";

export function resolveCreateOwnerId(
  requestedOwnerId: string | undefined,
  context: RecordOwnershipContext | null,
): string {
  const requested = requestedOwnerId?.trim();
  if (!context) return requested || "unassigned";
  const target = requested || context.memberId;
  if (target === context.memberId) return target;
  if (!context.canAssign || !context.assignableOwners.some((owner) => owner.memberId === target)) {
    throw new Error("Access denied: the requested owner is outside the permitted assignment scope.");
  }
  return target;
}

export function isUnassignedOwnerId(ownerId: string | undefined): boolean {
  const normalized = ownerId?.trim().toLowerCase();
  return !normalized || normalized === "unassigned";
}

export function isSelfClaimReassignment(
  previousOwnerId: string | undefined,
  nextOwnerId: string,
  context: RecordOwnershipContext | null,
): boolean {
  return Boolean(
    context
    && isUnassignedOwnerId(previousOwnerId)
    && nextOwnerId === context.memberId,
  );
}

export function assertReassignmentAllowed(
  previousOwnerId: string | undefined,
  nextOwnerId: string,
  reason: string,
  context: RecordOwnershipContext | null,
): void {
  if (!context || previousOwnerId === nextOwnerId) return;
  if (!reason.trim()) throw new Error("Ownership reassignment requires a reason.");
  if (isSelfClaimReassignment(previousOwnerId, nextOwnerId, context)) return;
  if (!context.canAssign) throw new Error("Access denied: ownership reassignment requires assignment capability.");
  if (!context.assignableOwners.some((owner) => owner.memberId === nextOwnerId)) {
    throw new Error("Access denied: the requested owner is outside the permitted assignment scope.");
  }
}

export function filterByOwnershipScope<T extends { ownerId?: string }>(
  records: readonly T[],
  view: OwnershipScopeView,
  context: RecordOwnershipContext | null,
  canAccessRecord: (record: T) => boolean,
): T[] {
  if (!context) return [...records];
  const allowed = records.filter(canAccessRecord);
  if (view === "ALLOWED") return allowed;
  if (view === "MINE") return allowed.filter((record) => record.ownerId === context.memberId);

  const teamOwnerIds = new Set(
    context.visibleOwners
      .filter((owner) => owner.teamIds.some((teamId) => context.teamIds.includes(teamId)))
      .map((owner) => owner.memberId),
  );
  teamOwnerIds.add(context.memberId);
  return allowed.filter((record) => Boolean(record.ownerId && teamOwnerIds.has(record.ownerId)));
}

export function findOwnerOption(
  owners: readonly OwnershipMemberOption[],
  memberId: string | undefined,
): OwnershipMemberOption | undefined {
  return memberId ? owners.find((owner) => owner.memberId === memberId) : undefined;
}
