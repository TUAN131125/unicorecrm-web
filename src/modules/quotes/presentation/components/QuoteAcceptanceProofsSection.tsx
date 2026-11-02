import { lazy, Suspense } from "react";
const QuoteIdentityAuthorityPanel = lazy(() => import("./QuoteIdentityAuthorityPanel"));
import { useEffect, useRef, useState } from "react";
import { quoteProofs, type AcceptanceCase, type AcceptanceProof, type ProofEvidenceType } from "../../public/proofs";
import type { QuoteAcceptanceReadiness } from "../../public/acceptance";
import { Button, Modal, ConfirmDialog } from "@/shared/components/ui";
import { useBoundFormDraft } from "@/shared/hooks/useBoundFormDraft";
import { formatApplicationError } from "@/shared/operations";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import QuoteProofScanCard from "./QuoteProofScanCard";

export default function QuoteAcceptanceProofsSection({ readiness, workspaceId, vi }: { readiness: QuoteAcceptanceReadiness; workspaceId: string; vi: boolean }) {
  const [cases, setCases] = useState<AcceptanceCase[]>([]); const [selected, setSelected] = useState<AcceptanceCase | null>(null);
  const [proofs, setProofs] = useState<AcceptanceProof[]>([]); const [next, setNext] = useState<string>();
  const [caseNext, setCaseNext] = useState<string>();
  const [loading, setLoading] = useState(false); const [error, setError] = useState<unknown>(null); const [open, setOpen] = useState(false);
  const [validation, setValidation] = useState(""); const [notice, setNotice] = useState(""); const controller = useRef<AbortController | null>(null); const mounted = useRef(true);
  const keys = useRef(new Map<string, string>()); const createKey = useRef(crypto.randomUUID());
  const pollCount = useRef(0);
  const binding = readiness.binding; const quoteId = readiness.quoteId;
  const form = useBoundFormDraft(open, selected?.caseId ?? "", { workspaceId, quoteId, caseId: selected?.caseId, version: selected?.resourceVersion },
    () => ({ file: null as File | null, evidenceType: "SUPPORTING_DOCUMENT" as ProofEvidenceType }), "Customer proof upload", () => setOpen(false),
    value => JSON.stringify([value.evidenceType, value.file?.name, value.file?.size, value.file?.lastModified]));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  const current = (active: AbortController) => mounted.current && !active.signal.aborted && workspaceId === getWorkspaceContextSnapshot().workspaceId;
  const refresh = async (cursor?: string, caseCursor?: string) => {
    controller.current?.abort(); const active = new AbortController(); controller.current = active; setLoading(true); setError(null);
    try {
      const page = cursor ? { items: cases, nextCursor: caseNext } : await quoteProofs().cases(quoteId, caseCursor, active.signal); if (!current(active)) return;
      const combined = caseCursor ? [...cases, ...page.items] : page.items;
      setCases(combined); setCaseNext(page.nextCursor); const row = combined.find(c => c.documentId === binding?.documentId) ?? null; setSelected(row);
      if (row) { const result = await quoteProofs().proofs(quoteId, row.caseId, cursor, active.signal); if (!current(active)) return; setProofs(old => cursor ? [...old, ...result.items] : result.items); setNext(result.nextCursor); }
      else { setProofs([]); setNext(undefined); }
    } catch (cause) { if (current(active)) setError(cause); }
    finally { if (current(active)) setLoading(false); }
  };
  useEffect(() => { void refresh(); return () => controller.current?.abort(); }, [quoteId, workspaceId, binding?.documentId]);
  useEffect(() => { pollCount.current = 0; }, [quoteId, workspaceId, binding?.documentId]);
  useEffect(() => {
    if (loading || open || form.pending || next || caseNext || error !== null || pollCount.current >= 24 || !proofs.some(p => p.scanStatus === "SCAN_PENDING" || p.scanStatus === "SCANNING")) return;
    const timer = setTimeout(() => { pollCount.current++; void refresh(); }, 5000); return () => clearTimeout(timer);
  }, [proofs, loading, open, form.pending, next, caseNext, error]);
  const create = async () => {
    if (!binding || loading) return;
    controller.current?.abort(); const active = new AbortController(); controller.current = active; setLoading(true); setError(null);
    try {
      const row = await quoteProofs().create(quoteId, { documentId: binding.documentId, quoteRevision: binding.quoteRevision, pdfSha256: binding.pdfSha256, commercialContentFingerprint: binding.commercialContentFingerprint },
        { idempotencyKey: createKey.current, expectedVersion: readiness.resourceVersion, signal: active.signal });
      if (!current(active)) return; setSelected(row); setCases(old => [...old.filter(c => c.caseId !== row.caseId), row]);
    } catch (cause) { if (current(active)) setError(cause); }
    finally { if (current(active)) setLoading(false); }
  };
  const submit = async () => {
    const source = form.opening.current; const file = form.draft.file;
    if (!source.caseId || source.version === undefined || !file || file.size < 1 || file.size > 10485760 || file.type !== "application/pdf") {
      setValidation(!file ? (vi ? "Chọn tài liệu PDF." : "Choose a PDF document.") : file.type !== "application/pdf" ? (vi ? "Chỉ nhận định dạng PDF." : "Only PDF is supported.") : file.size > 10485760 ? (vi ? "PDF vượt giới hạn 10 MiB." : "PDF exceeds the 10 MiB limit.") : (vi ? "Tài liệu rỗng hoặc hồ sơ không hợp lệ." : "Empty document or invalid case.")); return false;
    }
    const attempt = form.begin(); if (!attempt) return false; setError(null); setValidation("");
    const signature = JSON.stringify([form.intentId, file.name, file.size, file.lastModified, form.draft.evidenceType]);
    let key = keys.current.get(signature); if (!key) { key = crypto.randomUUID(); keys.current.set(signature, key); }
    const active = new AbortController(); controller.current?.abort(); controller.current = active;
    try {
      const result = await quoteProofs().upload(source.quoteId, source.caseId, file, form.draft.evidenceType, { idempotencyKey: key, expectedVersion: source.version, signal: active.signal });
      if (!attempt.isCurrent() || !current(active)) return false;
      setSelected(result.case); const proof = result.proof; if (proof) setProofs(old => [...old.filter(p => p.proofId !== proof.proofId), proof]);
      setNotice(vi ? "Tài liệu đã được tiếp nhận và đang chờ kiểm tra an toàn." : "Document received and awaiting safety checks.");
      attempt.complete(); setOpen(false); return true;
    } catch (cause) { if (attempt.isCurrent() && current(active)) setError(cause); return false; }
    finally { attempt.finish(); }
  };
  form.bindSave(submit);
  return <section data-quote-proofs="panel" className="mt-4 rounded border p-3">
    <h3 className="font-semibold">{vi ? "Hồ sơ bằng chứng khách hàng" : "Customer proof case"}</h3>
    
    {notice && <p role="status">{notice}</p>}
    {error !== null && <p role="alert">{formatApplicationError(error, { locale: vi ? "vi" : "en" })}</p>}
    <div className="my-2 flex gap-2"><Button variant="secondary" disabled={loading || form.pending} onClick={() => void refresh()}>{vi ? "Thử lại / Làm mới hồ sơ" : "Retry / Refresh case"}</Button>
      {!selected && !caseNext && <Button disabled={!readiness.proofCollectionAllowed || !binding || loading} onClick={() => void create()}>{vi ? "Tạo hồ sơ bằng chứng" : "Create proof case"}</Button>}
      {selected && <Button disabled={!readiness.proofCollectionAllowed || loading || form.pending} onClick={() => { setError(null); setValidation(""); setOpen(true); }}>{vi ? "Tải lên bằng chứng" : "Upload proof"}</Button>}</div>
    
    {loading && <p role="status">{vi ? "Đang tải hồ sơ…" : "Loading case…"}</p>}
    {!loading && selected && !proofs.length && <p>{vi ? "Chưa có tài liệu bằng chứng." : "No proof documents yet."}</p>}
    <ul>{proofs.map(p => <QuoteProofScanCard key={p.proofId} proof={p} workspaceId={workspaceId} vi={vi} />)}</ul>
    {next && <Button disabled={loading || form.pending} onClick={() => void refresh(next)}>{vi ? "Xem thêm" : "Load more"}</Button>}
    {caseNext && <Button disabled={loading || form.pending} onClick={() => void refresh(undefined, caseNext)}>{vi ? "Xem thêm hồ sơ tài liệu" : "Load more document cases"}</Button>}
    {!selected && caseNext && <p>{vi ? "Còn hồ sơ ở trang tiếp theo; tải thêm để tìm đúng tài liệu trước khi tạo mới." : "More cases remain; load the next page to locate this document before creating a case."}</p>}
    {selected && <Suspense fallback={null}><QuoteIdentityAuthorityPanel key={workspaceId+selected.caseId} quoteId={quoteId} caseId={selected.caseId} workspaceId={workspaceId} proofs={proofs} vi={vi} /></Suspense>}
    <Modal isOpen={open} onClose={form.requestClose} variant="form" size="sm" title={vi ? "Tải lên bằng chứng" : "Upload proof"}>
      <label>{vi ? "Loại tài liệu" : "Evidence type"}<select value={form.draft.evidenceType} disabled={form.pending} onChange={e => form.setDraft(v => ({ ...v, evidenceType: e.target.value as ProofEvidenceType }))}>
        <option value="SUPPORTING_DOCUMENT">{vi ? "Tài liệu bổ sung" : "Supporting document"}</option><option value="CUSTOMER_CONSENT">{vi ? "Tài liệu đồng ý" : "Customer consent document"}</option><option value="IDENTITY">{vi ? "Tài liệu danh tính" : "Identity document"}</option><option value="DELEGATION">{vi ? "Tài liệu ủy quyền" : "Delegation document"}</option>
      </select></label>
      <input aria-label={vi ? "PDF bằng chứng" : "Proof PDF"} type="file" accept="application/pdf,.pdf" disabled={form.pending} onChange={e => form.setDraft(v => ({ ...v, file: e.target.files?.[0] ?? null }))} />
      {validation && <p role="alert">{validation}</p>}
      <p>{vi ? "PDF tối đa 10 MiB · Tài liệu sẽ được kiểm tra an toàn trước khi sử dụng" : "PDF up to 10 MiB · Documents are checked for safety before use"}</p>{form.pending && <p role="status">{vi ? "Đang tiếp nhận tài liệu…" : "Uploading document…"}</p>}
      {error !== null && <p role="alert">{formatApplicationError(error, { locale: vi ? "vi" : "en" })}</p>}
      <Button disabled={form.pending || !form.draft.file} onClick={() => void submit()}>{vi ? "Tiếp nhận tài liệu" : "Submit document"}</Button>
    </Modal>
    <ConfirmDialog isOpen={form.confirmOpen} onClose={() => form.setConfirmOpen(false)} onConfirm={form.discard} title={vi ? "Bỏ tài liệu chưa tải lên?" : "Discard pending upload?"} message={vi ? "Tài liệu đang chọn chưa được lưu." : "The selected document has not been stored."} />
  </section>;
}
