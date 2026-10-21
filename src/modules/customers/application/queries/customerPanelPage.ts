import { createAuthoritativeResource, type AuthoritativePage } from "@/shared/application";

/** Customer-owned paging state; every row must retain the exact server direct reference. */
export function createCustomerPanelPage<T extends { id: string; recordRef?: { moduleKey: string; recordId: string } }>(
  customerId: string,
  load: (cursor: string | undefined, signal: AbortSignal) => Promise<AuthoritativePage<T>>,
) {
  let cursor: string | undefined;
  let retained: T[] = [];
  const resource = createAuthoritativeResource(async signal => {
    const page = await load(cursor, signal);
    signal.throwIfAborted();
    const rows = cursor ? [...retained, ...page.items] : page.items;
    retained = [...new Map(rows
      .filter(row => row.recordRef?.moduleKey === "customers" && row.recordRef.recordId === customerId)
      .map(row => [row.id, row])).values()].slice(0, 500);
    return { ...page, items: retained };
  }, { shouldRetainDataOnError: () => false });
  return {
    resource,
    reset() { cursor = undefined; retained = []; resource.reset(); },
    refresh() { cursor = undefined; retained = []; return resource.refresh(); },
    async more() {
      const state = resource.getSnapshot();
      if (state.state === "LOADING" || retained.length >= 500 || !state.data?.pageInfo.hasNextPage || !state.data.pageInfo.nextCursor) return;
      cursor = state.data.pageInfo.nextCursor;
      await resource.refresh();
    },
  };
}
