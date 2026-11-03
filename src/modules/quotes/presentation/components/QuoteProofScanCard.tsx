import type { AcceptanceProof } from "../../public/proofs";
import { useState } from "react";
import { useQuoteProofScan } from "../hooks/useQuoteProofScan";
import { Button } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";

const states: Record<string, [string, string]> = {
  SCAN_PENDING: ["Đang chờ kiểm tra", "Awaiting scan"], SCANNING: ["Đang kiểm tra", "Scanning"], CLEAN: ["Tài liệu an toàn", "Document safety checks passed"],
  UNSAFE: ["Phát hiện nội dung không an toàn", "Unsafe content detected"], INVALID_PDF: ["PDF không hợp lệ hoặc chưa được hỗ trợ", "Invalid or unsupported PDF"],
  SCAN_FAILED: ["Kiểm tra thất bại", "Scan failed"], NEEDS_INTERVENTION: ["Đã hết lần thử — cần nộp tài liệu mới", "Retry budget exhausted — submit a new proof"],
};
export default function QuoteProofScanCard({ proof: p, workspaceId, vi }: { proof: AcceptanceProof; workspaceId: string; vi: boolean }) {
  const scan = useQuoteProofScan(p, workspaceId);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(p.proofId);
      setCopyFeedback(vi ? "Đã sao chép tham chiếu tệp." : "File reference copied.");
    } catch {
      setCopyFeedback(vi ? "Chưa thể sao chép. Vui lòng thử lại." : "The reference could not be copied. Please try again.");
    }
  };
  return <li data-quote-proofs="proof" className="my-2 break-all rounded bg-slate-50 p-2 text-xs">
    <p>{p.fileName} · {p.fileSize} bytes</p><p>{p.uploadedAt}</p>
    <p data-quote-proofs="scan-state">{states[p.scanStatus]?.[vi ? 0 : 1] ?? p.scanStatus} · {vi ? "Chưa xác minh" : "Unverified"}</p>
    {p.scanReasonCode === "EFFECTIVE_CLEAN_RESCAN_REQUIRED" && <p>{vi ? "Tài liệu cần được kiểm tra an toàn lại trước khi tải." : "This document needs another safety check before download."}</p>}
    <div className="flex gap-2"><Button variant="secondary" disabled={scan.busy} onClick={() => void scan.load()}>{vi ? "Lịch sử kiểm tra" : "Scan history"}</Button>
      {p.contentAvailable && <Button disabled={scan.busy} onClick={() => void scan.download()}>{vi ? "Tải bằng chứng PDF" : "Download proof PDF"}</Button>}
      <Button variant="secondary" onClick={() => void copyReference()}>{vi ? "Sao chép tham chiếu tệp" : "Copy file reference"}</Button></div>
    {copyFeedback && <p role="status">{copyFeedback}</p>}
    {!p.contentAvailable && <p>{vi ? "Chưa thể tải tài liệu này." : "This document cannot be downloaded yet."}</p>}
    {scan.error !== null && <p role="alert">{formatApplicationError(scan.error, { locale: vi ? "vi" : "en" })}</p>}
    {scan.history && <ol data-quote-proofs="scan-history">{scan.history.map(h => <li key={h.attemptId} className="mt-2 border-t pt-1">
      <p>#{h.attemptNumber} · {states[h.status]?.[vi ? 0 : 1] ?? h.status} · {h.startedAt} · {h.completedAt}</p>
    </li>)}</ol>}
    {scan.history?.length === 0 && <p>{vi ? "Chưa có lần kiểm tra nào." : "No scan attempts yet."}</p>}
    {scan.cursor && <Button disabled={scan.busy} onClick={() => void scan.load(true)}>{vi ? "Xem thêm lịch sử" : "More scan history"}</Button>}
  </li>;
}
