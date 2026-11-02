import { useEffect, useMemo, useState } from "react";
import { readDealPage } from "@/modules/deals";
import { useEffectiveAccess } from "@/platform/access-control";
import type { RelationshipRef } from "@/platform/identity";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { createAuthoritativeResource } from "@/shared/application";
import { useAuthoritativeResource } from "@/shared/operations";

export function useCustomerRelatedDeals(subject: RelationshipRef) {
  const access = useEffectiveAccess();
  const session = useAuthSessionSnapshot();
  const permitted = access.can("customers.view") && access.can("deals.read");
  const scope = JSON.stringify([session?.sessionId, access.workspaceId, access.accountId, access.membershipId, access.authorityRevision, subject.type, subject.id]);
  const [paging, setPaging] = useState<{ scope: string; cursor: string }>();
  const cursor = paging?.scope === scope ? paging.cursor : undefined;
  const resource = useMemo(() => createAuthoritativeResource(async signal => {
    const page = await readDealPage({ limit: 20, sortBy: "updatedAt", sortDirection: "desc",
      filters: { buyerType: subject.type, buyerId: subject.id }, ...(cursor ? { cursor } : {}) }, signal);
    signal.throwIfAborted();
    return { ...page, items: page.items.filter(deal => deal.buyerRef.type === subject.type && deal.buyerRef.id === subject.id) };
  }, { shouldRetainDataOnError: () => false }), [scope, cursor, subject.type, subject.id]);
  const query = useAuthoritativeResource(resource, { enabled: permitted });
  useEffect(() => () => resource.reset(), [resource]);
  const next = query.data?.pageInfo.nextCursor;
  return { query, permitted, items: permitted && !query.loading && !query.error ? query.data?.items ?? [] : [],
    hasPrevious: Boolean(cursor), hasNext: query.data?.pageInfo.hasNextPage === true && Boolean(next),
    nextPage: () => { if (next && !query.loading) setPaging({ scope, cursor: next }); },
    firstPage: () => setPaging(undefined) };
}
