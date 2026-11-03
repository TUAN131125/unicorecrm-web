import { Modal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { formatCommercialMoney } from "@/shared/lib/format/commercialMoney";
import type { QuoteLineItem } from "../../domain/model/quote.types";

/** Review the editable draft; this is not an issued document or delivery evidence. */
export function QuoteDraftReview({ open, onClose, title, buyer, lines, currency, total }: {
  open: boolean; onClose(): void; title: string; buyer?: string; lines: readonly QuoteLineItem[]; currency: string; total: number;
}) {
  const { locale } = useI18n(); const vi = locale === "vi";
  const money = (amount: number) => formatCommercialMoney({ amount: String(amount), currency }, locale);
  return <Modal isOpen={open} onClose={onClose} title={vi ? "Xem trước bản nháp" : "Draft review"} size="lg"><div className="space-y-4" data-i18n-skip="true">
    <h3 className="font-semibold">{title}</h3><p>{buyer || (vi ? "Chưa xác minh người mua" : "Buyer not verified")}</p>
    <ul className="divide-y divide-slate-100">{lines.map(line => <li key={line.id} className="flex justify-between gap-4 py-3"><div>{line.productNameSnapshot || line.productName}<p className="text-xs text-slate-500">{line.quantity} × {money(line.unitPrice ?? line.unitPriceSnapshot ?? 0)} · {vi ? "Chiết khấu" : "Discount"} {line.discountPercent}% · {vi ? "Thuế" : "Tax"} {money(line.lineTaxAmount || 0)}</p></div><span>{money(line.lineTotal ?? 0)}</span></li>)}</ul>
    <p className="text-right font-semibold">{vi ? "Tổng dự kiến" : "Estimated total"}: {money(total)}</p>
    <p className="text-xs text-slate-500">{vi ? "Giá được máy chủ xác minh khi lưu. PDF chính thức chỉ có sau khi phát hành báo giá." : "Prices are verified by the server when saving. The official PDF is available after issuance."}</p>
  </div></Modal>;
}
