import { useEffect, useState } from "react";
import type { Contact } from "../../domain/model/contact.types";
import type { ContactCollectionUpdater } from "../../application/commands/contactRepositoryCommands";
import { getContactCollectionResource } from "../../application/vertical-slice/contactAuthoritativeQueries";
import { getContactsSnapshot, replaceContacts, subscribeToContacts, updateContacts } from "../../public/contacts";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useContacts(options: { loadAuthoritative?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [contacts, setContactsState] = useState<Contact[]>(getContactsSnapshot);
  const query = useModuleAuthoritativeResource(getContactCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceContacts([]),
  });

  useEffect(() => subscribeToContacts(setContactsState), []);

  const accessDenied = query.error?.category === "AUTHORIZATION";
  useEffect(() => {
    if (accessDenied) replaceContacts([]);
  }, [accessDenied]);

  const setContacts = (updater: ContactCollectionUpdater) => {
    updateContacts(updater);
  };

  return { contacts: accessDenied ? [] : contacts, setContacts, query };
}
