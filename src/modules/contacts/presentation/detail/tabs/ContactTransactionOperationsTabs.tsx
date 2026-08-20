import React from "react";
import { ArrowRight, History, RotateCcw, Truck, WalletCards } from "lucide-react";
import { Button } from "@/shared/components/ui";
import {
  RelationshipModuleActions,
  RelationshipWorkspaceHeader,
} from "@/components/crm/relationship-detail";
import { useI18n } from "@/i18n";
import type { ReceivableEntry } from "@/modules/invoices";
import type { PaymentTransaction } from "@/modules/payments";
import type { ReturnRequest } from "@/modules/returns";
import type { ShippingBooking } from "@/modules/shipping";
import type { CustomerOrder } from "@/modules/orders";
import type { Invoice } from "@/modules/invoices";
import { formatMoneyDto } from "@/shared/money";

function EmptyOperations({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <span className="text-xs font-medium text-slate-700">{title}</span>
      <p className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function formatAmount(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: currency || "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export const ContactPaymentsTab: React.FC<{
  transactions: PaymentTransaction[];
  receivables: ReceivableEntry[];
  onOpenPayments(): void;
  onOpenReceivables(): void;
  onOpenReceivable(id: string): void;
}> = ({ transactions, receivables, onOpenPayments, onOpenReceivables, onOpenReceivable }) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  return (
    <div className="space-y-5">
      <RelationshipWorkspaceHeader
        title={text("Thanh toán & công nợ của quan hệ", "Relationship payments & receivables")}
        actions={<RelationshipModuleActions secondaryLabel={text("Mở Thanh toán", "Open Payments")} primaryLabel={text("Mở Công nợ", "Open Receivables")} onSecondary={onOpenPayments} onPrimary={onOpenReceivables} />}
      />
      <section className="space-y-2">
        <h4 className="text-xs font-medium text-slate-700">{text("Công nợ phải thu", "Receivables")}</h4>
        {receivables.length > 0 ? receivables.map((entry) => (
          <button key={entry.invoiceId} type="button" onClick={() => onOpenReceivable(entry.invoiceId)} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-200">
            <span className="min-w-0"><span className="block crm-text-wrap text-xs font-medium text-slate-900">{entry.invoiceNumber}</span><span className="mt-1 block text-[10px] text-slate-500">{entry.settlementState} · {entry.agingBucket}</span></span>
            <span className="shrink-0 text-xs font-semibold text-slate-800">{formatMoneyDto(entry.outstandingAmount, isVi ? "vi-VN" : "en-US")}</span>
          </button>
        )) : <EmptyOperations title={text("Chưa có công nợ phải thu", "No receivables")} detail={text("Công nợ được lấy từ hóa đơn chính thức của Customer 360 hoặc đơn hàng liên quan.", "Receivables are resolved from authoritative invoices for Customer 360 or related orders.")} />}
      </section>
      <section className="space-y-2">
        <h4 className="text-xs font-medium text-slate-700">{text("Lịch sử thanh toán", "Payment history")}</h4>
        {transactions.length > 0 ? transactions.map((transaction) => (
          <div key={transaction.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><WalletCards size={14} /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-slate-900">{transaction.kind}</span><span className="mt-1 block text-[10px] text-slate-500">{transaction.status} · {formatDate(transaction.occurredAt, locale)}</span></span>
            <span className="shrink-0 text-xs font-semibold text-slate-800">{formatAmount(transaction.amount, transaction.currency, locale)}</span>
          </div>
        )) : <EmptyOperations title={text("Chưa có giao dịch thanh toán", "No payment transactions")} detail={text("Thanh toán được nối qua buyerRef và các đơn hàng thuộc quan hệ khách hàng này.", "Payments are connected through buyerRef and orders belonging to this customer relationship.")} />}
      </section>
    </div>
  );
};

export const ContactShippingTab: React.FC<{
  bookings: ShippingBooking[];
  onOpen(id: string): void;
  onOpenModule(): void;
  onReviewOrders(): void;
}> = ({ bookings, onOpen, onOpenModule, onReviewOrders }) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  return (
    <div className="space-y-4">
      <RelationshipWorkspaceHeader title={text("Vận đơn liên quan", "Related shipping bookings")} actions={<RelationshipModuleActions secondaryLabel={text("Mở Vận đơn", "Open Shipping")} primaryLabel={text("Xem đơn hàng", "Review orders")} onSecondary={onOpenModule} onPrimary={onReviewOrders} />} />
      {bookings.length > 0 ? <div className="grid gap-3 md:grid-cols-2">{bookings.map((booking) => (
        <button key={booking.id} type="button" onClick={() => onOpen(booking.id)} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-200">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Truck size={14} /></span>
          <span className="min-w-0 flex-1"><span className="block crm-text-wrap text-xs font-medium text-slate-900">{booking.code}</span><span className="mt-1 block crm-text-wrap text-[10px] text-slate-500">{booking.externalStatus} · {booking.providerNameSnapshot}</span><span className="mt-2 block text-[10px] text-slate-500">{booking.trackingCode || text("Chưa có mã theo dõi", "No tracking code")}</span></span>
          <ArrowRight size={13} className="mt-1 shrink-0 text-slate-300" />
        </button>
      ))}</div> : <EmptyOperations title={text("Chưa có vận đơn", "No shipping bookings")} detail={text("Vận đơn được nối qua đơn hàng hoặc yêu cầu đổi/trả của quan hệ khách hàng.", "Shipping is connected through orders or returns for this customer relationship.")} />}
    </div>
  );
};

export const ContactReturnsTab: React.FC<{
  requests: ReturnRequest[];
  onOpen(id: string): void;
  onOpenModule(): void;
  onReviewOrders(): void;
}> = ({ requests, onOpen, onOpenModule, onReviewOrders }) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  return (
    <div className="space-y-4">
      <RelationshipWorkspaceHeader title={text("Yêu cầu đổi / trả", "Return requests")} actions={<RelationshipModuleActions secondaryLabel={text("Mở Đổi / Trả", "Open Returns")} primaryLabel={text("Xem đơn hàng", "Review orders")} onSecondary={onOpenModule} onPrimary={onReviewOrders} />} />
      {requests.length > 0 ? <div className="space-y-2">{requests.map((request) => (
        <button key={request.id} type="button" onClick={() => onOpen(request.id)} className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-200">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><RotateCcw size={14} /></span>
          <span className="min-w-0 flex-1"><span className="block crm-text-wrap text-xs font-medium text-slate-900">{request.code}</span><span className="mt-1 block crm-text-wrap text-[10px] text-slate-500">{request.status} · {request.reason} · {request.items.length} {text("dòng", "lines")}</span></span>
          <span className="shrink-0 text-[10px] text-slate-500">{formatDate(request.requestedAt, locale)}</span>
        </button>
      ))}</div> : <EmptyOperations title={text("Chưa có yêu cầu đổi / trả", "No return requests")} detail={text("Yêu cầu đổi/trả được lấy từ module Đổi / Trả theo buyerRef hoặc đơn hàng liên quan.", "Returns are resolved from the Returns module through buyerRef or related orders.")} />}
    </div>
  );
};

export const ContactPurchaseHistoryTab: React.FC<{
  orders: CustomerOrder[];
  invoices: Invoice[];
  transactions: PaymentTransaction[];
  bookings: ShippingBooking[];
  returns: ReturnRequest[];
  onOpenRecord(moduleKey: string, id: string): void;
  onOpenOrders(): void;
}> = ({ orders, invoices, transactions, bookings, returns, onOpenRecord, onOpenOrders }) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  const events = [
    ...orders.map((item) => ({ id: `order:${item.id}`, moduleKey: "orders", recordId: item.id, title: `${text("Đơn hàng", "Order")} ${item.orderNumber}`, meta: item.state, occurredAt: item.orderDate || item.createdAt || "" })),
    ...invoices.map((item) => ({ id: `invoice:${item.id}`, moduleKey: "invoices", recordId: item.id, title: `${text("Hóa đơn", "Invoice")} ${item.invoiceNumber || text("nháp", "draft")}`, meta: item.lifecycleState, occurredAt: item.issueDate || item.createdAt })),
    ...transactions.map((item) => ({ id: `payment:${item.id}`, moduleKey: "payments", recordId: item.id, title: item.kind === "REFUND" ? text("Hoàn tiền", "Refund") : text("Thanh toán", "Payment"), meta: `${item.status} · ${formatAmount(item.amount, item.currency, locale)}`, occurredAt: item.occurredAt })),
    ...bookings.map((item) => ({ id: `shipping:${item.id}`, moduleKey: "shipping", recordId: item.id, title: `${text("Vận đơn", "Shipping")} ${item.code}`, meta: item.externalStatus, occurredAt: item.updatedAt })),
    ...returns.map((item) => ({ id: `return:${item.id}`, moduleKey: "returns", recordId: item.id, title: `${text("Đổi / Trả", "Return")} ${item.code}`, meta: item.status, occurredAt: item.updatedAt })),
  ].sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""));
  return (
    <div className="space-y-4">
      <RelationshipWorkspaceHeader title={text("Lịch sử giao dịch xuyên module", "Cross-module transaction history")} />
      {events.length > 0 ? <div className="space-y-2">{events.map((event) => (
        <button key={event.id} type="button" onClick={() => onOpenRecord(event.moduleKey, event.recordId)} className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-200">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><History size={14} /></span>
          <span className="min-w-0 flex-1"><span className="block crm-text-wrap text-xs font-medium text-slate-900">{event.title}</span><span className="mt-1 block text-[10px] text-slate-500">{event.meta}</span></span>
          <span className="shrink-0 text-[10px] text-slate-400">{formatDate(event.occurredAt, locale)}</span>
        </button>
      ))}</div> : <EmptyOperations title={text("Chưa có lịch sử giao dịch", "No transaction history")} detail={text("Lịch sử sẽ tự tổng hợp từ Đơn hàng, Hóa đơn, Thanh toán, Vận đơn và Đổi / Trả.", "History is automatically assembled from Orders, Invoices, Payments, Shipping, and Returns.")} />}
      <Button size="sm" variant="secondary" onClick={onOpenOrders}>{text("Mở trung tâm Đơn hàng", "Open Orders workspace")}</Button>
    </div>
  );
};
