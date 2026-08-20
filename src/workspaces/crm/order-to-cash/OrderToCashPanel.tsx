import React, { useMemo } from "react";
import { Banknote, Clock3, Landmark, PackageCheck, RotateCcw } from "lucide-react";
import type { CustomerOrder } from "@/modules/orders";
import { getPaymentsSnapshot } from "@/modules/payments";
import { getReceivablesSnapshot } from "@/modules/invoices";
import { getShippingSnapshot } from "@/modules/shipping";
import { getReturnsSnapshot } from "@/modules/returns";
import { formatMoneyDto } from "@/shared/money";
import { buildOrderToCashMetrics } from "./orderToCashMetrics";

export const OrderToCashPanel: React.FC<{ locale: "vi" | "en"; orders: CustomerOrder[]; refreshKey?: number }> = ({ locale, orders, refreshKey = 0 }) => {
  const vi = locale === "vi";
  const metrics = useMemo(() => {
    const payments = getPaymentsSnapshot();
    const returns = getReturnsSnapshot();
    return buildOrderToCashMetrics({
      orders,
      transactions: payments.transactions,
      shipping: getShippingSnapshot(),
      returns: returns.requests,
      receivables: getReceivablesSnapshot(),
    });
  }, [orders, refreshKey]);

  const cards = [
    {
      key: "receivables", icon: <Landmark size={15} />, label: vi ? "Công nợ còn mở" : "Open receivables",
      value: metrics.receivables ? formatMoneyDto(metrics.receivables.outstandingAmount, vi ? "vi-VN" : "en-US") : "—",
      note: metrics.receivables ? `${metrics.receivables.openInvoiceCount} ${vi ? "hóa đơn mở" : "open invoices"} · ${metrics.receivables.overdueInvoiceCount} ${vi ? "quá hạn" : "overdue"}` : (vi ? "Chưa có hóa đơn đã phát hành" : "No issued invoices yet"),
    },
    {
      key: "collection-cycle", icon: <Clock3 size={15} />, label: vi ? "Chu kỳ thu tiền đơn hàng" : "Order collection cycle",
      value: metrics.collectionCycleDays === null ? "—" : `${metrics.collectionCycleDays} ${vi ? "ngày" : "days"}`,
      note: vi ? "Từ xác nhận đơn đến lần thu tiền thành công gần nhất; không phải DSO kế toán." : "From Order confirmation to the latest successful collection; not accounting DSO.",
    },
    {
      key: "delivery", icon: <PackageCheck size={15} />, label: vi ? "Giao thành công" : "Delivery success",
      value: metrics.deliverySuccessRate === null ? "—" : `${metrics.deliverySuccessRate}%`, note: vi ? "Trên các vận đơn đã kết thúc" : "Across terminal shipments",
    },
    {
      key: "cod", icon: <Banknote size={15} />, label: vi ? "Đối soát COD" : "COD reconciliation",
      value: metrics.codReconciliationRate === null ? "—" : `${metrics.codReconciliationRate}%`, note: vi ? "COD đã matched hoặc remitted" : "COD matched or remitted",
    },
    {
      key: "return", icon: <RotateCcw size={15} />, label: vi ? "Tỷ lệ đổi/trả" : "Return rate",
      value: metrics.returnRate === null ? "—" : `${metrics.returnRate}%`,
      note: metrics.refundCycleDays === null ? (vi ? "Chưa đủ dữ liệu hoàn tiền" : "Insufficient refund data") : `${vi ? "Chu kỳ hoàn tiền" : "Refund cycle"}: ${metrics.refundCycleDays} ${vi ? "ngày" : "days"}`,
    },
  ];

  return <section data-guidance-id="reports.order-to-cash" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="border-b border-slate-100 px-5 py-4">
      <div className="text-sm font-semibold text-slate-950">{vi ? "Chất lượng vận hành Order-to-Cash" : "Order-to-Cash operational quality"}</div>
      <p className="mt-1 text-xs text-slate-500">{vi ? "Công nợ lấy từ Invoice/Allocation/Credit Note authoritative; các chỉ số còn lại lấy từ owner nghiệp vụ tương ứng." : "Receivables come from authoritative Invoice/Allocation/Credit Note data; other metrics come from their owning modules."}</p>
    </header>
    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">{cards.map((item) => <div key={item.key} className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">{item.icon}{item.label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-950">{item.value}</div>
      <div className="mt-1 text-xs leading-4 text-slate-500">{item.note}</div>
    </div>)}</div>
  </section>;
};
