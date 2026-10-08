import React from "react";
import { subscribeModuleQueryInvalidation, type ModuleListQuery } from "@/shared/application";
import { normalizeApplicationError, type ApplicationError } from "@/shared/domain";
import { getContactApiRuntime } from "../../application/composition/contactApplicationServices";
import type { ContactListSummary } from "../../application/ports/ContactApiRuntime";

export function useContactListSummary(scopeKey: string, query: Omit<ModuleListQuery, "cursor" | "limit">, enabled: boolean) {
  const [summary, setSummary] = React.useState<ContactListSummary>();
  const [error, setError] = React.useState<ApplicationError>();
  const [loading, setLoading] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const unavailable = getContactApiRuntime().queries.summary === undefined;
  React.useEffect(() => subscribeModuleQueryInvalidation("contacts", () => {
    if (enabled) setRevision(value => value + 1);
  }), [enabled]);
  React.useLayoutEffect(() => {
    setSummary(undefined);
    setError(undefined);
    setLoading(enabled && !unavailable);
    const queries = getContactApiRuntime().queries;
    const loadSummary = queries.summary;
    if (!enabled || !loadSummary) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => loadSummary.call(queries, query, controller.signal)).then((result) => {
      if (!controller.signal.aborted) setSummary(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(normalizeApplicationError(cause));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [scopeKey, query, enabled, unavailable, revision]);
  return { summary, error, loading, unavailable, refresh: () => setRevision(value => value + 1) };
}
