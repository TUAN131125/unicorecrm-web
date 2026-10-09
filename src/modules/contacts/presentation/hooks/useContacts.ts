import { useEffect, useState } from "react";
import type { Contact } from "../../domain/model/contact.types";
import type { ContactCollectionUpdater } from "../../application/commands/contactRepositoryCommands";
import { getContactCollectionResource } from "../../application/vertical-slice/contactAuthoritativeQueries";
import { getContactsSnapshot, replaceContacts, subscribeToContacts, updateContacts, isContactConnectedMode } from "../../public/contacts";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useContactReadAuthorityScope } from "./useContactReadAuthorityScope";
import { getContactReadAuthorityScope, getContactProjectionAuthorityScope } from "../../application/vertical-slice/contactReadAuthorityScope";

export function useContacts(options: { loadAuthoritative?: boolean } = {}) {
  const scopeKey = useContactReadAuthorityScope();
  const [snapshot, setContactsState] = useState(() => ({ contacts: getContactsSnapshot(), scope: isContactConnectedMode() ? getContactProjectionAuthorityScope() : scopeKey }));
  const query = useModuleAuthoritativeResource(getContactCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey,
    onScopeChange: () => replaceContacts([]),
  });

  useEffect(() => subscribeToContacts(contacts => setContactsState({ contacts, scope: isContactConnectedMode() ? getContactProjectionAuthorityScope() : getContactReadAuthorityScope() })), []);

  const accessDenied = query.error?.category === "AUTHORIZATION";
  useEffect(() => {
    if (accessDenied) replaceContacts([]);
  }, [accessDenied]);

  const setContacts = (updater: ContactCollectionUpdater) => {
    updateContacts(updater);
  };

  return { contacts: accessDenied || snapshot.scope !== scopeKey ? [] : snapshot.contacts, setContacts, query };
}
