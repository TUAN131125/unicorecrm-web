import { useEffect, useRef, useState } from "react";
import { quoteProofs, type AcceptanceProof, type ProofScanHistoryItem } from "../../public/proofs";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useQuoteProofScan(proof: AcceptanceProof, workspaceId: string) {
  const [history, setHistory] = useState<ProofScanHistoryItem[] | null>(null);
  const [cursor, setCursor] = useState<string>(); const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [proof.proofId, workspaceId]);
  const current = (active: AbortController) => !active.signal.aborted && getWorkspaceContextSnapshot().workspaceId === workspaceId;
  const load = async (more = false) => {
    if (busy) return; controller.current?.abort(); const active = new AbortController(); controller.current = active; setBusy(true); setError(null);
    try {
      const page = await quoteProofs().history(proof.quoteId, proof.caseId, proof.proofId, more ? cursor : undefined, active.signal);
      if (!current(active)) return; setHistory(old => more ? [...(old ?? []), ...page.items] : page.items); setCursor(page.nextCursor);
    } catch (cause) { if (current(active)) setError(cause); }
    finally { if (current(active)) setBusy(false); }
  };
  const download = async () => {
    if (busy || !proof.contentAvailable) return; controller.current?.abort(); const active = new AbortController(); controller.current = active; setBusy(true); setError(null);
    try {
      const file = await quoteProofs().download(proof.quoteId, proof.caseId, proof.proofId, active.signal); if (!current(active)) return;
      const url = URL.createObjectURL(file.blob);
      try { const link = document.createElement("a"); link.href = url; link.download = file.fileName; link.click(); }
      finally { URL.revokeObjectURL(url); }
    } catch (cause) { if (current(active)) setError(cause); }
    finally { if (current(active)) setBusy(false); }
  };
  return { history, cursor, busy, error, load, download };
}
