import React from "react";
import { Download, ExternalLink, FileImage, Link2, LockKeyhole, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui";
import type { EvidenceItem, EvidenceType } from "./evidence.types";

export interface EvidencePanelProps {
  title?: string;
  items: readonly EvidenceItem[];
  canAdd?: boolean;
  canRemove?: boolean;
  onAdd?: (item: EvidenceItem) => void;
  onRemove?: (id: string) => void;
  locale?: "vi" | "en";
  defaultType?: EvidenceType;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  title,
  items,
  canAdd = false,
  canRemove = false,
  onAdd,
  onRemove,
  locale = "vi",
  defaultType = "OTHER",
}) => {
  const [adding, setAdding] = React.useState(false);
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const submit = () => {
    const normalized = reference.trim();
    if (!normalized || !onAdd) return;
    const now = new Date().toISOString();
    onAdd({
      id: `evidence_${crypto.randomUUID()}`,
      type: defaultType,
      externalReference: normalized,
      url: /^https?:\/\//i.test(normalized) ? normalized : undefined,
      capturedAt: now,
      capturedBy: "current-user",
      verificationState: "UNVERIFIED",
      notes: notes.trim() || undefined,
      createdAt: now,
    });
    setReference("");
    setNotes("");
    setAdding(false);
  };
  return <section className="rounded-2xl border border-slate-200 bg-white" data-shared-evidence-panel>
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h3 className="text-sm font-black text-slate-900">{title ?? text("Bằng chứng", "Evidence")}</h3><p className="mt-1 text-xs text-slate-500">{text("Metadata và trạng thái xác minh được giữ cùng nghiệp vụ nguồn.", "Metadata and verification state stay with the owning business record.")}</p></div>
      {canAdd && <Button type="button" size="sm" actionIntent="create" icon={<Plus size={13} />} onClick={() => setAdding((value) => !value)}>{text("Thêm", "Add")}</Button>}
    </div>
    {adding && <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 md:grid-cols-[1fr_1fr_auto]">
      <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={text("URL hoặc mã tham chiếu", "URL or external reference")} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" />
      <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={text("Ghi chú", "Notes")} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" />
      <Button type="button" actionIntent="save" onClick={submit} disabled={!reference.trim()}>{text("Lưu", "Save")}</Button>
    </div>}
    <div className="divide-y divide-slate-100">
      {items.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">{text("Chưa có bằng chứng.", "No evidence yet.")}</div> : items.map((item) => <article key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3"><div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">{item.url ? <Link2 size={16} /> : item.mimeType?.startsWith("image/") ? <FileImage size={16} /> : <ShieldCheck size={16} />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-slate-900">{item.fileName || item.externalReference || item.id}</span>{item.lockedByBusinessEvent && <span title={text("Đã khóa bởi bằng chứng nghiệp vụ", "Locked by a business event")}><LockKeyhole size={13} className="text-amber-600" /></span>}</div><div className="mt-1 text-[11px] text-slate-500">{item.type} · {item.verificationState} · {new Date(item.capturedAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</div>{item.notes && <div className="mt-1 text-xs text-slate-600">{item.notes}</div>}</div></div>
        <div className="flex shrink-0 gap-2">{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700"><ExternalLink size={13} />{text("Mở", "Open")}</a>}{item.url && <a href={item.url} download className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700"><Download size={13} />{text("Tải", "Download")}</a>}{canRemove && !item.lockedByBusinessEvent && <Button type="button" size="sm" actionIntent="destructive" icon={<Trash2 size={13} />} onClick={() => onRemove?.(item.id)}>{text("Xóa", "Remove")}</Button>}</div>
      </article>)}
    </div>
  </section>;
};
