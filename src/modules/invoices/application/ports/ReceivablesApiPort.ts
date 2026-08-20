import type { BuyerRef } from "@/platform/identity";
import type { MoneyDto } from "@/shared/money";
import type { ReceivableEntry } from "../../domain/model/invoice.types";

export interface ReceivablesSummary {
  asOfDate: string;
  outstandingAmount: MoneyDto;
  overdueAmount: MoneyDto;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
}

export interface ReceivablesAgingSummary {
  asOfDate: string;
  buckets: Record<ReceivableEntry["agingBucket"], { count: number; amount: MoneyDto }>;
}

export interface ReceivablesApiPort {
  list(input?: { buyerId?: string; settlementState?: ReceivableEntry["settlementState"]; asOfDate?: string }, signal?: AbortSignal): Promise<ReceivableEntry[]>;
  summary(asOfDate?: string, signal?: AbortSignal): Promise<ReceivablesSummary>;
  aging(asOfDate?: string, signal?: AbortSignal): Promise<ReceivablesAgingSummary>;
  accountStatement(buyerRef: BuyerRef, signal?: AbortSignal): Promise<ReceivableEntry[]>;
}
