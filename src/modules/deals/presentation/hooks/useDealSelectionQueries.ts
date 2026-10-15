import React from "react";
import { getAuthSessionSnapshot, useAuthSessionSnapshot } from "@/platform/identity-auth";
import { resolveEffectiveAccess, useEffectiveAccess, getAccessGovernanceState, isAccessGovernanceRuntimeConfigured, getAccessControlSnapshot } from "@/platform/access-control";
import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type { AuthoritativePage } from "@/shared/application";
import { formatApplicationError } from "@/shared/operations";
import { useI18n } from "@/i18n";

export function getDealSelectionAuthority(): string {
  const session = getAuthSessionSnapshot();
  const workspace = getWorkspaceContextSnapshot();
  const access = resolveEffectiveAccess();
  return JSON.stringify([session?.sessionId, session?.status, session?.principal.accountId,
    workspace.workspaceId, access.accountId, access.memberId, access.membershipId,
    isAccessGovernanceRuntimeConfigured() ? getAccessGovernanceState().authorityRevision : getAccessControlSnapshot().revision]);
}

export function useDealSelectionAuthority(): string {
  useAuthSessionSnapshot();
  useWorkspaceContextSnapshot();
  useEffectiveAccess();
  return getDealSelectionAuthority();
}

export function useDealSelectionQueries<T>(
  search: string,
  loader: (search: string, cursor: string | undefined, signal: AbortSignal) => Promise<AuthoritativePage<T>>,
) {
  const authority = useDealSelectionAuthority();
  const retirement = React.useRef({ authority, generation: 0 });
  if (retirement.current.authority !== authority) retirement.current = { authority, generation: retirement.current.generation + 1 };
  const generation = retirement.current.generation;
  const { locale } = useI18n();
  const [cursor, setCursor] = React.useState<string>();
  const [state, setState] = React.useState<{ key: string; items: T[]; loading: boolean; error: string; next?: string }>({ key: "", items: [], loading: true, error: "" });
  const [retry, setRetry] = React.useState(0);
  const key = JSON.stringify([authority, generation, search, cursor]);
  React.useEffect(() => { setCursor(undefined); }, [search, authority]);
  React.useEffect(() => {
    const controller = new AbortController();
    let retired = false;
    setState({ key, items: [], loading: true, error: "" });
    const timer = setTimeout(() => {
      void loader(search.trim(), cursor, controller.signal).then(page => {
        if (!retired && !controller.signal.aborted && authority === getDealSelectionAuthority() && generation === retirement.current.generation)
          setState({ key, items: page.items, loading: false, error: "", ...(page.pageInfo.nextCursor ? { next: page.pageInfo.nextCursor } : {}) });
      }).catch(error => {
        if (!retired && !controller.signal.aborted && authority === getDealSelectionAuthority() && generation === retirement.current.generation)
          setState({ key, items: [], loading: false, error: formatApplicationError(error, { locale }) });
      });
    }, 250);
    return () => { retired = true; clearTimeout(timer); controller.abort(); };
  }, [authority, cursor, generation, key, loader, locale, retry, search]);
  const current = state.key === key ? state : { items: [], loading: true, error: "", next: undefined };
  return { ...current, reload: () => setRetry(value => value + 1), nextPage: () => setCursor(current.next), firstPage: () => setCursor(undefined) };
}
