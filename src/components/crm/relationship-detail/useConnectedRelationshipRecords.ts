import { useEffect, useState } from "react";
import type { RelationshipRef } from "@/platform/identity";
import { useEffectiveAccess } from "@/platform/access-control";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { readDealPage } from "@/modules/deals";
import { readQuotePage } from "@/modules/quotes";
import { readOrderPage } from "@/modules/orders";
import { readInvoiceListAuthoritative, readBuyerReceivablesAuthoritative } from "@/modules/invoices";
import { readPaymentRecordsAuthoritative } from "@/modules/payments";
import { getSupportApiRuntime } from "@/modules/support";
import type { MoneyDto } from "@/shared/money";
import { subscribeModuleQueryInvalidation } from "@/shared/application";

export type RelationshipRecordModule = "deals" | "quotes" | "orders" | "invoices" | "payments" | "support" | "receivables" | "products" | "history";
export interface ConnectedRelationshipRow { id: string; title: string; href: string; status?: string; amount?: MoneyDto; at?: string; businessDate?: string }
interface Page { rows: ConnectedRelationshipRow[]; total?: number; next?: string }
const capabilities: Record<RelationshipRecordModule, string> = { deals: "deals.read", quotes: "quotes.read", orders: "orders.read", invoices: "invoices.read", payments: "payments.read", support: "support.read", receivables: "receivables.read", products: "orders.read", history: "orders.read" };
const money = (value: number | null | undefined, currency: string | undefined): MoneyDto | undefined => value !== null && value !== undefined && currency ? { amount: String(value), currency } : undefined;

async function load(module: RelationshipRecordModule, subject: RelationshipRef, cursor: string | undefined, signal: AbortSignal): Promise<Page> {
  const matches = (ref: RelationshipRef | undefined) => ref?.type === subject.type && ref.id === subject.id;
  const query = { limit: 20, filters: { buyerType: subject.type, buyerId: subject.id }, ...(cursor ? { cursor } : {}) };
  if (module === "deals") {
    const p = await readDealPage(query, signal);
    return { rows: p.items.filter(x => matches(x.buyerRef)).map(x => ({ id: x.id, title: x.name, href: `/deals/${x.id}`, status: x.stage, amount: x.amountDecimal && x.currency ? { amount: x.amountDecimal, currency: x.currency } : money(x.amount, x.currency), at: x.updatedAt, businessDate: x.expectedCloseDate })), total: p.pageInfo.totalCount, next: p.pageInfo.nextCursor };
  }
  if (module === "quotes") {
    const p = await readQuotePage(query, signal);
    return { rows: p.items.filter(x => matches(x.buyerRef)).map(x => ({ id: x.id, title: `${x.quoteNumber} · ${x.title}`, href: `/quotes/${x.id}`, status: x.status, amount: money(x.grandTotal, x.currency), at: x.updatedAt, businessDate: x.validUntil })), total: p.pageInfo.totalCount, next: p.pageInfo.nextCursor };
  }
  if (module === "orders") {
    const p = await readOrderPage(query, signal);
    return { rows: p.items.filter(x => matches(x.buyerRef)).map(x => ({ id: x.id, title: x.orderNumber, href: `/orders/${x.id}`, status: x.state, amount: money(x.grandTotal, x.currency), at: x.updatedAt })), total: p.pageInfo.totalCount, next: p.pageInfo.nextCursor };
  }
  if (module === "products" || module === "history") {
    // Existing purchase evidence semantics use completed Orders, never Quote acceptance,
    // an unconfirmed draft, a browser snapshot, or a fabricated payment receipt.
    const p = await readOrderPage({ ...query, filters: { ...query.filters, state: "COMPLETED" } }, signal);
    const orders = p.items.filter(x => matches(x.buyerRef) && x.state === "COMPLETED");
    const rows = module === "products" ? orders.flatMap(order => order.items.map(line => ({ id: `${order.id}:${line.id}`,
      title: `${line.productNameSnapshot} · ${line.quantity} · ${order.orderNumber}`, href: `/orders/${order.id}`, status: order.state,
      amount: money(line.lineTotal, order.currency), at: order.completedAt })))
      : orders.map(order => ({ id: order.id, title: order.orderNumber, href: `/orders/${order.id}`, status: order.state, amount: order.commercialTotal ?? money(order.grandTotal, order.currency), at: order.completedAt }));
    return { rows, next: p.pageInfo.nextCursor };
  }
  if (module === "receivables") {
    const entries = await readBuyerReceivablesAuthoritative(subject, signal);
    const rows = entries.filter(x => matches(x.buyerRef)).map(x => ({ id: x.invoiceId, title: x.invoiceNumber, href: `/invoices/${x.invoiceId}`, status: x.settlementState, amount: x.outstandingAmount }));
    return { rows, total: rows.length };
  }
  if (module === "invoices") {
    const rows = (await readInvoiceListAuthoritative(signal)).filter(x => matches(x.buyerRef)).map(x => ({ id: x.id, title: x.invoiceNumber || "—", href: `/invoices/${x.id}`, status: x.lifecycleState, amount: x.totals.grandTotal, at: x.issuedAt ?? x.createdAt }));
    return { rows, total: rows.length };
  }
  if (module === "payments") {
    const rows = (await readPaymentRecordsAuthoritative(subject.id, signal)).filter(x => matches(x.buyerRef)).map(x => ({ id: x.id, title: x.externalReference || x.methodCode, href: `/payments/${x.id}`, status: x.state, amount: x.amount, at: x.occurredAt }));
    return { rows, total: rows.length };
  }
  const p = await getSupportApiRuntime().queries.list({ limit: 20, filters: { relationshipType: subject.type, relationshipId: subject.id }, ...(cursor ? { cursor } : {}) }, signal);
  return { rows: p.items.filter(x => matches(x.relationshipRef)).map(x => ({ id: x.id, title: `${x.caseNumber} · ${x.title}`, href: `/support/cases/${x.id}`, status: x.status, at: x.updatedAt })), total: p.pageInfo.totalCount, next: p.pageInfo.nextCursor };
}

/** Each owner read has independent state. No customer prerequisite, affiliation expansion,
 * name/email matching, global snapshot writes or stale fallback after scope/access changes. */
export function useConnectedRelationshipRecords(module: RelationshipRecordModule, subject: RelationshipRef) {
  const access = useEffectiveAccess();
  const session = useAuthSessionSnapshot();
  const permitted = access.can(capabilities[module]);
  const scope = JSON.stringify([session?.sessionId, access.workspaceId, access.accountId, access.authorityRevision, module, subject.type, subject.id, permitted]);
  const [paging, setPaging] = useState<{ scope: string; cursor: string }>();
  const cursor = paging?.scope === scope ? paging.cursor : undefined;
  const [retry, setRetry] = useState(0);
  useEffect(() => subscribeModuleQueryInvalidation(module === "receivables" ? "invoices" : module === "products" || module === "history" ? "orders" : module, async () => { setRetry(x => x + 1); }), [module]);
  const [state, setState] = useState<{ scope: string; loading: boolean; page?: Page; error?: unknown }>({ scope: "", loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ scope, loading: permitted, ...(previous.scope === scope && permitted && previous.page ? { page: previous.page } : {}) }));
    if (permitted) void load(module, subject, cursor, controller.signal).then(page => {
      if (!controller.signal.aborted) setState({ scope, loading: false, page });
    }).catch(error => { if (!controller.signal.aborted) setState({ scope, loading: false, error }); });
    return () => controller.abort();
  }, [scope, cursor, retry, module, subject.type, subject.id, permitted]);
  const current = state.scope === scope && permitted ? state : undefined;
  return { permitted, loading: permitted && (!current || current.loading), error: current?.error,
    page: current?.page, refresh: () => setRetry(x => x + 1), previous: Boolean(cursor),
    first: () => setPaging(undefined), next: () => { if (current?.page?.next) setPaging({ scope, cursor: current.page.next }); } };
}
