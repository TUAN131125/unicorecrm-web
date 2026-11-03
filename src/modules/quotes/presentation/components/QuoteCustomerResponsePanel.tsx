import { useEffect, useRef, useState } from "react";
import type { Quote } from "../../domain/model/quote.types";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { ConfirmDialog } from "@/shared/components/ui";
import { createDurableId } from "@/shared/ids";
import { formatApplicationError } from "@/shared/operations";
import { saveQuoteCustomerResponse } from "../services/saveQuoteCustomerResponse";

type Opening = { kind: "acceptance" | "rejection"; quoteId: string; workspaceId: string; version: number; identity: string };
export function QuoteCustomerResponsePanel({ quote, workspaceId, canUpdate, vi, onCommitted }: {
  quote: Quote; workspaceId: string; canUpdate: boolean; vi: boolean; onCommitted: () => void;
}) {
  const [opening, setOpening] = useState<Opening | null>(null);
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<"EMAIL" | "GMAIL" | "ZALO" | "CHAT_APP" | "SMS" | "OTHER">("EMAIL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef({ quoteId: quote.id, workspaceId });
  current.current = { quoteId: quote.id, workspaceId };
  const submitted = useRef<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const guard = useUnsavedChangesGuard(() => { setOpening(null); setText(""); setError(null); });
  const dirty = opening !== null && text.length > 0;
  useEffect(() => { guard.setIsDirty(dirty); }, [dirty]);
  useEffect(() => {
    if (!opening) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (dirty || busy) window.addEventListener("beforeunload", warn);
    const unregister = registerUnsavedWork({ id: `quote-customer-response:${opening.workspaceId}:${opening.quoteId}:${opening.identity}`,
      title: vi ? "Phản hồi khách hàng" : "Customer response", isDirty: dirty || busy,
      save: async () => { if (!mounted.current || pending.current) return false; return submit(); },
      canDiscard: () => mounted.current && !pending.current,
      discard: () => { if (mounted.current && !pending.current) { setOpening(null); setText(""); setError(null); } },
    });
    return () => { unregister(); window.removeEventListener("beforeunload", warn); };
  });
  const begin = (kind: Opening["kind"]) => {
    if (quote.resourceVersion === undefined) return;
    setOpening({ kind, quoteId: quote.id, workspaceId, version: quote.resourceVersion, identity: createDurableId("quote_response") });
    setText(""); setError(null); submitted.current = null;
  };
  const submit = async () => {
    if (!mounted.current || !opening || pending.current || !text.trim() || current.current.quoteId !== opening.quoteId || current.current.workspaceId !== opening.workspaceId) return false;
    const payload = JSON.stringify({ text, channel });
    // Changed content is a new attempt; an unchanged retry retains its identity and opening version.
    const attempt = submitted.current !== null && submitted.current !== payload ? { ...opening, identity: createDurableId("quote_response") } : opening;
    setOpening(attempt); submitted.current = payload; pending.current = true; setBusy(true); setError(null);
    try {
      await saveQuoteCustomerResponse(attempt.quoteId, attempt.version, attempt.identity, attempt.kind === "rejection"
        ? { kind: "rejection", reason: text.trim() } : { kind: "acceptance", channel, description: text.trim() });
      if (mounted.current && current.current.workspaceId === attempt.workspaceId && current.current.quoteId === attempt.quoteId) { setOpening(null); setText(""); onCommitted(); }
      return true;
    } catch (err) { if (current.current.workspaceId === attempt.workspaceId) setError(formatApplicationError(err, { locale: vi ? "vi" : "en" })); return false; }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <><section className="mt-3 space-y-3" data-quote-customer-response="panel">
    <p className="my-2 text-sm text-slate-600">{vi ? "Lời khai của nhân viên chưa được xác minh độc lập. Ghi nhận đồng ý giữ Báo giá ở trạng thái Đã gửi; không chốt thắng Cơ hội." : "Employee reports are not independently verified. Reporting agreement keeps the Quote Sent and does not close its Deal as Won."}</p>
    <div className="flex flex-wrap gap-3">
      
      <button type="button" className="rounded border px-3 py-2 disabled:opacity-50" disabled={!canUpdate || !quote.authoritativeActions?.reject?.allowed || busy || opening !== null} onClick={() => begin("rejection")}>{vi ? "Ghi nhận từ chối Báo giá" : "Record Quote rejection"}</button>
    </div>
    {opening && <form className="crm-form-surface mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <h3>{opening.kind === "acceptance" ? (vi ? "Ghi nhận khách hàng thông báo đồng ý" : "Record customer-reported agreement") : (vi ? "Ghi nhận từ chối Báo giá" : "Record Quote rejection")}</h3>
      {opening.kind === "acceptance" && <label className="block">{vi ? "Kênh phản hồi" : "Response channel"}<select value={channel} disabled={busy} onChange={e => setChannel(e.target.value as typeof channel)}>{["EMAIL", "GMAIL", "ZALO", "CHAT_APP", "SMS", "OTHER"].map(x => <option key={x}>{x}</option>)}</select></label>}
      <label className="block">{opening.kind === "rejection" ? (vi ? "Lý do từ chối (bắt buộc)" : "Rejection reason (required)") : (vi ? "Nội dung nhân viên ghi nhận" : "Employee report")}
        <textarea className="block w-full rounded border p-2" required maxLength={opening.kind === "rejection" ? 500 : 2000} value={text} disabled={busy} onChange={e => setText(e.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="rounded border px-3 py-2" disabled={busy || !text.trim()}>{vi ? "Lưu ghi nhận" : "Save report"}</button>{" "}
      <button type="button" disabled={busy} onClick={() => { if (!pending.current) guard.requestClose(); }}>{vi ? "Hủy" : "Cancel"}</button>
    </form>}
    <ol className="mt-4 space-y-3">{quote.customerDecisionHistory?.map(record => <li className="rounded border p-3" key={record.id}>
      <strong>{record.decisionType === "REJECTION" ? (vi ? "Nhân viên ghi nhận từ chối" : "Employee-recorded rejection") : (vi ? "Khách hàng thông báo đồng ý" : "Customer-reported agreement")}</strong>
      <span className="ml-2 rounded bg-amber-50 px-2 text-amber-800">{vi ? "Chưa xác minh" : "Unverified"}</span>
      <p>{record.sourceDescription}</p><p><time dateTime={record.recordedAt}>{record.recordedAt}</time></p>
      <p>{vi ? "Phiên bản báo giá" : "Quote revision"}: {record.quoteRevision}</p>
    </li>)}</ol>
    {!quote.customerDecisionHistory?.length && <p className="mt-3 text-slate-500">{vi ? "Chưa có phản hồi để hiển thị." : "No responses to display."}</p>}
  </section>
    <ConfirmDialog isOpen={guard.isConfirmOpen} onClose={() => guard.setIsConfirmOpen(false)} onConfirm={() => { if (!pending.current) guard.confirmDiscard(); }}
      title={vi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"} message={vi ? "Các ghi nhận chưa được lưu. Bạn có muốn đóng biểu mẫu?" : "Your report has not been saved. Close the form?"}
      confirmText={vi ? "Bỏ thay đổi" : "Discard changes"} cancelText={vi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" />
  </>;
}
