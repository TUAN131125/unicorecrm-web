import { useEffect, useSyncExternalStore } from "react";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { getTaskApiRuntime, type Activity, type ActivityType } from "@/modules/tasks";
import { createAuthoritativeResource, subscribeModuleQueryInvalidation, type AuthoritativePage } from "@/shared/application";
import { useAuthoritativeResource } from "@/shared/operations";
import { getLeadRelationshipAuthority, subscribeLeadRelationshipAuthority } from "../model/leadRelationshipAuthority";
import { isLeadActivitySourceReachable, mergeLeadHistory } from "../model/leadHistory";

const entries = new Map<string, ReturnType<typeof createEntry>>();
let activeAuthority: string | undefined;
let activeRecord: string | undefined;
let recordGeneration = 0;
const MAX_ITEMS = 500;
type LeadHistoryState = "ACCESS_DENIED" | "UNAVAILABLE" | "STALE" | "ERROR" | "LOADING" | "READY_WITH_DATA" | "READY_EMPTY";

function createEntry(recordId: string, authority: string, type?: ActivityType) {
  const generation = recordGeneration;
  let cursor: string | undefined;
  let retained: Activity[] = [];
  let readers = 0;
  const resource = createAuthoritativeResource<AuthoritativePage<Activity>>(async signal => {
    const continuation = cursor;
    const page = await getTaskApiRuntime().queries.listActivities({ limit: 50, sortDirection: "desc",
      ...(continuation ? { cursor: continuation } : {}), filters: { recordModuleKey: "leads", recordId, ...(type ? { type } : {}) },
    }, signal);
    signal.throwIfAborted();
    if (getLeadRelationshipAuthority() !== authority || activeRecord !== recordId || generation !== recordGeneration) throw new DOMException("Lead history authority retired", "AbortError");
    retained = mergeLeadHistory(continuation ? retained : [], page.items, recordId).slice(0, MAX_ITEMS);
    return { ...page, items: retained };
  }, { shouldRetainDataOnError: error => error.category !== "AUTHORIZATION" && error.category !== "AUTHENTICATION" && error.category !== "NOT_FOUND" });
  const refresh = () => { cursor = undefined; return resource.refresh(); };
  const unsubscribe = subscribeModuleQueryInvalidation("tasks", async event => {
    if (readers > 0 && event.commandType === "task.log-activity" && resource.getSnapshot().state !== "IDLE") await refresh();
  });
  return { resource, refresh, dispose() { unsubscribe(); resource.reset(); retained = []; },
    retain() { readers++; return () => { readers--; if (readers === 0) resource.cancel(); }; },
    async loadMore() {
      const snapshot = resource.getSnapshot();
      if (snapshot.state === "LOADING" || !snapshot.data?.pageInfo.hasNextPage || !snapshot.data.pageInfo.nextCursor || retained.length >= MAX_ITEMS) return;
      cursor = snapshot.data.pageInfo.nextCursor;
      await resource.load({ force: true });
    },
  };
}

export function getLeadHistoryQuery(recordId: string, type?: ActivityType) {
  const authority = getLeadRelationshipAuthority();
  if (activeAuthority !== authority || activeRecord !== recordId) {
    const retired = [...entries.values()]; entries.clear(); activeAuthority = authority;
    activeRecord = recordId; recordGeneration++;
    queueMicrotask(() => retired.forEach(entry => entry.dispose()));
  }
  const key = JSON.stringify([authority, recordId, type]);
  let entry = entries.get(key);
  if (!entry) { entry = createEntry(recordId, authority, type); entries.set(key, entry); }
  return entry;
}

export function useLeadHistory(recordId: string, type?: ActivityType) {
  useSyncExternalStore(subscribeLeadRelationshipAuthority, getLeadRelationshipAuthority, getLeadRelationshipAuthority);
  const access = useEffectiveAccess();
  const connected = getTaskApiRuntime().mode === "connected";
  const session = getAuthSessionSnapshot();
  const readable = access.can(CAPABILITIES.LEADS_READ) && access.can(CAPABILITIES.TASKS_READ) && (!connected || (session?.status === "ACTIVE" && session.principal.accountId === access.accountId));
  const reachable = !connected || isLeadActivitySourceReachable(access);
  const enabled = Boolean(recordId) && readable && reachable;
  const entry = getLeadHistoryQuery(recordId, type);
  const query = useAuthoritativeResource(entry.resource, { enabled });
  useEffect(() => entry.retain(), [entry]);
  useEffect(() => { if (!enabled) entry.resource.reset(); }, [enabled, entry]);
  const denied = !readable || query.error?.category === "AUTHORIZATION" || query.error?.category === "AUTHENTICATION";
  const unavailable = !recordId || !reachable;
  const state: LeadHistoryState = denied ? "ACCESS_DENIED" : unavailable ? "UNAVAILABLE" : query.stale ? "STALE" : query.error ? "ERROR" : query.loading ? "LOADING" : query.data?.items.length ? "READY_WITH_DATA" : "READY_EMPTY";
  return { query: { ...query, connected, data: enabled && !denied ? query.data : undefined }, state,
    items: enabled && !denied ? query.data?.items ?? [] : [], refresh: entry.refresh, loadMore: entry.loadMore,
    hasNextPage: enabled && !denied && query.data?.pageInfo.hasNextPage === true,
    atLimit: (query.data?.items.length ?? 0) >= MAX_ITEMS,
  };
}
