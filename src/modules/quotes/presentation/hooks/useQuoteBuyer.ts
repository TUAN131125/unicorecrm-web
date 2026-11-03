import { useEffect, useState } from "react";
import type { BuyerRef } from "@/platform/identity";
import { useEffectiveRecordAccess } from "@/platform/access-control";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { readContactById } from "@/modules/contacts";
import { readOrganizationById } from "@/modules/organizations";

interface BuyerFacts { key: string; name?: string; status?: string; state: "READY" | "UNAVAILABLE"; version?: number }
const readable = (mode: string | undefined) => mode === "READ_ONLY" || mode === "READ_WRITE";

/** Fresh owner reads; neither a Deal title nor a cached label establishes buyer identity. */
export function useQuoteBuyer(buyer: BuyerRef | undefined, enabled: boolean) {
  const workspace = useWorkspaceContextSnapshot(), session = useAuthSessionSnapshot();
  const [revision, setRevision] = useState(0), [facts, setFacts] = useState<BuyerFacts>();
  const contact = buyer?.type === "CONTACT";
  const access = useEffectiveRecordAccess({ resourceKey: contact ? "contacts" : "organizations", recordId: buyer?.id,
    requestedFields: contact ? ["fullName", "displayName", "status"] : ["displayName", "status"], enabled: enabled && Boolean(buyer) });
  const key = JSON.stringify([workspace.workspaceId, session?.sessionId, buyer?.type, buyer?.id, access.data?.evaluatedAt, revision]);
  const refresh = () => { void access.refresh();setRevision(value => value + 1); };
  useEffect(() => {
    if (!enabled || !buyer) return;
    const onFocus = () => { void access.refresh();setRevision(value => value + 1); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, buyer?.id, buyer?.type, access.refresh]);
  useEffect(() => {
    if (!enabled || !buyer || !access.data?.canRead) return;
    const abort = new AbortController();let retired = false;const policy = access.data;
    const load = contact
      ? readContactById(buyer.id, abort.signal).then(value => ({ name: readable(policy.fieldAccess.fullName) ? value.fullName : undefined,
        status: readable(policy.fieldAccess.status) ? value.status : undefined, version: value.resourceVersion }))
      : readOrganizationById(buyer.id, abort.signal).then(value => ({ name: readable(policy.fieldAccess.displayName) ? value.displayName : undefined,
        status: readable(policy.fieldAccess.status) ? value.status : undefined, version: value.resourceVersion }));
    void load.then(value => { if (!retired) setFacts({ key, state: "READY", ...value }); })
      .catch(() => { if (!retired) setFacts({ key, state: "UNAVAILABLE" }); });
    return () => { retired = true;abort.abort(); };
  }, [key, enabled, buyer?.id, buyer?.type, access.data]);
  const current = facts?.key === key ? facts : undefined;
  return { ...current, state: !enabled || !buyer ? "NONE" as const : access.error || access.data?.canRead === false ? "UNAVAILABLE" as const : current?.state ?? "LOADING" as const,
    refresh, identity: key, canOpen: Boolean(access.data?.canRead), canReadStatus: readable(access.data?.fieldAccess.status) };
}
