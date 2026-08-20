import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Modal, Select, Textarea } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Lead, LeadConsentChannel, LeadConsentDecision } from "../../domain/model/lead.types";

interface LeadConsentPanelProps {
  lead: Lead;
  actorId: string;
  actorName?: string;
  onRecord: (input: {
    channel: LeadConsentChannel;
    decision: Exclude<LeadConsentDecision, "UNKNOWN">;
    source: string;
    actorId: string;
    actorName?: string;
    evidence?: string;
  }) => Promise<Lead>;
}

const CHANNELS: LeadConsentChannel[] = ["CALL", "EMAIL", "SMS", "ZALO"];
const DECISIONS: Array<Exclude<LeadConsentDecision, "UNKNOWN">> = ["GRANTED", "DENIED", "WITHDRAWN"];

export function LeadConsentPanel({ lead, actorId, actorName, onRecord }: LeadConsentPanelProps) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<LeadConsentChannel>("EMAIL");
  const [decision, setDecision] = useState<Exclude<LeadConsentDecision, "UNKNOWN">>("GRANTED");
  const [source, setSource] = useState("VERBAL_CONFIRMATION");
  const [evidence, setEvidence] = useState("");
  const [saving, setSaving] = useState(false);
  const latest = useMemo(() => lead.consent?.ledger?.[0], [lead.consent?.ledger]);

  const submit = async () => {
    if (!source.trim() || saving) return;
    setSaving(true);
    try {
      await onRecord({ channel, decision, source: source.trim(), evidence: evidence.trim() || undefined, actorId, actorName });
      setOpen(false);
      setEvidence("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
      >
        <ShieldCheck size={13} className="shrink-0" />
        <span className="break-words [overflow-wrap:anywhere]">
          {latest
            ? `${latest.channel}: ${latest.decision}`
            : locale === "vi" ? "Ghi nhận đồng thuận" : "Record consent"}
        </span>
      </button>

      <Modal variant="form" isOpen={open} onClose={() => setOpen(false)} title={locale === "vi" ? "Khai báo đồng thuận liên hệ" : "Record communication consent"} size="sm">
        <div className="space-y-4 text-left">
          <p className="text-[11px] leading-5 text-slate-500">
            {locale === "vi"
              ? "Mỗi thay đổi được ghi thêm vào sổ đồng thuận; lịch sử cũ không bị ghi đè."
              : "Each change is appended to the consent ledger; previous evidence is preserved."}
          </p>
          <Select label={locale === "vi" ? "Kênh" : "Channel"} value={channel} onChange={(event) => setChannel(event.target.value as LeadConsentChannel)}>
            {CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select label={locale === "vi" ? "Quyết định" : "Decision"} value={decision} onChange={(event) => setDecision(event.target.value as Exclude<LeadConsentDecision, "UNKNOWN">)}>
            {DECISIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select label={locale === "vi" ? "Nguồn bằng chứng" : "Evidence source"} value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="VERBAL_CONFIRMATION">{locale === "vi" ? "Xác nhận bằng lời" : "Verbal confirmation"}</option>
            <option value="WEB_FORM">{locale === "vi" ? "Biểu mẫu web" : "Web form"}</option>
            <option value="SIGNED_DOCUMENT">{locale === "vi" ? "Tài liệu đã ký" : "Signed document"}</option>
            <option value="IMPORT">{locale === "vi" ? "Dữ liệu nhập khẩu" : "Imported evidence"}</option>
          </Select>
          <Textarea label={locale === "vi" ? "Ghi chú bằng chứng" : "Evidence note"} value={evidence} onChange={(event) => setEvidence(event.target.value)} rows={3} />
          <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-200 pt-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{locale === "vi" ? "Hủy" : "Cancel"}</Button>
            <Button type="button" variant="primary" disabled={!source.trim() || saving} onClick={submit}>{saving ? (locale === "vi" ? "Đang lưu..." : "Saving...") : (locale === "vi" ? "Ghi nhận" : "Record")}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
