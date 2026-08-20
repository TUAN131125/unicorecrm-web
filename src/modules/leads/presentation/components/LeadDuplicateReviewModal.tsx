import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Merge, ShieldCheck } from "lucide-react";
import { Button, Modal, Textarea } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Lead } from "../../domain/model/lead.types";
import { getLeadDuplicateMatchKeys } from "../../application/queries/leadIdentityResolution";

interface LeadDuplicateReviewModalProps {
  isOpen: boolean;
  lead?: Lead;
  candidates: Lead[];
  onClose: () => void;
  onMerge: (survivorLeadId: string, duplicateLeadIds: string[], reason: string) => Promise<void>;
  onConfirmDistinct: (candidateLeadIds: string[], reason: string) => Promise<void>;
}

export function LeadDuplicateReviewModal({ isOpen, lead, candidates, onClose, onMerge, onConfirmDistinct }: LeadDuplicateReviewModalProps) {
  const { locale } = useI18n();
  const [survivorId, setSurvivorId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const records = useMemo(() => lead ? [lead, ...candidates] : [], [lead, candidates]);

  useEffect(() => {
    if (isOpen && lead) {
      setSurvivorId(lead.id);
      setReason("");
    }
  }, [isOpen, lead]);

  if (!lead) return null;

  const run = async (kind: "merge" | "distinct") => {
    if (!reason.trim() || saving) return;
    setSaving(true);
    try {
      if (kind === "merge") await onMerge(survivorId, records.filter((record) => record.id !== survivorId).map((record) => record.id), reason.trim());
      else await onConfirmDistinct(candidates.map((candidate) => candidate.id), reason.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} title={locale === "vi" ? "Rà soát Lead nghi trùng" : "Review possible duplicate Leads"} size="sm">
      <div className="space-y-4 text-left">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">
          <div className="flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{locale === "vi" ? "Không tự động xóa bản ghi. Khi gộp, Lead nguồn được lưu trữ và liên kết với Lead sống sót để bảo toàn lịch sử." : "Records are never auto-deleted. Merged source Leads are archived and linked to the survivor to preserve lineage."}</span></div>
        </div>
        <div className="space-y-2">
          {records.map((record) => {
            const matches = record.id === lead.id ? [] : getLeadDuplicateMatchKeys(lead, record);
            return (
              <label key={record.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-indigo-300">
                <input type="radio" name="survivor" value={record.id} checked={survivorId === record.id} onChange={() => setSurvivorId(record.id)} className="mt-1" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-xs font-bold text-slate-800 [overflow-wrap:anywhere]">{record.name} · {record.companyName}</span>
                  <span className="mt-1 block break-all text-[10px] text-slate-500">{record.email || "—"} · {record.phone || "—"}</span>
                  <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-amber-700">{record.id === lead.id ? (locale === "vi" ? "Lead đang rà soát" : "Lead under review") : `${locale === "vi" ? "Khớp" : "Matches"}: ${matches.join(", ")}`}</span>
                </span>
              </label>
            );
          })}
        </div>
        <Textarea label={locale === "vi" ? "Lý do quyết định" : "Decision reason"} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        <div className="crm-form-action-bar flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>{locale === "vi" ? "Hủy" : "Cancel"}</Button>
          <Button type="button" variant="secondary" disabled={!reason.trim() || saving} onClick={() => run("distinct")}><ShieldCheck size={14} />{locale === "vi" ? "Xác nhận khác nhau" : "Confirm distinct"}</Button>
          <Button type="button" variant="primary" disabled={!reason.trim() || saving || records.length < 2} onClick={() => run("merge")}><Merge size={14} />{locale === "vi" ? "Gộp có kiểm soát" : "Merge safely"}</Button>
        </div>
      </div>
    </Modal>
  );
}
