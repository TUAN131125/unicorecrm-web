import {
  ReceivablesApiClient,
  type Money as ApiMoney,
  type ReceivableEntry as ApiReceivableEntry,
  type ReceivablesAgingSummary as ApiReceivablesAgingSummary,
  type ReceivablesSummary as ApiReceivablesSummary,
} from "@/platform/api";
import { ApiClientError, type HttpClient } from "@/platform/api";
import type { MoneyDto } from "@/shared/money";
import type {
  ReceivablesAgingSummary,
  ReceivablesApiPort,
  ReceivablesSummary,
} from "../../application/ports/ReceivablesApiPort";
import type { ReceivableEntry } from "../../domain/model/invoice.types";

const PAGE_LIMIT = 200;
const MAX_PAGES = 100;

export class ReceivablesHttpAdapter implements ReceivablesApiPort {
  private readonly api: ReceivablesApiClient;

  constructor(client: HttpClient) {
    this.api = new ReceivablesApiClient(client);
  }

  async list(input: Parameters<ReceivablesApiPort["list"]>[0] = {}, signal?: AbortSignal): Promise<ReceivableEntry[]> {
    const entries: ReceivableEntry[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.api.listReceivables({
        buyerId: input.buyerId,
        settlementState: input.settlementState,
        asOfDate: input.asOfDate,
        cursor,
        limit: PAGE_LIMIT,
        sort: "dueDate:asc",
      }, signal);
      entries.push(...response.items.map(mapReceivableEntry));

      if (!response.pageInfo.hasNextPage) return entries;
      const nextCursor = response.pageInfo.nextCursor?.trim();
      if (!nextCursor || seenCursors.has(nextCursor)) {
        throw invalidPaginationResponse(nextCursor ? "CURSOR_REPEATED" : "NEXT_CURSOR_MISSING");
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

    throw invalidPaginationResponse("PAGE_LIMIT_EXCEEDED");
  }

  async summary(asOfDate?: string, signal?: AbortSignal): Promise<ReceivablesSummary> {
    const response = await this.api.getReceivablesSummary({ asOfDate }, signal);
    return mapReceivablesSummary(response);
  }

  async aging(asOfDate?: string, signal?: AbortSignal): Promise<ReceivablesAgingSummary> {
    const response = await this.api.getReceivablesAging({ asOfDate }, signal);
    return mapReceivablesAging(response);
  }

  async accountStatement(buyerRef: Parameters<ReceivablesApiPort["accountStatement"]>[0], signal?: AbortSignal): Promise<ReceivableEntry[]> {
    const response = await this.api.getBuyerAccountStatement(buyerRef.type, buyerRef.id, {}, signal);
    return response.items.map(mapReceivableEntry);
  }
}

function mapMoney(value: ApiMoney): MoneyDto {
  return { amount: value.amount, currency: value.currency };
}

function mapReceivableEntry(value: ApiReceivableEntry): ReceivableEntry {
  return {
    invoiceId: value.invoiceId,
    invoiceNumber: value.invoiceNumber,
    buyerRef: { type: value.buyerRef.type, id: value.buyerRef.id },
    buyerName: value.buyerName,
    issueDate: value.issueDate,
    ...(value.dueDate === undefined ? {} : { dueDate: value.dueDate }),
    originalAmount: mapMoney(value.originalAmount),
    allocatedAmount: mapMoney(value.allocatedAmount),
    creditedAmount: mapMoney(value.creditedAmount),
    outstandingAmount: mapMoney(value.outstandingAmount),
    settlementState: value.settlementState,
    agingBucket: value.agingBucket,
    version: value.version,
  };
}

function mapReceivablesSummary(value: ApiReceivablesSummary): ReceivablesSummary {
  return {
    asOfDate: value.asOfDate,
    outstandingAmount: mapMoney(value.outstandingAmount),
    overdueAmount: mapMoney(value.overdueAmount),
    openInvoiceCount: value.openInvoiceCount,
    overdueInvoiceCount: value.overdueInvoiceCount,
  };
}

function mapReceivablesAging(value: ApiReceivablesAgingSummary): ReceivablesAgingSummary {
  return {
    asOfDate: value.asOfDate,
    buckets: {
      NOT_DUE: mapAgingBucket(value.buckets.NOT_DUE),
      CURRENT: mapAgingBucket(value.buckets.CURRENT),
      "1_30": mapAgingBucket(value.buckets["1_30"]),
      "31_60": mapAgingBucket(value.buckets["31_60"]),
      "61_90": mapAgingBucket(value.buckets["61_90"]),
      "90_PLUS": mapAgingBucket(value.buckets["90_PLUS"]),
    },
  };
}

function mapAgingBucket(value: ApiReceivablesAgingSummary["buckets"][keyof ApiReceivablesAgingSummary["buckets"]]) {
  return { count: value.count, amount: mapMoney(value.amount) };
}

function invalidPaginationResponse(reason: string): ApiClientError {
  return new ApiClientError({
    code: "RECEIVABLES_PAGINATION_INVALID",
    message: `The Receivables API returned an invalid cursor page: ${reason}.`,
    userMessage: "Receivables could not be loaded because the server returned an invalid page sequence.",
    retryable: false,
    details: { reason },
  });
}
