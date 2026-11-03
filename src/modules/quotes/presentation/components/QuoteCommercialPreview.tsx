import { useEffect, useState } from "react";
import { Modal } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";
import { readQuoteCommercialPreview, readQuoteDocumentSeller } from "../../public/documents";
import type { QuoteCommercialPreviewRead } from "../../application/read-models/quoteDocumentModels";
import type { QuoteSellerReadiness } from "../../application/read-models/quoteDocumentModels";

export function QuoteCommercialPreview({ quoteId, workspaceId, open, onClose, vi }: {
  quoteId: string; workspaceId: string; open: boolean; onClose: () => void; vi: boolean;
}) {
  const [content, setContent] = useState<QuoteCommercialPreviewRead | null>(null); const [seller, setSeller] = useState<QuoteSellerReadiness | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const controller = new AbortController(); setContent(null); setSeller(null); setError(null);
    if (open) void Promise.all([readQuoteCommercialPreview(quoteId, controller.signal), readQuoteDocumentSeller(controller.signal)])
      .then(([quote, issuer]) => { if (!controller.signal.aborted) { setContent(quote); setSeller(issuer); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause); });
    return () => controller.abort();
  }, [quoteId, workspaceId, open]);
  return <Modal isOpen={open} onClose={onClose} size="lg" title={vi ? "Xem trước nội dung Báo giá" : "Preview Quote content"}>
    <p className="mb-4 rounded bg-amber-50 p-3 text-sm">{vi ? "Bản xem trước. Tài liệu này chưa được phát hành hoặc gửi cho khách hàng." : "Preview only. This document has not been issued or sent to the customer."}</p>
    {error !== null && <p role="alert">{formatApplicationError(error, { locale: vi ? "vi" : "en" })}</p>}
    {!content && error === null && <p role="status">{vi ? "Đang tải nội dung…" : "Loading content…"}</p>}
    {content && <div data-quote-commercial-preview="true" className="space-y-3 text-sm">
      {seller?.seller ? <div><strong>{seller.seller.legalName}</strong><p>{seller.seller.address}</p><p>{seller.seller.email} {seller.seller.phone}</p></div>
        : <p>{vi ? "Cấu hình bên bán chưa đủ để phát hành." : "Seller configuration is not ready for issuance."}</p>}
      <h2 className="text-lg font-semibold">{content.quoteNumber} · {vi ? "Phiên bản" : "Revision"} {content.quoteRevision}</h2>
      <p>{content.title}</p><p>{vi ? "Bên mua tham chiếu" : "Buyer reference"}: {content.buyerRef.type} · {content.buyerRef.id}</p>
      <p>{vi ? "Hiệu lực đến" : "Valid until"}: {content.validUntil ?? "—"}</p>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>{vi ? "Sản phẩm" : "Item"}</th><th>{vi ? "Số lượng" : "Quantity"}</th><th>{vi ? "Đơn giá" : "Unit price"}</th><th>{vi ? "Thành tiền" : "Total"}</th></tr></thead>
        <tbody>{content.lineItems.map(line => <tr key={line.id}><td className="border-t py-2">{line.productNameSnapshot}<p>{line.descriptionSnapshot}</p></td><td>{line.quantity}</td><td>{line.unitPrice.amount} {line.unitPrice.currency}</td><td>{line.lineTotal.amount} {line.lineTotal.currency}</td></tr>)}</tbody></table></div>
      <p>{vi ? "Tạm tính" : "Subtotal"}: {content.subtotal.amount} {content.currency}</p>
      <p>{vi ? "Giảm giá" : "Discount"}: {content.discountTotal.amount} {content.currency}</p><p>{vi ? "Thuế" : "Tax"}: {content.taxTotal.amount} {content.currency}</p>
      {content.adjustments?.map(a => <p key={a.id}>{a.label}: {a.amount.amount} {a.amount.currency}</p>)}
      <p className="font-semibold">{vi ? "Tổng cộng" : "Grand total"}: {content.grandTotal.amount} {content.currency}</p><p className="whitespace-pre-wrap">{content.notes}</p>
    </div>}
  </Modal>;
}
