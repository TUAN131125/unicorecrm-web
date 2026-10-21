import { useSyncExternalStore } from "react";
import { getContactRelationshipAuthority, subscribeContactRelationshipAuthority } from "../model/contactRelationshipAuthority";

export function useContactReadAuthorityScope(): string {
  return useSyncExternalStore(subscribeContactRelationshipAuthority, getContactRelationshipAuthority, getContactRelationshipAuthority);
}
