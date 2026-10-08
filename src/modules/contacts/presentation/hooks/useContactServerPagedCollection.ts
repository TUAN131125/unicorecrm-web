import React from "react";
import { subscribeModuleQueryInvalidation, type ModuleListQuery } from "@/shared/application";
import { useServerPagedCollection } from "@/shared/operations";
import { getContactApiRuntime, isContactConnectedApiRuntime } from "../../application/composition/contactApplicationServices";
import type { Contact } from "../../domain/model/contact.types";

const project = (_records: readonly Contact[]) => {};
export function useContactServerPagedCollection(options: {
  scopeKey: string;
  query: Omit<ModuleListQuery, "cursor" | "limit">;
  enabled: boolean;
}) {
  const loadPage = React.useCallback((query: ModuleListQuery, signal: AbortSignal) =>
    getContactApiRuntime().queries.list(query, signal), []);
  const collection = useServerPagedCollection({ ...options, connected: isContactConnectedApiRuntime(),
    project, loadPage, errorCodePrefix: "CONTACTS" });
  React.useEffect(() => {
    if (!options.enabled) collection.cancel();
  }, [options.enabled, collection.cancel]);
  React.useEffect(() => subscribeModuleQueryInvalidation("contacts", async () => {
    if (collection.enabled) await collection.refresh();
  }), [collection.enabled, collection.refresh]);
  return collection;
}
