import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Button } from "@/shared/components/ui";
import { createDurableId } from "@/shared/ids";
import { formatMoneyDto } from "@/shared/money";
import { formatApplicationError } from "@/shared/operations";
import { consentCustomerAcceptance, previewCustomerAcceptance, type CustomerAcceptancePreview, type SalesAcceptance } from "../../public/salesAcceptance";

export function CustomerQuoteAcceptancePage() {
  const { token = "" } = useParams<{ token: string }>(); const { locale } = useI18n(); const vi = locale === "vi";
  const [preview, setPreview] = useState<CustomerAcceptancePreview | null>(null);
  const [consent, setConsent] = useState<SalesAcceptance | null>(null);
  const [agree, setAgree] = useState(false); const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null); const busy = useRef(false);
  const intent = useRef(createDurableId("customer_quote_consent")); const active = useRef(true);
  useEffect(() => {
    active.current = true; const controller = new AbortController(); setPreview(null); setConsent(null); setAgree(false); setError(null);
    void previewCustomerAcceptance(token, controller.signal).then(setPreview).catch(cause => { if (!controller.signal.aborted) setError(formatApplicationError(cause, { locale })); });
    return () => { active.current = false; controller.abort(); };
  }, [token, locale]);
  const submit = async () => {
    if (!preview || !agree || busy.current || consent) return;
    busy.current = true; setPending(true); setError(null);
    try { const result = await consentCustomerAcceptance(token, preview.termsVersion, intent.current); if (active.current) setConsent(result); }
    catch (cause) { if (active.current) setError(formatApplicationError(cause, { locale })); }
    finally { busy.current = false; if (active.current) setPending(false); }
  };
  return <main data-customer-quote-acceptance="page" className="mx-auto min-h-screen max-w-3xl space-y-5 bg-white p-6 sm:p-10">
    <h1 className="text-2xl font-semibold">{vi ? "Xác nhận chấp nhận báo giá" : "Accept quotation"}</h1>
    <p>{vi ? "Mở liên kết không làm thay đổi báo giá. Vui lòng kiểm tra nội dung trước khi xác nhận." : "Opening this link does not change the quotation. Review its contents before confirming."}</p>
    {error && <div role="alert" className="rounded border border-rose-200 p-4"><p>{error}</p><p>{vi ? "Liên kết có thể đã hết hạn, đã sử dụng hoặc báo giá đã thay đổi. Hãy liên hệ người gửi để được hỗ trợ." : "The link may be expired, used, or bound to a changed quote. Contact the sender for assistance."}</p></div>}
    {!preview && !error && <p role="status">{vi ? "Đang tải báo giá…" : "Loading quotation…"}</p>}
    {preview && <>
      <section className="space-y-2 rounded border p-4"><h2 className="text-xl font-semibold">{preview.quoteNumber}</h2><p>{preview.buyerName}</p>
        <p>{vi ? "Phiên bản báo giá / tài liệu" : "Quote / document revision"}: {preview.quoteRevision} / {preview.documentVersion}</p>
        <p>{vi ? "Hiệu lực đến" : "Valid until"}: {preview.validUntil ?? "—"}</p>
        <p className="font-semibold">{vi ? "Tổng giá trị" : "Grand total"}: {formatMoneyDto(preview.grandTotal, locale)}</p></section>
      <table className="w-full text-left text-sm"><thead><tr><th>{vi ? "Sản phẩm/dịch vụ" : "Product/service"}</th><th>{vi ? "Số lượng" : "Quantity"}</th><th>{vi ? "Đơn giá" : "Unit price"}</th><th>{vi ? "Thành tiền" : "Line total"}</th></tr></thead><tbody>{preview.lineItems.map(line => <tr key={line.id}><td className="py-3">{line.productNameSnapshot}</td><td>{line.quantity}</td><td>{formatMoneyDto(line.unitPrice, locale)}</td><td>{formatMoneyDto(line.lineTotal, locale)}</td></tr>)}</tbody></table>
      {preview.paymentAgreement && <section className="rounded border p-4"><h2 className="font-semibold">{vi ? "Thỏa thuận thanh toán" : "Payment agreement"}</h2>{preview.paymentAgreement.lines.map(line => <p key={line.id}>{line.label}: {formatMoneyDto(line.previewAmount, locale)}</p>)}</section>}
      <section className="rounded border p-4"><h2 className="font-semibold">{vi ? "Điều khoản chấp nhận" : "Acceptance terms"}</h2><p className="mt-2">{preview.terms}</p><p className="mt-2 text-sm">{vi ? "Xác nhận qua liên kết không phải xác minh danh tính hay thẩm quyền đại diện pháp lý của tổ chức." : "Link consent does not verify personal identity or legal authority to represent an organization."}</p></section>
      {consent ? <div role="status" className="rounded border border-emerald-200 p-4"><h2 className="font-semibold">{vi ? "Đã ghi nhận chấp nhận báo giá" : "Quotation acceptance recorded"}</h2><p>{vi ? "Hệ thống đã lưu sự đồng ý và đang xử lý Order nháp. Nhân viên phụ trách sẽ tiếp tục liên hệ với bạn." : "Your consent is saved and the draft Order is being processed. Your contact will follow up."}</p></div>
        : <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-4"><label className="flex gap-3"><input type="checkbox" checked={agree} onChange={event => setAgree(event.target.checked)} disabled={pending} required /><span>{vi ? "Tôi đã đọc và đồng ý nội dung, giá trị và điều khoản của phiên bản báo giá này." : "I have read and accept this quotation version, its amount and terms."}</span></label><Button type="submit" disabled={!agree || pending}>{pending ? (vi ? "Đang ghi nhận…" : "Recording…") : (vi ? "Chấp nhận báo giá" : "Accept quotation")}</Button></form>}
    </>}
  </main>;
}
