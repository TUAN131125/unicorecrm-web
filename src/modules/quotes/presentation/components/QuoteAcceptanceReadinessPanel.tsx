import QuoteAcceptanceProofsSection from "./QuoteAcceptanceProofsSection";
import { useEffect, useRef, useState } from "react";
import { readQuoteAcceptanceReadiness, type QuoteAcceptanceReadiness } from "../../public/acceptance";
import { readQuoteDocuments, type IssuedQuoteDocument } from "../../public/documents";
import { formatApplicationError } from "@/shared/operations";

const labels: Record<string, [string, string]> = {
  BLOCKED_CONTRACT_IDENTITY_AUTHORITY_SOURCE: ["Chưa có nguồn xác minh danh tính và quyền đại diện được chấp thuận.", "Approved identity and signer authority sources are unavailable."],
  BLOCKED_CONTRACT_TRUSTED_SCANNER: ["Chưa có bộ kiểm tra tài liệu đáng tin cậy.", "Trusted document scanning is unavailable."],
  BLOCKED_CONTRACT_ACCEPTANCE_PROOF_STORAGE: ["Chưa có kho bằng chứng khách hàng được bảo vệ.", "Protected customer-proof storage is unavailable."],
  VERIFICATION_POLICY_MISSING_OR_INVALID: ["Chính sách xác minh Workspace chưa được cấu hình hợp lệ.", "Workspace verification policy is unavailable."],
  ISSUED_DOCUMENT_SELECTION_REQUIRED: ["Chọn tài liệu đã phát hành để kiểm tra.", "Select the issued document to review."],
  LINKED_ACCEPTANCE_BLOCKED_GATE_C: ["Chưa thể ghi nhận chấp nhận cho báo giá này.", "Acceptance cannot be recorded for this quote yet."],
  QUOTE_STATE_INVALID: ["Trạng thái Báo giá chưa đủ điều kiện xác minh chấp nhận.", "The Quote state is ineligible for acceptance verification."],
  APPROVAL_BINDING_STALE: ["Nội dung báo giá đã thay đổi. Hãy tải lại và phát hành tài liệu hiện hành.", "The Quote changed. Reload and issue the current document."],
  COMMERCIAL_DELIVERY_EVIDENCE_UNAVAILABLE: ["Chưa có ghi nhận gửi hợp lệ cho nội dung và phiên bản hiện hành; đây vẫn không phải bằng chứng khách hàng đồng ý.", "Current revision/content delivery evidence is unavailable; delivery is not customer consent."],
  DOCUMENT_APPROVAL_POLICY_STALE: ["Cần kiểm tra lại tài liệu đã phát hành trước khi tiếp tục.", "Review the issued document before continuing."],
  QUOTE_EXPIRED: ["Báo giá đã hết hạn.", "The quote has expired."],
  DOCUMENTARY_VALUE_LIMIT_OR_CURRENCY: ["Giá trị hoặc tiền tệ của báo giá cần được xem xét bổ sung.", "The quote value or currency requires additional review."],
};
export default function QuoteAcceptanceReadinessPanel({ quoteId, workspaceId, resourceVersion, vi }: {
  quoteId: string; workspaceId: string; resourceVersion?: number; vi: boolean;
}) {
  const [readiness, setReadiness] = useState<QuoteAcceptanceReadiness | null>(null);
  const [documents, setDocuments] = useState<readonly IssuedQuoteDocument[]>([]);
  const [documentCursor, setDocumentCursor] = useState<string>();
  const [loadingDocuments, setLoadingDocuments] = useState(false); const documentController = useRef<AbortController | null>(null);
  const [documentId, setDocumentId] = useState(""); const [error, setError] = useState<unknown>(null); const [attempt, setAttempt] = useState(0);
  useEffect(() => { documentController.current?.abort(); setDocumentId(""); setDocuments([]); setDocumentCursor(undefined); setLoadingDocuments(false); return () => documentController.current?.abort(); }, [quoteId, workspaceId]);
  useEffect(() => {
    const controller = new AbortController(); setReadiness(null); setError(null);
    void Promise.all([readQuoteAcceptanceReadiness(quoteId, documentId || undefined, controller.signal), readQuoteDocuments(quoteId, undefined, controller.signal)])
      .then(([result, page]) => { if (!controller.signal.aborted) { setReadiness(result); setDocuments(previous => documentId ? [...page.items, ...previous.filter(d => !page.items.some(p => p.documentId === d.documentId))] : page.items); if (!documentId) setDocumentCursor(page.nextCursor); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause); });
    return () => controller.abort();
  }, [quoteId, workspaceId, resourceVersion, documentId, attempt]);
  const moreDocuments = async () => {
    if (!documentCursor || loadingDocuments) return;
    documentController.current?.abort(); const active = new AbortController(); documentController.current = active; setLoadingDocuments(true);
    try {
      const page = await readQuoteDocuments(quoteId, documentCursor, active.signal);
      if (active.signal.aborted) return;
      setDocuments(previous => [...previous, ...page.items.filter(d => !previous.some(p => p.documentId === d.documentId))]); setDocumentCursor(page.nextCursor);
    } catch (cause) { if (!active.signal.aborted) setError(cause); }
    finally { if (!active.signal.aborted) setLoadingDocuments(false); }
  };
  return <section data-quote-acceptance="readiness" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="font-semibold">{vi ? "Bằng chứng chấp nhận của khách hàng" : "Customer acceptance evidence"}</h2>
    <p className="mt-2 text-sm">{vi ? "Phản hồi khách hàng thông báo đồng ý vẫn Chưa xác minh. Cần xác minh người đại diện và bằng chứng trước khi ghi nhận chấp nhận đã xác minh." : "Reported agreement remains Unverified. Verify signing authority and evidence before recording verified acceptance."}</p>
    {error !== null ? <p role="alert">{formatApplicationError(error, { locale: vi ? "vi" : "en" })} <button onClick={() => setAttempt(x => x + 1)}>{vi ? "Thử lại" : "Retry"}</button></p> : !readiness ? <p role="status">{vi ? "Đang kiểm tra điều kiện…" : "Checking prerequisites…"}</p> : <>
      <label className="mt-3 block">{vi ? "Tài liệu đã phát hành" : "Issued document"}<select data-quote-acceptance="document" value={documentId} onChange={e => setDocumentId(e.target.value)} className="ml-2 rounded border p-2">
        <option value="">{vi ? "Chọn tài liệu" : "Select document"}</option>{documents.map(d => <option key={d.documentId} value={d.documentId}>{d.fileName}</option>)}
      </select></label>
      {documentCursor && <button disabled={loadingDocuments} onClick={() => void moreDocuments()}>{vi ? "Xem thêm tài liệu đã phát hành" : "Load more issued documents"}</button>}
      
      <ul className="my-2 list-inside list-disc text-sm">{readiness.blockerCodes.filter(code => !code.startsWith("BLOCKED_CONTRACT_") && code !== "VERIFICATION_POLICY_MISSING_OR_INVALID").map(code => <li key={code}>{labels[code]?.[vi ? 0 : 1] ?? (vi ? "Chưa thể xác minh. Vui lòng liên hệ quản trị viên." : "Verification is not available. Please contact your administrator.")}</li>)}</ul>
      <QuoteAcceptanceProofsSection key={`${workspaceId}:${quoteId}:${documentId}`} readiness={readiness} workspaceId={workspaceId} vi={vi} />
      
    </>}
  </section>;
}
