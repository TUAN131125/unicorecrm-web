import React from "react";
import {
  BriefcaseBusiness,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Button } from "@/shared/components/ui";
import { OpportunityRowActions } from "@/components/crm/detail-archetype";
import { formatMoneyDto } from "@/shared/money";
import type { Customer360ReadModel } from "../model/customer360ReadModel";
import {
  ActionPair,
  EmptyState,
  formatCurrency,
  formatDateTime,
  RecordListSection,
  RecordRow,
  SectionHeader,
} from "./CustomerDetailSectionPrimitives";

export const PurchaseHistoryTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onCreateOrder(): void;
  onOpenOrder(id: string): void;
}> = ({ model, isVi, onCreateOrder, onOpenOrder }) => {
  const completedOrders = model.orders.filter(
    (order) => order.state === "COMPLETED",
  );
  return (
    <div className="space-y-6">
      <SectionHeader
        title={isVi ? "Lịch sử mua hàng" : "Purchase history"}
        actions={
          <Button
            size="sm"
            variant="primary"
            icon={<Plus size={12} />}
            onClick={onCreateOrder}
          >
            {isVi ? "Tạo đơn hàng mới" : "Create new order"}
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <RecordListSection
          title={isVi ? "Bằng chứng mua hàng" : "Purchase evidence"}
        >
          {model.purchaseEvidence.length > 0 ? (
            model.purchaseEvidence.map((evidence) => (
              <button
                key={evidence.evidenceId}
                type="button"
                onClick={() =>
                  evidence.sourceType === "ORDER" &&
                  onOpenOrder(evidence.sourceId)
                }
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">
                    {evidence.evidenceType}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {evidence.sourceType} · {evidence.sourceId}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-semibold text-slate-400">
                  {formatDateTime(evidence.occurredAt, isVi)}
                </div>
              </button>
            ))
          ) : (
            <EmptyState
              icon={<History size={20} />}
              text={
                isVi ? "Chưa có bằng chứng mua hàng." : "No purchase evidence."
              }
            />
          )}
        </RecordListSection>
        <RecordListSection
          title={isVi ? "Đơn hàng đã hoàn tất" : "Completed orders"}
        >
          {completedOrders.length > 0 ? (
            completedOrders.map((order) => (
              <RecordRow
                key={order.id}
                title={order.orderNumber || order.id}
                meta={formatDateTime(
                  order.completedAt || order.orderDate || order.createdAt,
                  isVi,
                )}
                value={formatCurrency(order.totalAmount || 0, isVi)}
                onClick={() => onOpenOrder(order.id)}
              />
            ))
          ) : (
            <EmptyState
              icon={<ShoppingBag size={20} />}
              text={
                isVi ? "Chưa có đơn hàng hoàn tất." : "No completed orders."
              }
            />
          )}
        </RecordListSection>
      </div>
    </div>
  );
};

export const PurchasedProductsTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onCreateOpportunity(): void;
  onCreateQuote(): void;
}> = ({ model, isVi, onCreateOpportunity, onCreateQuote }) => (
  <div className="space-y-4">
    <SectionHeader
      title={isVi ? "Hàng hóa đã mua" : "Purchased products"}
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            icon={<FileText size={12} />}
            onClick={onCreateQuote}
          >
            {isVi ? "Tạo báo giá bán thêm" : "Create upsell quote"}
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Sparkles size={12} />}
            onClick={onCreateOpportunity}
          >
            {isVi ? "Tạo cơ hội bán thêm" : "Create upsell opportunity"}
          </Button>
        </>
      }
    />
    {model.productsPurchased.length > 0 ? (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {model.productsPurchased.map((product) => (
          <div
            key={product.productId}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Package size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">
                  {product.productName}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {isVi ? "Số lượng" : "Quantity"}: {product.quantity} ·{" "}
                  {formatCurrency(product.amount, isVi)}
                </div>
                <div className="mt-1 text-[9px] font-semibold text-slate-400">
                  {formatDateTime(product.firstPurchasedAt, isVi)} →{" "}
                  {formatDateTime(product.lastPurchasedAt, isVi)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState
        icon={<ShoppingBag size={20} />}
        text={isVi ? "Chưa có hàng hóa đã mua." : "No purchased products."}
        action={
          <Button size="sm" variant="primary" onClick={onCreateOpportunity}>
            {isVi ? "Tạo cơ hội đầu tiên" : "Create first opportunity"}
          </Button>
        }
      />
    )}
  </div>
);

export const OpportunitiesTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpen(id: string): void;
  onCreateOpportunity(): void;
  onOpenModule(): void;
  onCreateQuote(dealId: string): void;
}> = ({ model, isVi, onOpen, onCreateOpportunity, onOpenModule, onCreateQuote }) => (
  <RecordListSection
    title={isVi ? "Cơ hội" : "Opportunities"}
    action={
      <ActionPair
        secondaryLabel={isVi ? "Mở pipeline" : "Open pipeline"}
        primaryLabel={isVi ? "Tạo cơ hội" : "Create opportunity"}
        onSecondary={onOpenModule}
        onPrimary={onCreateOpportunity}
      />
    }
  >
    {model.deals.length > 0 ? (
      model.deals.map((deal) => (
        <div key={deal.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-violet-200 hover:shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <button type="button" onClick={() => onOpen(deal.id)} className="min-w-0 flex-1 text-left">
            <div className="crm-text-wrap font-semibold text-slate-800">{deal.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
              <span>{deal.stage}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDateTime(deal.expectedCloseDate, isVi)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-slate-700">{formatCurrency(deal.amount || 0, isVi)}</span>
            </div>
          </button>
          <OpportunityRowActions
            detailHref={`/deals/${deal.id}`}
            detailLabel={isVi ? "Chi tiết" : "Details"}
            quoteLabel={isVi ? "Báo giá" : "Quote"}
            onCreateQuote={() => onCreateQuote(deal.id)}
            className="lg:shrink-0"
          />
        </div>
      ))
    ) : (
      <EmptyState
        icon={<BriefcaseBusiness size={20} />}
        text={isVi ? "Chưa có cơ hội." : "No opportunities."}
        action={
          <Button size="sm" variant="primary" onClick={onCreateOpportunity}>
            {isVi ? "Tạo cơ hội" : "Create opportunity"}
          </Button>
        }
      />
    )}
  </RecordListSection>
);

export const OrdersTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpen(id: string): void;
  onCreate(): void;
  onOpenModule(): void;
}> = ({ model, isVi, onOpen, onCreate, onOpenModule }) => (
  <RecordListSection
    title={isVi ? "Đơn hàng" : "Orders"}
    action={
      <ActionPair
        secondaryLabel={isVi ? "Mở module Đơn hàng" : "Open Orders"}
        primaryLabel={isVi ? "Tạo đơn hàng" : "Create order"}
        onSecondary={onOpenModule}
        onPrimary={onCreate}
      />
    }
  >
    {model.orders.length > 0 ? (
      model.orders.map((order) => (
        <RecordRow
          key={order.id}
          title={order.orderNumber || order.id}
          meta={`${order.state} · ${formatDateTime(order.orderDate || order.createdAt, isVi)}`}
          value={formatCurrency(order.totalAmount || 0, isVi)}
          onClick={() => onOpen(order.id)}
        />
      ))
    ) : (
      <EmptyState
        icon={<ShoppingBag size={20} />}
        text={isVi ? "Chưa có đơn hàng." : "No orders."}
        action={
          <Button size="sm" variant="primary" onClick={onCreate}>
            {isVi ? "Tạo đơn hàng đầu tiên" : "Create first order"}
          </Button>
        }
      />
    )}
  </RecordListSection>
);

export const QuotationsTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpen(id: string): void;
  onCreate(): void;
  onOpenModule(): void;
}> = ({ model, isVi, onOpen, onCreate, onOpenModule }) => (
  <RecordListSection
    title={isVi ? "Báo giá" : "Quotations"}
    action={
      <ActionPair
        secondaryLabel={isVi ? "Mở module Báo giá" : "Open Quotes"}
        primaryLabel={isVi ? "Tạo báo giá" : "Create quote"}
        onSecondary={onOpenModule}
        onPrimary={onCreate}
      />
    }
  >
    {model.quotes.length > 0 ? (
      model.quotes.map((quote) => (
        <RecordRow
          key={quote.id}
          title={`${quote.quoteNumber} · ${quote.title}`}
          meta={`${quote.status} · ${quote.validUntil || "—"}`}
          value={formatCurrency(quote.grandTotal || 0, isVi)}
          onClick={() => onOpen(quote.id)}
        />
      ))
    ) : (
      <EmptyState
        icon={<FileText size={20} />}
        text={isVi ? "Chưa có báo giá." : "No quotations."}
        action={
          <Button size="sm" variant="primary" onClick={onCreate}>
            {isVi ? "Tạo báo giá đầu tiên" : "Create first quote"}
          </Button>
        }
      />
    )}
  </RecordListSection>
);

export const InvoicesTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpen(id: string): void;
  onCreate(): void;
  onOpenModule(): void;
  onOpenReceivable(id: string): void;
}> = ({ model, isVi, onOpen, onCreate, onOpenModule, onOpenReceivable }) => (
  <RecordListSection
    title={isVi ? "Hóa đơn" : "Invoices"}
    action={
      <ActionPair
        secondaryLabel={isVi ? "Mở module Hóa đơn" : "Open Invoices"}
        primaryLabel={isVi ? "Tạo hóa đơn" : "Create invoice"}
        onSecondary={onOpenModule}
        onPrimary={onCreate}
      />
    }
  >
    {model.invoices.length > 0 ? (
      model.invoices.map((invoice) => {
        const receivable = model.receivables.find((entry) => entry.invoiceId === invoice.id);
        return (
          <div key={invoice.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
            <button type="button" className="min-w-0 text-left" onClick={() => onOpen(invoice.id)}>
              <div className="crm-text-wrap font-semibold text-slate-800">{invoice.invoiceNumber ?? (isVi ? "Hóa đơn nháp" : "Draft invoice")}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">{invoice.lifecycleState} · {formatDateTime(invoice.issueDate ?? invoice.createdAt, isVi)}</div>
            </button>
            <div className="text-left sm:text-right">
              <div className="font-semibold text-slate-800">{formatMoneyDto(invoice.totals.grandTotal, isVi ? "vi-VN" : "en-US")}</div>
              {receivable ? (
                <button type="button" className="mt-1 text-xs font-medium text-violet-700 hover:underline" onClick={() => onOpenReceivable(receivable.invoiceId)}>
                  {isVi ? "Còn phải thu" : "Outstanding"}: {formatMoneyDto(receivable.outstandingAmount, isVi ? "vi-VN" : "en-US")}
                </button>
              ) : null}
            </div>
          </div>
        );
      })
    ) : (
      <EmptyState
        icon={<FileCheck2 size={20} />}
        text={isVi ? "Chưa có hóa đơn." : "No invoices."}
        action={<Button size="sm" variant="primary" onClick={onCreate}>{isVi ? "Tạo hóa đơn đầu tiên" : "Create first invoice"}</Button>}
      />
    )}
  </RecordListSection>
);

export const PaymentsTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpenModule(): void;
  onOpenReceivable(id: string): void;
}> = ({ model, isVi, onOpenModule, onOpenReceivable }) => (
  <div className="space-y-5">
    <SectionHeader
      title={isVi ? "Thanh toán & công nợ" : "Payments & receivables"}
      actions={
        <Button size="sm" variant="primary" icon={<ExternalLink size={12} />} onClick={onOpenModule}>
          {isVi ? "Mở module Thanh toán" : "Open Payments"}
        </Button>
      }
    />
    <RecordListSection title={isVi ? "Công nợ phải thu" : "Receivables"}>
      {model.receivables.length > 0 ? (
        model.receivables.map((receivable) => (
          <button key={receivable.invoiceId} type="button" onClick={() => onOpenReceivable(receivable.invoiceId)} className="flex w-full flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-200 sm:flex-row sm:items-center">
            <span>
              <span className="block font-semibold text-slate-800">{receivable.invoiceNumber}</span>
              <span className="mt-1 block text-xs font-medium text-slate-500">{receivable.settlementState} · {receivable.agingBucket}</span>
            </span>
            <span className="font-semibold text-slate-800">{formatMoneyDto(receivable.outstandingAmount, isVi ? "vi-VN" : "en-US")}</span>
          </button>
        ))
      ) : <EmptyState icon={<FileText size={20} />} text={isVi ? "Chưa có công nợ phải thu." : "No receivables."} />}
    </RecordListSection>
    <RecordListSection title={isVi ? "Lịch sử thanh toán" : "Payment history"}>
      {model.paymentTransactions.length > 0 ? (
        model.paymentTransactions.map((transaction) => (
          <div key={transaction.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-800">{transaction.kind}</div>
                <div className="mt-1 text-xs text-slate-500">{transaction.status} · {formatDateTime(transaction.occurredAt, isVi)}</div>
              </div>
              <div className="font-semibold text-slate-800">{formatCurrency(transaction.amount, isVi)}</div>
            </div>
          </div>
        ))
      ) : (
        <EmptyState icon={<WalletCards size={20} />} text={isVi ? "Chưa có giao dịch thanh toán." : "No payment transactions."} action={<Button size="sm" variant="secondary" onClick={onOpenModule}>{isVi ? "Mở Thanh toán" : "Open Payments"}</Button>} />
      )}
    </RecordListSection>
  </div>
);

