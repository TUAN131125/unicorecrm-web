import React from "react";
import { useContactRelationshipForm } from "./useContactRelationshipForm";
import { Building2, Crown, Link2, Pencil, Unlink } from "lucide-react";
import { Button, Input, Modal } from "@/shared/components/ui";
import { useAuthoritativeResource, formatApplicationError } from "@/shared/operations";
import { useI18n } from "@/i18n";
import { getOrganizationAccountCollectionResource } from "@/modules/organizations";
import { getContactRelationshipSummaryResource } from "../../application/vertical-slice/contactAuthoritativeQueries";
import { createContactOrganizationRelationshipViaApi, updateContactOrganizationRelationshipViaApi, endContactOrganizationRelationshipViaApi } from "../../public/contacts";
import type { Contact, ContactOrganizationRelationship, ContactOrganizationRelationshipRole } from "../../domain/model/contact.types";

interface Props { contact: Contact; onOpenOrganization(organizationId: string): void }
type Draft = { organizationId: string; role: ContactOrganizationRelationshipRole; isPrimaryAffiliation: boolean; effectiveFrom: string };
const emptyDraft = (): Draft => ({ organizationId: "", role: "employee", isPrimaryAffiliation: false, effectiveFrom: formatDateInput(new Date().toISOString()) });

export function ContactOrganizationRelationshipsPanel({ contact, onOpenOrganization }: Props) {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const directory = useAuthoritativeResource(React.useMemo(() => getOrganizationAccountCollectionResource(), []));
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [editing, setEditing] = React.useState<ContactOrganizationRelationship>();
  const [endTarget, setEndTarget] = React.useState<ContactOrganizationRelationship>();
  const [endReason, setEndReason] = React.useState("");
  const [open, setOpen] = React.useState(false);


  const lifecycle = useContactRelationshipForm(contact, JSON.stringify(endTarget ? { endReason: endReason.trim() } : draft), () => { setOpen(false); setEditing(undefined); setEndTarget(undefined); setEndReason(""); setDraft(emptyDraft()); }, locale, text("Quan hệ", "Organization relationship"), "organization");
  const summaryContactId = lifecycle.opening?.contact.id ?? contact.id;
  const summary = useAuthoritativeResource(React.useMemo(() => getContactRelationshipSummaryResource(summaryContactId), [summaryContactId]));
  const relationships = summary.data?.organizationRelationships ?? [];
  const active = relationships.filter((item) => !item.effectiveTo);
  const history = relationships.filter((item) => item.effectiveTo);
  const actions = new Set(summary.data?.allowedActions ?? []);
  const version = summary.data?.contact.id === contact.id ? summary.data.projectionVersion : contact.resourceVersion;
  const { pending: saving, error, setError } = lifecycle;
  const save = async () => {
    if (!draft.organizationId) { lifecycle.focusField("organizationId"); setError(text("Chọn tổ chức.", "Select an organization.")); return false; }
    if (!ROLES.includes(draft.role)) { lifecycle.focusField("role"); setError(text("Chọn vai trò hợp lệ.", "Select a valid role.")); return false; }
    if (!editing && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveFrom) || Number.isNaN(new Date(`${draft.effectiveFrom}T00:00:00`).getTime()))) { lifecycle.focusField("effectiveFrom"); setError(text("Kiểm tra ngày hiệu lực.", "Check the effective date.")); return false; }

    return lifecycle.run(async target => {
      if (editing) await updateContactOrganizationRelationshipViaApi({ contactId: target.contact.id, relationshipId: editing.id, expectedVersion: target.version, role: draft.role, isPrimaryAffiliation: draft.isPrimaryAffiliation }, { idempotencyKey: target.intentId });
      else await createContactOrganizationRelationshipViaApi({ contactId: target.contact.id, expectedVersion: target.version, organizationId: draft.organizationId, role: draft.role, isPrimaryAffiliation: draft.isPrimaryAffiliation, effectiveFrom: new Date(`${draft.effectiveFrom}T00:00:00`).toISOString() }, { idempotencyKey: target.intentId });
    });
  };

  const end = async () => {
    if (!endTarget || !endReason.trim() || endReason.trim().length > 1000) { lifecycle.focusField("endedReason"); setError(text("Nhập lý do.", "Enter a reason.")); return false; }
    return lifecycle.run(async target => {
      await endContactOrganizationRelationshipViaApi({ contactId: target.contact.id, relationshipId: endTarget.id, expectedVersion: target.version, endedReason: endReason.trim() }, { idempotencyKey: target.intentId });
    });
  };

  lifecycle.saveRef.current = async () => Boolean(await (endTarget ? end() : save()));
  const submit = (event: React.FormEvent) => { event.preventDefault(); void save(); };

  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold text-slate-900">{text("Quan hệ với tổ chức", "Organization affiliations")}</h3><p className="mt-1 text-[10px] text-slate-500">{text("Quan hệ có lịch sử, do Liên hệ sở hữu.", "Effective-dated relationships owned by Contact.")}</p></div>{actions.has("createContactOrganizationRelationship") && <Button size="sm" variant="secondary" onClick={() => { const initial = emptyDraft(); if (!lifecycle.begin(version, JSON.stringify(initial))) return; setEditing(undefined); setDraft(initial); setError(undefined); setOpen(true); }}><Link2 size={13}/>{text("Liên kết", "Link")}</Button>}</div>
    {summary.loading && <p className="text-[10px] text-slate-500">{text("Đang tải...", "Loading...")}</p>}
    {summary.error && <div className="rounded-lg bg-rose-50 p-3 text-[10px] text-rose-700">{formatApplicationError(summary.error, { locale })}</div>}
    {directory.error && <div className="rounded-lg bg-rose-50 p-3 text-[10px] text-rose-700">{formatApplicationError(directory.error, { locale })}</div>}
    <div className="grid gap-3 sm:grid-cols-2">{active.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex gap-3"><Building2 size={16}/><button className="text-xs font-semibold" onClick={() => onOpenOrganization(item.organizationAccountId)}>{item.organizationLabel ?? item.organizationAccountId}</button>{item.isPrimaryAffiliation && <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-amber-700"><Crown size={10}/>{text("Chính", "Primary")}</span>}</div><p className="mt-2 text-[10px] text-slate-500">{roleLabel(item.role)} · {formatDate(item.effectiveFrom)}</p><div className="mt-3 flex justify-end gap-3">{actions.has("updateContactOrganizationRelationship") && <button className="text-[10px] font-semibold text-violet-700" onClick={() => { if (!lifecycle.begin(version, JSON.stringify({ organizationId: item.organizationAccountId, role: item.role, isPrimaryAffiliation: Boolean(item.isPrimaryAffiliation), effectiveFrom: formatDateInput(item.effectiveFrom) }))) return; setEditing(structuredClone(item)); setDraft({ organizationId: item.organizationAccountId, role: item.role, isPrimaryAffiliation: Boolean(item.isPrimaryAffiliation), effectiveFrom: formatDateInput(item.effectiveFrom) }); setError(undefined); setOpen(true); }}><Pencil size={11} className="inline"/> {text("Sửa", "Edit")}</button>}{actions.has("endContactOrganizationRelationship") && <button className="text-[10px] font-semibold text-rose-600" onClick={() => { if (!lifecycle.begin(version, JSON.stringify({ endReason: "" }))) return; setEndTarget(structuredClone(item)); setEndReason(""); }}><Unlink size={11} className="inline"/> {text("Kết thúc", "End")}</button>}</div></article>)}</div>
    {!summary.loading && active.length === 0 && <div className="rounded-xl border border-dashed p-4 text-center text-[10px] text-slate-500">{text("Chưa có quan hệ đang hiệu lực.", "No active affiliation.")}</div>}
    {history.length > 0 && <details className="rounded-xl border border-slate-200 p-4"><summary className="text-[10px] font-semibold">{text("Lịch sử", "History")} ({history.length})</summary><div className="mt-3 space-y-2">{history.map((item) => <p key={item.id} className="text-[10px] text-slate-600">{item.organizationLabel ?? item.organizationAccountId} · {roleLabel(item.role)} · {formatDate(item.effectiveFrom)}–{item.effectiveTo ? formatDate(item.effectiveTo) : ""}</p>)}</div></details>}
    <Modal variant="form" isOpen={open} onClose={lifecycle.requestClose} size="sm" title={editing ? text("Cập nhật quan hệ", "Update affiliation") : text("Liên kết tổ chức", "Link organization")}><form ref={lifecycle.setErrorScope} noValidate data-contact-target-id={lifecycle.opening?.contact.id} className="space-y-4" onSubmit={submit}><Field label={text("Tổ chức", "Organization")}><select id="organization-relationship-subject" required disabled={Boolean(editing) || saving} value={draft.organizationId} onChange={(e) => setDraft((v) => ({...v, organizationId:e.target.value}))} className={INPUT}><option value="">{text("Chọn tổ chức", "Select organization")}</option>{directory.data?.items.filter((org) => editing?.organizationAccountId === org.id || !active.some((rel) => rel.organizationAccountId === org.id)).map((org) => <option key={org.id} value={org.id}>{org.displayName}</option>)}</select></Field><Field label={text("Vai trò", "Role")}><select id="organization-relationship-role" disabled={saving} value={draft.role} onChange={(e) => setDraft((v) => ({...v, role:e.target.value as ContactOrganizationRelationshipRole}))} className={INPUT}>{ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></Field>{!editing && <Field label={text("Hiệu lực từ", "Effective from")}><Input id="organization-relationship-effective-from" disabled={saving} type="date" value={draft.effectiveFrom} onChange={(e) => setDraft((v) => ({...v,effectiveFrom:e.target.value}))}/></Field>}<label className="flex gap-2 text-xs"><input id="organization-relationship-primary" disabled={saving} type="checkbox" checked={draft.isPrimaryAffiliation} onChange={(e) => setDraft((v) => ({...v,isPrimaryAffiliation:e.target.checked}))}/>{text("Quan hệ chính của Liên hệ", "Contact's primary affiliation")}</label>{error && <p className="text-[10px] text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={lifecycle.requestClose}>{text("Hủy", "Cancel")}</Button><Button type="submit" disabled={saving || !draft.organizationId}>{text("Lưu", "Save")}</Button></div></form></Modal>
    <Modal variant="form" isOpen={Boolean(endTarget)} onClose={lifecycle.requestClose} size="sm" title={text("Kết thúc quan hệ", "End affiliation")}><div ref={lifecycle.setErrorScope} className="space-y-4"><Field label={text("Lý do", "Reason")}><textarea id="organization-relationship-reason" disabled={saving} className={INPUT} value={endReason} onChange={(e) => setEndReason(e.target.value)}/></Field>{error && <p className="text-[10px] text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={lifecycle.requestClose}>{text("Hủy", "Cancel")}</Button><Button type="button" variant="danger" disabled={saving || !endReason.trim()} onClick={end}>{text("Kết thúc", "End")}</Button></div></div></Modal>
    {lifecycle.confirmDialog}
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
