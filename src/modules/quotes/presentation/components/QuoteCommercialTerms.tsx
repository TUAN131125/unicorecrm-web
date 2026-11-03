import type { PaymentAgreementSnapshot, PaymentDueRule } from "@/shared/order-to-cash";
import { formatCommercialMoney } from "@/shared/lib/format/commercialMoney";
import { formatDate } from "@/shared/lib/format/date";

function dueLabel(rule: PaymentDueRule, vi: boolean): string {
  const date = (value: string) => formatDate(value, vi ? "vi" : "en", { timeZone: "UTC" });
  switch (rule.type) {
    case "FIXED_DATE": return date(rule.date);
    case "EVENT_RELATIVE": {
      const event = ({ ORDER_CONFIRMED: vi ? "xác nhận đơn hàng" : "Order confirmation", INVOICE_ISSUED: vi ? "phát hành hóa đơn" : "invoice issuance", DELIVERY_CONFIRMED: vi ? "xác nhận giao hàng" : "delivery confirmation", ACCEPTANCE_CONFIRMED: vi ? "xác nhận nghiệm thu" : "acceptance confirmation" })[rule.event];
      return rule.offsetDays === 0 ? event : `${event} · ${rule.offsetDays} ${rule.dayBasis === "BUSINESS" ? (vi ? "ngày làm việc" : "business days") : (vi ? "ngày" : "days")}`;
    }
    case "OPERATIONAL_PRECONDITION": return `${({ BOOKING: vi ? "Trước khi đặt dịch vụ" : "Before booking", DISPATCH: vi ? "Trước khi giao hàng" : "Before dispatch", COMPLETION: vi ? "Trước khi hoàn thành" : "Before completion" })[rule.operation]} · ${rule.leadDays} ${vi ? "ngày" : "days"}`;
    case "MILESTONE": return `${vi ? "Mốc" : "Milestone"} ${rule.milestoneCode} · ${rule.offsetDays} ${vi ? "ngày" : "days"}`;
    case "RECURRING_FINITE": return `${date(rule.firstDueDate)} · ${{ WEEKLY: vi ? "hằng tuần" : "weekly", MONTHLY: vi ? "hằng tháng" : "monthly", QUARTERLY: vi ? "hằng quý" : "quarterly" }[rule.interval]} · ${rule.count} ${vi ? "kỳ" : "periods"}`;
  }
}

/** Displays the saved agreement; it never allocates or recalculates payment amounts. */
export function QuoteCommercialTerms({ agreement, notes, vi }: { agreement?: PaymentAgreementSnapshot; notes?: string; vi: boolean }) {
  if (!agreement && !notes) return null;
  const methods: Record<string, string> = { BANK_TRANSFER: vi ? "Chuyển khoản" : "Bank transfer", CASH: vi ? "Tiền mặt" : "Cash", CARD: vi ? "Thẻ" : "Card", COD: vi ? "Thu hộ khi giao hàng" : "Cash on delivery", ONLINE_PAYMENT: vi ? "Thanh toán trực tuyến" : "Online payment" };
  return <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed">
    <h2 className="text-base font-medium text-slate-900">{vi ? "Điều khoản và ghi chú" : "Terms and notes"}</h2>
    {agreement && <ol className="mt-4 divide-y divide-slate-100">{agreement.lines.map(line => <li key={line.id} className="space-y-1 py-3 first:pt-0">
      <div className="flex flex-wrap justify-between gap-2"><span>{line.label}</span><span>{formatCommercialMoney(line.previewAmount, vi ? "vi" : "en")}</span></div>
      <p className="text-slate-500">{dueLabel(line.dueRule, vi)}</p>
      <p className="text-slate-500">{line.allowedMethodCodes.map(code => methods[code] ?? code).join(" · ")}</p>
    </li>)}</ol>}
    {notes && <p className="mt-4 whitespace-pre-wrap text-slate-600">{notes}</p>}
  </section>;
}
