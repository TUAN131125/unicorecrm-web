import { formatDateTime } from "@/shared/lib/format/date";
import { useEffect, useRef, useState } from "react";
import type { Quote } from "../../domain/model/quote.types";
import { downloadIssuedQuoteDocument, issueQuoteDocumentCommand, type IssuedQuoteDocument } from "../../public/documents";
import { Button, ConfirmDialog, Modal, Textarea } from "@/shared/components/ui";
import { useBoundFormDraft } from "@/shared/hooks/useBoundFormDraft";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createDurableId } from "@/shared/ids";
import { formatApplicationError } from "@/shared/operations";
import { useQuoteDocuments } from "../hooks/useQuoteDocuments";
import { quoteDocumentBlocker } from "../model/quoteDocumentLabels";

export function QuoteDocumentPanel({ quote, workspaceId, vi, canIssue, onCommitted, requestIssue = 0, timeZone, documents }: {
  quote: Quote; workspaceId: string; vi: boolean; canIssue: boolean; onCommitted: () => void; requestIssue?: number; timeZone?: string; documents: ReturnType<typeof useQuoteDocuments>;
}) {
  useEffect(() => { if (requestIssue > 0) { setError(null); setOpen(true); } }, [requestIssue]);
  const query = documents;
  const [open, setOpen] = useState(false); const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); const [pdf, setPdf] = useState<{ url: string; name: string } | null>(null);
  const controller = useRef<AbortController | null>(null); const mounted = useRef(true); const attempts = useRef(new Map<string, string>());
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);
  const form = useBoundFormDraft(open, quote.id, { workspaceId, id: quote.id, version: quote.resourceVersion }, () => ({ reason: "" }),
    vi ? "Phát hành tài liệu Báo giá" : "Issue Quote document", () => setOpen(false));
  const submit = async () => {
    const opening = form.opening.current;
    if (!Number.isSafeInteger(opening.version) || opening.version === undefined || opening.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false;
    const attempt = form.begin(); if (!attempt) return false; setError(null);
    const reason = form.draft.reason.trim(); const key = JSON.stringify([form.intentId, reason]);
    let identity = attempts.current.get(key); if (!identity) { identity = createDurableId("quote_document"); attempts.current.set(key, identity); }
    try {
      await issueQuoteDocumentCommand(opening.id, opening.version, reason, identity);
      if (!attempt.isCurrent()) return false;
      attempt.complete(); setOpen(false); onCommitted(); void query.refresh(); return true;
    } catch (cause) { if (attempt.isCurrent()) setError(formatApplicationError(cause, { locale: vi ? "vi" : "en" })); return false; }
    finally { attempt.finish(); }
  };
  form.bindSave(submit);
  const download = async (item: IssuedQuoteDocument, view: boolean) => {
    if (busy) return; controller.current?.abort(); const active = new AbortController(); controller.current = active; setBusy(item.documentId); setError(null);
    try {
      const result = await downloadIssuedQuoteDocument(quote.id, item.documentId, active.signal);
      if (!mounted.current || active.signal.aborted || getWorkspaceContextSnapshot().workspaceId !== workspaceId) return;
      const url = URL.createObjectURL(result.blob);
      if (view) setPdf({ url, name: result.document.fileName });
      else { const link = document.createElement("a"); link.href = url; link.download = result.document.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
    } catch (cause) { if (mounted.current && !active.signal.aborted) setError(formatApplicationError(cause, { locale: vi ? "vi" : "en" })); }
    finally { if (mounted.current && !active.signal.aborted) setBusy(null); }
  };
  const hint = quote.authoritativeActions?.issueDocument;
  const canStartIssuance = canIssue && !quote.archivedAt && !["ACCEPTED", "REJECTED", "EXPIRED"].includes(quote.status);

  return <div data-quote-documents="panel">


    {canStartIssuance && query.seller && !query.seller.ready && <ul data-quote-seller="missing" className="my-3 text-sm text-amber-800">{query.seller.blockerCodes.map(code => <li key={code}>{quoteDocumentBlocker(code, vi)}</li>)}</ul>}
    {canStartIssuance && hint && !hint.allowed && !hint.blockerCodes.includes("DOCUMENT_ALREADY_ISSUED") && <p className="my-2 text-sm text-amber-800">{quoteDocumentBlocker(hint.blockerCodes[0] ?? "", vi)}</p>}
    <div className="my-3 flex flex-wrap gap-2">
      <Button variant="secondary" disabled={query.loading || form.pending} onClick={() => void query.refresh()}>{vi ? "Làm mới tài liệu" : "Refresh documents"}</Button></div>
    {query.loading && <p role="status">{vi ? "Đang tải tài liệu…" : "Loading documents…"}</p>}
    {query.error !== null && <p role="alert">{formatApplicationError(query.error, { locale: vi ? "vi" : "en" })}</p>}
    {!query.loading && query.error === null && query.items.length === 0 && <p>{vi ? "Chưa có tài liệu được phát hành." : "No issued documents."}</p>}
    <ol className="space-y-3">{query.items.map(item => <li key={item.documentId} data-quote-document-id={item.documentId} className="rounded border border-slate-200 p-3 text-sm">
      <span>{item.fileName}</span><p>{vi ? "Đã phát hành" : "Issued"} · {formatDateTime(item.issuedAt, vi ? "vi" : "en", { timeZone })}</p>
      <p>{vi ? "Phiên bản báo giá / tài liệu" : "Quote / document revision"}: {item.quoteRevision} / {item.documentVersion} · {item.pageCount} {vi ? "trang" : "pages"}</p>
      <div className="my-2 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy !== null || form.pending} onClick={() => void download(item, true)}>{vi ? "Xem tài liệu đã phát hành" : "View issued document"}</Button>
        <Button variant="secondary" disabled={busy !== null || form.pending} onClick={() => void download(item, false)}>{vi ? "Tải PDF đã phát hành" : "Download issued PDF"}</Button></div>
    </li>)}</ol>
    {query.next && <Button variant="secondary" disabled={query.loading} onClick={() => void query.next?.()}>{vi ? "Tải thêm tài liệu" : "Load more documents"}</Button>}
    {error && !open && <p role="alert">{error}</p>}
    <Modal isOpen={open} onClose={form.requestClose} size="sm" portalToRoot variant="form" title={vi ? "Phát hành PDF chính thức" : "Issue official PDF"}
      footer={<><Button variant="secondary" disabled={form.pending} onClick={form.requestClose}>{vi ? "Hủy" : "Cancel"}</Button><Button variant="primary" loading={form.pending} onClick={() => void submit()}>{vi ? "Xác nhận phát hành" : "Confirm issue"}</Button></>}>
      
    {query.seller?.seller && <div data-quote-seller="verified" className="my-3 rounded bg-slate-50 p-3 text-sm"><strong>{query.seller.seller.legalName}</strong><p>{query.seller.seller.address}</p><p>{query.seller.seller.email} {query.seller.seller.phone}</p></div>}
      <Textarea id="quote-document-reason" label={vi ? "Ghi chú phát hành (tùy chọn)" : "Issuance note (optional)"} maxLength={500} disabled={form.pending} value={form.draft.reason} onChange={e => form.setDraft({ reason: e.target.value })} />
      {error && <p role="alert">{error}</p>}
    </Modal>
    <Modal isOpen={pdf !== null} onClose={() => setPdf(null)} size="lg" title={pdf?.name ?? "PDF"}>{pdf && <iframe title={vi ? "PDF đã phát hành" : "Issued PDF"} src={pdf.url} className="h-[70vh] w-full" />}</Modal>
    <ConfirmDialog isOpen={form.confirmOpen} onClose={() => form.setConfirmOpen(false)} onConfirm={form.discard} title={vi ? "Bỏ ghi chú chưa lưu?" : "Discard unsaved note?"}
      message={vi ? "Ghi chú chưa được phát hành. Đóng biểu mẫu?" : "The note has not been issued. Close the form?"} confirmText={vi ? "Bỏ thay đổi" : "Discard"} cancelText={vi ? "Tiếp tục" : "Continue"} type="warning" />
  </div>;
}
