import type { Contact } from "../../domain/model/contact.types";
import { getContactReadAuthorityScope } from "../../application/vertical-slice/contactReadAuthorityScope";
// One owner across Contact profile, activities, relationships and inline Task forms.
let active: { owner: symbol; contact?: Contact; authorityScope: string } | undefined;
const listeners = new Set<(snapshot: typeof active) => void>();
export function getContactInteractionSnapshot() { return active; }
export function subscribeToContactInteraction(listener: (snapshot: typeof active) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function emit() { for (const listener of listeners) listener(active); }
export function acquireContactInteraction(owner: symbol, contact?: Contact): boolean {
  if (active && active.owner !== owner) return false;
  if (!active) { active = { owner, contact: contact ? structuredClone(contact) : undefined, authorityScope: getContactReadAuthorityScope() }; emit(); }
  return true;
}
export function releaseContactInteraction(owner: symbol): void {
  if (active?.owner === owner) { active = undefined; emit(); }
}
