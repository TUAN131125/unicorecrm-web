import { useEffect, useState } from "react";
import { readOrderById, type CustomerOrder } from "@/modules/orders";
import type { Quote } from "../../domain/model/quote.types";
import { useQuoteDocuments } from "./useQuoteDocuments";

/** Reads owner facts only. Order creation/confirmation remains one Backend workflow. */
export function useQuoteWorkflow(quote: Quote, workspaceId: string) {
  const documents = useQuoteDocuments(workspaceId, quote.id, quote.resourceVersion);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [orderError, setOrderError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const orderId = quote.salesAcceptance?.orderId;
  useEffect(() => {
    const controller = new AbortController();
    setOrder(null); setOrderError(null);
    if (orderId) void readOrderById(orderId, controller.signal).then(value => {
      if (value.sourceQuoteId !== quote.id) throw new Error("Linked Order could not be loaded.");
      if (!controller.signal.aborted) setOrder(value);
    }).catch(cause => { if (!controller.signal.aborted) setOrderError(cause); });
    return () => controller.abort();
  }, [orderId, quote.id, workspaceId, retry]);
  const terminal = Boolean(quote.archivedAt) || ["REJECTED", "EXPIRED"].includes(quote.status);
  const issued = quote.authoritativeActions?.issueDocument?.blockerCodes.includes("DOCUMENT_ALREADY_ISSUED") === true;
  const sent = Boolean(quote.sentAt || quote.deliveryHistory?.length);
  const hasPdf = documents.items.some(item => item.quoteRevision === quote.version);
  const accepted = Boolean(quote.salesAcceptance) || quote.status === "ACCEPTED";
  let step = 0;
  if (accepted) step = 3;
  else if (quote.status === "REJECTED") step = 2;
  else if (terminal) step = sent ? 2 : hasPdf ? 1 : 0;
  else if (quote.authoritativeActions?.issueDocument?.allowed === true) step = 0;
  else if (quote.status === "SENT") step = 2;
  else if (issued) step = 1;
  return { documents, order, orderError, retryOrder: () => setRetry(value => value + 1), step, terminal,
    completed: [hasPdf || issued, sent, accepted || quote.status === "REJECTED", Boolean(order)] };

}
