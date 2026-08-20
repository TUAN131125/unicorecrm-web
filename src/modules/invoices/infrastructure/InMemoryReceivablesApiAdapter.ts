import type { PaymentRepositorySnapshot } from "@/modules/payments";
import { money, sumMoney } from "@/shared/money";
import { buildReceivables } from "../application/queries/invoiceQueries";
import type { InvoiceRepository } from "../application/ports/InvoiceRepository";
import type { ReceivablesApiPort } from "../application/ports/ReceivablesApiPort";
import type { ReceivableEntry } from "../domain/model/invoice.types";

interface PaymentLedgerSnapshotSource {
  snapshot(): PaymentRepositorySnapshot;
}

export class InMemoryReceivablesApiAdapter implements ReceivablesApiPort {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly paymentRepository: PaymentLedgerSnapshotSource,
  ) {}

  async list(input: Parameters<ReceivablesApiPort["list"]>[0] = {}) {
    const entries = this.entries(input.asOfDate);
    return entries
      .filter((item) => !input.buyerId || item.buyerRef.id === input.buyerId)
      .filter((item) => !input.settlementState || item.settlementState === input.settlementState);
  }

  async summary(asOfDate?: string) {
    const entries = this.entries(asOfDate);
    const currency = entries[0]?.outstandingAmount.currency ?? "VND";
    const open = entries.filter((item) => item.settlementState !== "PAID" && item.settlementState !== "CREDITED");
    const overdue = entries.filter((item) => item.settlementState === "OVERDUE");
    return {
      asOfDate: asOfDate ?? this.invoiceRepository.getAccountingAsOfDate(),
      outstandingAmount: sumMoney(open.map((item) => item.outstandingAmount), currency),
      overdueAmount: sumMoney(overdue.map((item) => item.outstandingAmount), currency),
      openInvoiceCount: open.length,
      overdueInvoiceCount: overdue.length,
    };
  }

  async aging(asOfDate?: string) {
    const entries = this.entries(asOfDate);
    const currency = entries[0]?.outstandingAmount.currency ?? "VND";
    const bucketKeys: ReceivableEntry["agingBucket"][] = ["NOT_DUE", "CURRENT", "1_30", "31_60", "61_90", "90_PLUS"];
    return {
      asOfDate: asOfDate ?? this.invoiceRepository.getAccountingAsOfDate(),
      buckets: Object.fromEntries(bucketKeys.map((bucket) => {
        const matching = entries.filter((item) => item.agingBucket === bucket);
        return [bucket, { count: matching.length, amount: matching.length ? sumMoney(matching.map((item) => item.outstandingAmount), currency) : money("0", currency) }];
      })) as Awaited<ReturnType<ReceivablesApiPort["aging"]>>["buckets"],
    };
  }

  async accountStatement(buyerRef: Parameters<ReceivablesApiPort["accountStatement"]>[0]) {
    return this.entries().filter((item) => item.buyerRef.type === buyerRef.type && item.buyerRef.id === buyerRef.id);
  }

  private entries(asOfDate?: string) {
    const invoiceSnapshot = this.invoiceRepository.snapshot();
    const paymentSnapshot = this.paymentRepository.snapshot();
    return buildReceivables(
      invoiceSnapshot,
      paymentSnapshot.allocations,
      invoiceSnapshot.creditNotes.map((note) => ({ invoiceId: note.invoiceId, amount: note.total, state: note.state })),
      asOfDate ?? invoiceSnapshot.accountingAsOfDate,
    );
  }
}
