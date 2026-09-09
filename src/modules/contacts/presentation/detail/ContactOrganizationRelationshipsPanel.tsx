import React from "react";
import { Building2, Crown, Link2, Pencil, Unlink } from "lucide-react";
import { Button, Input, Modal } from "@/shared/components/ui";
import { useAuthoritativeResource, formatApplicationError } from "@/shared/operations";
import { useI18n } from "@/i18n";
import { getOrganizationAccountCollectionResource } from "@/modules/organizations/application/vertical-slice/organizationAuthoritativeQueries";
import { getContactRelationshipSummaryResource } from "../../application/vertical-slice/contactAuthoritativeQueries";
import { getContactApiRuntime } from "../../application/composition/contactApplicationServices";
import type { Contact, ContactOrganizationRelationship, ContactOrganizationRelationshipRole } from "../../domain/model/contact.types";

interface Props { contact: Contact; onOpenOrganization(organizationId: string): void }
type Draft = { organizationId: string; role: ContactOrganizationRelationshipRole; isPrimaryAffiliation: boolean; effectiveFrom: string };
const emptyDraft = (): Draft => ({ organizationId: "", role: "employee", isPrimaryAffiliation: false, effectiveFrom: formatDateInput(new Date().toISOString()) });

export function ContactOrganizationRelationshipsPanel({ contact, onOpenOrganization }: Props) {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const summary = useAuthoritativeResource(React.useMemo(() => getContactRelationshipSummaryResource(contact.id), [contact.id]));
  const directory = useAuthoritativeResource(React.useMemo(() => getOrganizationAccountCollectionResource(), []));
  const relationships = summary.data?.organizationRelationships ?? [];
  const active = relationships.filter((item) => !item.effectiveTo);
  const history = relationships.filter((item) => item.effectiveTo);
  const actions = new Set(summary.data?.allowedActions ?? []);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [editing, setEditing] = React.useState<ContactOrganizationRelationship>();
  const [endTarget, setEndTarget] = React.useState<ContactOrganizationRelationship>();
  const [endReason, setEndReason] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const version = summary.data?.projectionVersion ?? contact.resourceVersion;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (version === undefined) return setError(text("Cần tải lại phiên bản Liên hệ.", "Refresh the Contact version before saving."));
    setSaving(true); setError(undefined);
    try {
      const commands = getContactApiRuntime().commands;
      if (!commands) throw new Error("CONTACT_RELATIONSHIP_COMMAND_UNAVAILABLE");
      if (editing) await commands.updateOrganizationRelationship({ contactId: contact.id, relationshipId: editing.id, expectedVersion: version, role: draft.role, isPrimaryAffiliation: draft.isPrimaryAffiliation });
      else await commands.createOrganizationRelationship({ contactId: contact.id, expectedVersion: version, organizationId: draft.organizationId, role: draft.role, isPrimaryAffiliation: draft.isPrimaryAffiliation, effectiveFrom: new Date(`${draft.effectiveFrom}T00:00:00`).toISOString() });
      await summary.refresh(); setOpen(false); setEditing(undefined); setDraft(emptyDraft());
    } catch (caught) { await summary.refresh(); setError(formatApplicationError(caught, { locale })); }
    finally { setSaving(false); }
  };

  const end = async () => {
    if (!endTarget || !endReason.trim() || version === undefined) return;
    setSaving(true); setError(undefined);
    try {
      const commands = getContactApiRuntime().commands;
      if (!commands) throw new Error("CONTACT_RELATIONSHIP_COMMAND_UNAVAILABLE");
      await commands.endOrganizationRelationship({ contactId: contact.id, relationshipId: endTarget.id, expectedVersion: version, endedReason: endReason.trim() });
      await summary.refresh(); setEndTarget(undefined); setEndReason("");
    } catch (caught) { await summary.refresh(); setError(formatApplicationError(caught, { locale })); }
    finally { setSaving(false); }
  };

  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold text-slate-900">{text("Quan hệ với tổ chức", "Organization affiliations")}</h3><p className="mt-1 text-[10px] text-slate-500">{text("Quan hệ có lịch sử, do Liên hệ sở hữu.", "Effective-dated relationships owned by Contact.")}</p></div>{actions.has("createContactOrganizationRelationship") && <Button size="sm" variant="secondary" onClick={() => { setEditing(undefined); setDraft(emptyDraft()); setError(undefined); setOpen(true); }}><Link2 size={13}/>{text("Liên kết", "Link")}</Button>}</div>
    {summary.loading && <p className="text-[10px] text-slate-500">{text("Đang tải...", "Loading...")}</p>}
    {summary.error && <div className="rounded-lg bg-rose-50 p-3 text-[10px] text-rose-700">{formatApplicationError(summary.error, { locale })}</div>}
    {directory.error && <div className="rounded-lg bg-rose-50 p-3 text-[10px] text-rose-700">{formatApplicationError(directory.error, { locale })}</div>}
    <div className="grid gap-3 sm:grid-cols-2">{active.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex gap-3"><Building2 size={16}/><button className="text-xs font-semibold" onClick={() => onOpenOrganization(item.organizationAccountId)}>{item.organizationLabel ?? item.organizationAccountId}</button>{item.isPrimaryAffiliation && <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-amber-700"><Crown size={10}/>{text("Chính", "Primary")}</span>}</div><p className="mt-2 text-[10px] text-slate-500">{roleLabel(item.role)} · {formatDate(item.effectiveFrom)}</p><div className="mt-3 flex justify-end gap-3">{actions.has("updateContactOrganizationRelationship") && <button className="text-[10px] font-semibold text-violet-700" onClick={() => { setEditing(item); setDraft({ organizationId: item.organizationAccountId, role: item.role, isPrimaryAffiliation: Boolean(item.isPrimaryAffiliation), effectiveFrom: formatDateInput(item.effectiveFrom) }); setError(undefined); setOpen(true); }}><Pencil size={11} className="inline"/> {text("Sửa", "Edit")}</button>}{actions.has("endContactOrganizationRelationship") && <button className="text-[10px] font-semibold text-rose-600" onClick={() => { setEndTarget(item); setError(undefined); }}><Unlink size={11} className="inline"/> {text("Kết thúc", "End")}</button>}</div></article>)}</div>
    {!summary.loading && active.length === 0 && <div className="rounded-xl border border-dashed p-4 text-center text-[10px] text-slate-500">{text("Chưa có quan hệ đang hiệu lực.", "No active affiliation.")}</div>}
    {history.length > 0 && <details className="rounded-xl border border-slate-200 p-4"><summary className="text-[10px] font-semibold">{text("Lịch sử", "History")} ({history.length})</summary><div className="mt-3 space-y-2">{history.map((item) => <p key={item.id} className="text-[10px] text-slate-600">{item.organizationLabel ?? item.organizationAccountId} · {roleLabel(item.role)} · {formatDate(item.effectiveFrom)}–{item.effectiveTo ? formatDate(item.effectiveTo) : ""}</p>)}</div></details>}
    <Modal variant="form" isOpen={open} onClose={() => setOpen(false)} size="md" title={editing ? text("Cập nhật quan hệ", "Update affiliation") : text("Liên kết tổ chức", "Link organization")}><form className="space-y-4" onSubmit={submit}><Field label={text("Tổ chức", "Organization")}><select required disabled={Boolean(editing)} value={draft.organizationId} onChange={(e) => setDraft((v) => ({...v, organizationId:e.target.value}))} className={INPUT}><option value="">{text("Chọn tổ chức", "Select organization")}</option>{directory.data?.items.filter((org) => editing?.organizationAccountId === org.id || !active.some((rel) => rel.organizationAccountId === org.id)).map((org) => <option key={org.id} value={org.id}>{org.displayName}</option>)}</select></Field><Field label={text("Vai trò", "Role")}><select value={draft.role} onChange={(e) => setDraft((v) => ({...v, role:e.target.value as ContactOrganizationRelationshipRole}))} className={INPUT}>{ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></Field>{!editing && <Field label={text("Hiệu lực từ", "Effective from")}><Input type="date" value={draft.effectiveFrom} onChange={(e) => setDraft((v) => ({...v,effectiveFrom:e.target.value}))}/></Field>}<label className="flex gap-2 text-xs"><input type="checkbox" checked={draft.isPrimaryAffiliation} onChange={(e) => setDraft((v) => ({...v,isPrimaryAffiliation:e.target.checked}))}/>{text("Quan hệ chính của Liên hệ", "Contact's primary affiliation")}</label>{error && <p className="text-[10px] text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>{text("Hủy", "Cancel")}</Button><Button type="submit" disabled={saving || !draft.organizationId}>{text("Lưu", "Save")}</Button></div></form></Modal>
    <Modal variant="form" isOpen={Boolean(endTarget)} onClose={() => setEndTarget(undefined)} size="sm" title={text("Kết thúc quan hệ", "End affiliation")}><div className="space-y-4"><Field label={text("Lý do", "Reason")}><textarea className={INPUT} value={endReason} onChange={(e) => setEndReason(e.target.value)}/></Field>{error && <p className="text-[10px] text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEndTarget(undefined)}>{text("Hủy", "Cancel")}</Button><Button variant="danger" disabled={saving || !endReason.trim()} onClick={end}>{text("Kết thúc", "End")}</Button></div></div></Modal>
  </section>;
}

const ROLES: ContactOrganizationRelationshipRole[] = ["employee","executive","decision_maker","buyer","finance","technical","advisor","partner","other"];
const INPUT = "min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs";
const Field = ({label,children}:{label:string;children:React.ReactNode}) => <label className="block space-y-1"><span className="text-[10px] font-semibold text-slate-500">{label}</span>{children}</label>;
const roleLabel = (role: ContactOrganizationRelationshipRole) => role.replaceAll("_", " ");
const formatDate = (value: string) => new Date(value).toLocaleDateString();
const formatDateInput = (value: string) => {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
