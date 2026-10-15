import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { resolveEffectiveAccess, type EffectiveRecordAccess } from "@/platform/access-control";
import type { ContactFormDraft } from "../components/ContactFormModal";

export const contactDraftFields = {
  name: "fullName", title: "jobTitle", department: "department", decisionRole: "decisionRole",
  email: "workEmail", phone: "mobilePhone", zaloId: "zaloId", address: "address",
  preferredChannel: "preferredContactChannel", source: "source", ownerId: "ownerId", tagsString: "tags", notes: "notes",
} as const;
type DraftState = "dirty" | "pending" | "unknown" | "conflict";
interface Checkpoint {
  owner: string; contactId: string; version: number; baseline: ContactFormDraft;
  draft: ContactFormDraft; intentId: string; state: DraftState;
}
// Volatile Contact-owned checkpoints survive route gates, never persistent storage.
const checkpoints = new Map<string, Checkpoint>();
export function contactDraftOwner(): string | undefined {
  const session = getAuthSessionSnapshot();
  const { workspaceId } = getWorkspaceContextSnapshot();
  const access = resolveEffectiveAccess(workspaceId);
  if (session?.status !== "ACTIVE" || access.accountId !== session.principal.accountId || !access.membershipId) return undefined;
  return JSON.stringify([session.principal.accountId, session.principal.memberId, access.membershipId, workspaceId]);
}
function key(owner: string, contactId: string) { return JSON.stringify([owner, contactId]); }
export function checkpointContactDraft(value: Checkpoint): void {
  const previous = checkpoints.get(key(value.owner, value.contactId));
  if (previous && previous.intentId !== value.intentId && previous.state !== "dirty") return;
  checkpoints.set(key(value.owner, value.contactId), structuredClone(value));
}
export function settleContactDraft(owner: string, contactId: string, intentId: string, state: DraftState | "acknowledged"): void {
  const stored = checkpoints.get(key(owner, contactId));
  if (!stored || stored.intentId !== intentId) return;
  if (state === "acknowledged") checkpoints.delete(key(owner, contactId));
  else stored.state = state;
}
export function discardContactDraft(contactId: string): void {
  const owner = contactDraftOwner();
  if (!owner) return;
  const stored = checkpoints.get(key(owner, contactId));
  if (stored?.state !== "pending") checkpoints.delete(key(owner, contactId));
}
export function contactDraftRecovery(contactId: string, version: number | undefined, fresh: ContactFormDraft, access: EffectiveRecordAccess | undefined, activeIntentId?: string) {
  const owner = contactDraftOwner();
  const stored = owner ? checkpoints.get(key(owner, contactId)) : undefined;
  if (stored && stored.intentId === activeIntentId && stored.state === "dirty") return { kind: "none" } as const;
  if (!stored || !access?.canRead || !access.canUpdate || access.recordId !== contactId || access.authority !== "backend") return { kind: "none" } as const;
  if (stored.state !== "dirty") return { kind: stored.state } as const;
  if (version === undefined || version !== stored.version) return { kind: "conflict" } as const;
  const draft = structuredClone(fresh);
  for (const field of Object.keys(contactDraftFields) as Array<keyof typeof contactDraftFields>) {
    if (stored.draft[field] === stored.baseline[field]) continue;
    const wire = contactDraftFields[field];
    const permission = access.fieldAccess[wire] ?? access.fieldAccess[wire.toLowerCase()];
    if (permission !== "READ_WRITE") return { kind: "protected" } as const;
    Object.assign(draft, { [field]: stored.draft[field] });
  }
  return { kind: "available", draft, intentId: stored.intentId } as const;
}
