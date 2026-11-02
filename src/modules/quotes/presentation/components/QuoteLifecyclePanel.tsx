import { resolveQuoteLifecycleAvailability } from "../model/quoteActionPolicy";
import { formatDate, formatDateTime } from "@/shared/lib/format/date";
import { useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import { useEffect, useRef, useState } from "react";
import type { Quote } from "../../domain/model/quote.types";
import { Button, ConfirmDialog, Modal, Textarea } from "@/shared/components/ui";
import { useBoundFormDraft } from "@/shared/hooks/useBoundFormDraft";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createDurableId } from "@/shared/ids";
import { formatApplicationError } from "@/shared/operations";
import { saveQuoteLifecycleAction, type QuoteLifecycleAction } from "../services/saveQuoteLifecycleAction";
import { useQuoteRevisionChain } from "../hooks/useQuoteRevisionChain";

export function QuoteLifecyclePanel({ quote, workspaceId, actorId, vi, canView, canCreate, canUpdate, canArchive, onCreated, onCommitted, onOpen }: {
  quote: Quote; workspaceId: string; actorId: string; vi: boolean; canView: boolean; canCreate: boolean; canUpdate: boolean; canArchive: boolean;
  onCreated: (id: string) => void; onCommitted: () => void; onOpen: (id: string) => void;
}) {
  const { timeZone } = useWorkspaceRuntimeSettings();
  const [action, setAction] = useState<QuoteLifecycleAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef(new Map<string, string>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const form = useBoundFormDraft(action !== null, quote.id, { quoteId: quote.id, workspaceId, version: quote.resourceVersion, action },
    () => ({ reason: "" }), vi ? "Vòng đời Báo giá" : "Quote lifecycle", () => setAction(null));
  const chain = useQuoteRevisionChain(workspaceId, quote.rootQuoteId, quote.resourceVersion);
  const labels = { revise: vi ? "Tạo phiên bản mới" : "Create revision", expire: vi ? "Lưu trạng thái hết hạn" : "Persist expiration", archive: vi ? "Lưu trữ Báo giá" : "Archive Quote" };
  const begin = (kind: QuoteLifecycleAction) => { setError(null); setAction(kind); };
  const submit = async () => {
    const opening = form.opening.current;
    if (!opening.action || opening.version === undefined || opening.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false;
    const reason = form.draft.reason.trim();
    if (opening.action === "archive" && !reason) return false;
    const attempt = form.begin(); if (!attempt) return false;
    const fingerprint = JSON.stringify({ opening: form.intentId, action: opening.action, reason });
    let identity = attempts.current.get(fingerprint);
    if (!identity) { identity = createDurableId("quote_lifecycle"); attempts.current.set(fingerprint, identity); }
    setError(null);
    try {
      const result = await saveQuoteLifecycleAction(opening.action, opening.quoteId, opening.version, identity, reason, actorId);
      if (!attempt.isCurrent()) return false;
      attempt.complete(); attempt.finish(); setAction(null);
      // Let the unsaved-work registration close before navigation to the new authoritative Draft.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (mounted.current && getWorkspaceContextSnapshot().workspaceId === opening.workspaceId) {
        if (opening.action === "revise") onCreated(result.data.id); else onCommitted();
      }
      return true;
    } catch (err) { if (attempt.isCurrent()) setError(formatApplicationError(err, { locale: vi ? "vi" : "en" })); return false; }
    finally { attempt.finish(); }
  };
  form.bindSave(submit);
  const validity = quote.validity;
  const available = resolveQuoteLifecycleAvailability(quote, { canView, canCreate, canUpdate, canArchive });
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-quote-lifecycle="panel">
    <h2 className="font-semibold">{vi ? "Phiên bản, hiệu lực và lưu trữ" : "Revisions, validity and archive"}</h2>
    <p className="mt-2">{vi ? "Trạng thái" : "Status"}: {quote.status} · {vi ? "Phiên bản" : "Revision"} {quote.version}</p>
    {quote.archivedAt && <p className="mt-2 rounded bg-slate-100 p-2" data-quote-archived="true">{vi ? "Đã lưu trữ" : "Archived"} · {formatDateTime(quote.archivedAt, vi ? "vi" : "en", { timeZone })} · {quote.archiveReason}</p>}
    <p>{vi ? "Có hiệu lực đến" : "Valid until"}: {formatDate(quote.validUntil, vi ? "vi" : "en", { timeZone: "UTC" }) || (vi ? "Không đặt ngày" : "No date")}</p>
    {validity && <div data-quote-validity={validity.state}>
      <p>{validity.state === "OVERDUE" ? (vi ? "Đã quá hạn" : "Overdue") : validity.state === "VALID" ? (vi ? "Còn hiệu lực" : "Valid") : validity.state === "NO_EXPIRY" ? (vi ? "Không có hạn ngày" : "No date expiry") : (vi ? "Chưa thể kiểm tra hiệu lực. Vui lòng tải lại." : "Validity could not be checked. Please reload.")}</p>
      
      
    </div>}
    <div className="my-3 flex flex-wrap gap-2">
      <Button variant="secondary" disabled={!available.revise || form.pending || action !== null} onClick={() => begin("revise")}>{labels.revise}</Button>
      <Button variant="secondary" disabled={!available.expire || form.pending || action !== null} onClick={() => begin("expire")}>{labels.expire}</Button>
      <Button variant="secondary" disabled={!available.archive || form.pending || action !== null} onClick={() => begin("archive")}>{labels.archive}</Button>
    </div>
    <h3 className="font-semibold">{vi ? "Lịch sử phiên bản" : "Revision history"}</h3>
    {chain.error !== null && <p role="alert">{formatApplicationError(chain.error, { locale: vi ? "vi" : "en" })}<button type="button" onClick={() => void chain.retry()}>{vi ? "Thử lại" : "Retry"}</button></p>}
    <ol className="mt-2 space-y-2" data-quote-revision-chain="true">{chain.items.map(item => <li key={item.id}>
      <button type="button" className="text-left text-violet-700 underline" onClick={() => onOpen(item.id)}>{item.quoteNumber} · {vi ? "Phiên bản" : "Revision"} {item.version} · {item.status}{item.archivedAt ? (vi ? " · Đã lưu trữ" : " · Archived") : ""}</button>
    </li>)}</ol>
    {chain.loading && <p>{vi ? "Đang tải lịch sử phiên bản…" : "Loading revision history…"}</p>}
    {chain.hasNext && <Button variant="secondary" disabled={chain.loading} onClick={() => void chain.next()}>{vi ? "Tải phiên bản tiếp theo" : "Load more revisions"}</Button>}
    <Modal isOpen={action !== null} onClose={form.requestClose} size="sm" variant="form" title={action ? labels[action] : ""}
      footer={<><Button variant="secondary" disabled={form.pending} onClick={form.requestClose}>{vi ? "Hủy" : "Cancel"}</Button>
        <Button loading={form.pending} disabled={action === "archive" && !form.draft.reason.trim()} onClick={() => void submit()}>{vi ? "Xác nhận" : "Confirm"}</Button></>}>
      <p className="mb-3">{action === "revise" ? (vi ? "Tạo bản nháp mới từ báo giá này. Phát hành bản mới trước khi gửi khách hàng." : "Create a new draft from this quote. Issue the new revision before sending it to the customer.") : action === "archive" ? (vi ? "Lưu trữ giữ nguyên lịch sử. Chỉ có thể lưu trữ khi không còn giao dịch liên quan cần xử lý. Không thể khôi phục sau khi lưu trữ." : "Archiving preserves history and requires all related transactions to be resolved. Archived quotes cannot be restored.") : (vi ? "Đánh dấu báo giá đã hết hạn. Cơ hội và phản hồi khách hàng được giữ nguyên." : "Mark the quote as expired. Its opportunity and customer responses are preserved.")}</p>
      {action !== "revise" && <Textarea id="quote-lifecycle-reason" label={action === "archive" ? (vi ? "Lý do lưu trữ (bắt buộc)" : "Archive reason (required)") : (vi ? "Lý do (tùy chọn)" : "Reason (optional)")} maxLength={500} disabled={form.pending} value={form.draft.reason} onChange={e => form.setDraft({ reason: e.target.value })} />}
      {error && <p role="alert">{error}</p>}
    </Modal>
    <ConfirmDialog isOpen={form.confirmOpen} onClose={() => form.setConfirmOpen(false)} onConfirm={form.discard}
      title={vi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"} message={vi ? "Lý do chưa được lưu. Đóng biểu mẫu?" : "The reason has not been saved. Close the form?"}
      confirmText={vi ? "Bỏ thay đổi" : "Discard changes"} cancelText={vi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" />
  </section>;
}
