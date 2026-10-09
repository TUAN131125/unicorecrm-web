import React from "react";
import { useContactRelationshipForm } from "./useContactRelationshipForm";
import { Link2, Pencil, Unlink, UsersRound } from "lucide-react";
import { Button, Modal } from "@/shared/components/ui";
import { formatApplicationError, useAuthoritativeResource, useModuleAuthoritativeResource } from "@/shared/operations";
import { useI18n } from "@/i18n";
import { getCustomerCollectionResource } from "@/modules/customers";
import { createContactCustomerRelationshipViaApi, updateContactCustomerRelationshipViaApi, endContactCustomerRelationshipViaApi } from "../../public/contacts";
import { getContactRelationshipSummaryResource } from "../../application/vertical-slice/contactAuthoritativeQueries";
import { useContactReadAuthorityScope } from "../hooks/useContactReadAuthorityScope";
import type { Contact, ContactCustomerRelationship, ContactCustomerRelationshipRole } from "../../domain/model/contact.types";

interface Props { contact: Contact; onOpenCustomer?(customerId: string): void }
const ROLES: ContactCustomerRelationshipRole[] = ["primary_contact", "billing", "decision_maker", "end_user", "technical", "support", "other"];
const INPUT = "min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs";

export function ContactCustomerRelationshipsPanel({ contact, onOpenCustomer }: Props) {
  const authorityScope = useContactReadAuthorityScope();
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const directoryResource = React.useMemo(() => getCustomerCollectionResource(), []);
  const scopedDirectory = useModuleAuthoritativeResource(directoryResource, { scopeKey: authorityScope, onScopeChange: directoryResource.reset });
  const fixtureDirectory = useAuthoritativeResource(directoryResource, { enabled: !scopedDirectory.connected });
  const directory = scopedDirectory.connected ? scopedDirectory : fixtureDirectory;
  const [editing, setEditing] = React.useState<ContactCustomerRelationship>();
  const [endTarget, setEndTarget] = React.useState<ContactCustomerRelationship>();
  const [customerId, setCustomerId] = React.useState("");
  const [role, setRole] = React.useState<ContactCustomerRelationshipRole>("other");
  const [endReason, setEndReason] = React.useState("");
  const [open, setOpen] = React.useState(false);


  const lifecycle = useContactRelationshipForm(contact, JSON.stringify(endTarget ? { endReason: endReason.trim() } : { customerId, role }), () => { setOpen(false); setEditing(undefined); setEndTarget(undefined); setEndReason(""); setCustomerId(""); setRole("other"); }, locale, text("Quan hệ", "Customer relationship"), "customer");
  const summaryContactId = lifecycle.opening?.contact.id ?? contact.id;
  const summary = useAuthoritativeResource(React.useMemo(() => getContactRelationshipSummaryResource(summaryContactId), [summaryContactId, authorityScope]));
  const relationships = summary.data?.customerRelationships ?? [];
  const active = relationships.filter((item) => !item.effectiveTo);
  const history = relationships.filter((item) => item.effectiveTo);
  const actions = new Set(summary.data?.allowedActions ?? []);
  const version = summary.data?.contact.id === contact.id ? summary.data.projectionVersion : contact.resourceVersion;
  const { pending: saving, error, setError } = lifecycle;
  const save = async () => {
    if (!customerId) { lifecycle.focusField("customerId"); setError(text("Kiểm tra thông tin bắt buộc.", "Check required fields.")); return false; }
    if (!ROLES.includes(role)) { lifecycle.focusField("role"); setError(text("Chọn vai trò hợp lệ.", "Select a valid role.")); return false; }

    return lifecycle.run(async target => {
      if (editing) await updateContactCustomerRelationshipViaApi({ contactId: target.contact.id, relationshipId: editing.id, expectedVersion: target.version, role }, { idempotencyKey: target.intentId });
      else await createContactCustomerRelationshipViaApi({ contactId: target.contact.id, expectedVersion: target.version, customerId, role }, { idempotencyKey: target.intentId });
    });
  };

  const end = async () => {
    if (!endTarget || !endReason.trim() || endReason.trim().length > 1000) { lifecycle.focusField("endedReason"); setError(text("Nhập lý do.", "Enter a reason.")); return false; }
    return lifecycle.run(async target => {
      await endContactCustomerRelationshipViaApi({ contactId: target.contact.id, relationshipId: endTarget.id, expectedVersion: target.version, endedReason: endReason.trim() }, { idempotencyKey: target.intentId });
    });
  };

  const beginCreate = () => { if (!lifecycle.begin(version, JSON.stringify({ customerId: "", role: "other" }))) return; setEditing(undefined); setCustomerId(""); setRole("other"); setError(undefined); setOpen(true); };
  const beginEdit = (item: ContactCustomerRelationship) => { if (!lifecycle.begin(version, JSON.stringify({ customerId: item.customerId, role: item.role }))) return; setEditing(structuredClone(item)); setCustomerId(item.customerId); setRole(item.role); setError(undefined); setOpen(true); };

  lifecycle.saveRef.current = async () => Boolean(await (endTarget ? end() : save()));
  const submit = (event: React.FormEvent) => { event.preventDefault(); void save(); };

  return <section className="space-y-4">
    <div className="flex items-center justify-between"><div><h3 className="text-xs font-semibold">{text("Vai trò trong Customer", "Customer stakeholders")}</h3><p className="mt-1 text-[10px] text-slate-500">{text("Tách biệt với chủ thể tài khoản B2C/B2B.", "Separate from the B2C/B2B account subject.")}</p></div>{actions.has("createContactCustomerRelationship") && <Button size="sm" variant="secondary" onClick={beginCreate}><Link2 size={13} />{text("Liên kết", "Link")}</Button>}</div>
    {summary.loading && <p className="text-[10px] text-slate-500">{text("Đang tải...", "Loading...")}</p>}
    {summary.error && <ErrorNotice value={formatApplicationError(summary.error, { locale })} />}
    {directory.error && <ErrorNotice value={formatApplicationError(directory.error, { locale })} />}
    <div className="grid gap-3 sm:grid-cols-2">{active.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex gap-3"><UsersRound size={16} />{onOpenCustomer ? <button className="text-xs font-semibold" onClick={() => onOpenCustomer(item.customerId)}>{item.customerLabel ?? item.customerId}</button> : <span className="text-xs font-semibold">{item.customerLabel ?? item.customerId}</span>}{item.role === "primary_contact" && <span className="ml-auto text-[9px] text-amber-700">{text("Liên hệ chính", "Primary")}</span>}</div><p className="mt-2 text-[10px] text-slate-500">{roleLabel(item.role)} · {formatDate(item.effectiveFrom)}</p><div className="mt-3 flex justify-end gap-3">{actions.has("updateContactCustomerRelationship") && <button className="text-[10px] font-semibold text-violet-700" onClick={() => beginEdit(item)}><Pencil size={11} className="inline" /> {text("Sửa", "Edit")}</button>}{actions.has("endContactCustomerRelationship") && <button className="text-[10px] font-semibold text-rose-600" onClick={() => { if (!lifecycle.begin(version, JSON.stringify({ endReason: "" }))) return; setEndTarget(structuredClone(item)); setEndReason(""); }}><Unlink size={11} className="inline" /> {text("Kết thúc", "End")}</button>}</div></article>)}</div>
    {!summary.loading && active.length === 0 && <div className="rounded-xl border border-dashed p-4 text-center text-[10px] text-slate-500">{text("Chưa có vai trò Customer đang hiệu lực.", "No active Customer stakeholder relationship.")}</div>}
    {history.length > 0 && <details className="rounded-xl border border-slate-200 p-4"><summary className="text-[10px] font-semibold">{text("Lịch sử", "History")} ({history.length})</summary>{history.map((item) => <p key={item.id} className="mt-2 text-[10px] text-slate-600">{item.customerLabel ?? item.customerId} · {roleLabel(item.role)} · {formatDate(item.effectiveFrom)}–{item.effectiveTo ? formatDate(item.effectiveTo) : ""}</p>)}</details>}
    <Modal variant="form" isOpen={open} onClose={lifecycle.requestClose} size="sm" title={editing ? text("Cập nhật vai trò", "Update stakeholder") : text("Liên kết Customer", "Link Customer")}><form ref={lifecycle.setErrorScope} noValidate data-contact-target-id={lifecycle.opening?.contact.id} className="space-y-4" onSubmit={submit}><Field label="Customer"><select id="customer-relationship-subject" required disabled={Boolean(editing) || saving} className={INPUT} value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">{text("Chọn Customer", "Select Customer")}</option>{directory.data?.items.filter((customer) => editing?.customerId === customer.id || !active.some((item) => item.customerId === customer.id)).map((customer) => <option key={customer.id} value={customer.id}>{customer.customerCode}</option>)}</select></Field><Field label={text("Vai trò", "Role")}><select id="customer-relationship-role" disabled={saving} className={INPUT} value={role} onChange={(event) => setRole(event.target.value as ContactCustomerRelationshipRole)}>{ROLES.map((value) => <option key={value} value={value}>{roleLabel(value)}</option>)}</select></Field>{error && <ErrorNotice value={error} />}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={lifecycle.requestClose}>{text("Hủy", "Cancel")}</Button><Button type="submit" disabled={saving || !customerId}>{text("Lưu", "Save")}</Button></div></form></Modal>
    <Modal variant="form" isOpen={Boolean(endTarget)} onClose={lifecycle.requestClose} size="sm" title={text("Kết thúc vai trò", "End stakeholder relationship")}><div ref={lifecycle.setErrorScope} className="space-y-4"><Field label={text("Lý do", "Reason")}><textarea id="customer-relationship-reason" disabled={saving} className={INPUT} value={endReason} onChange={(event) => setEndReason(event.target.value)} /></Field>{error && <ErrorNotice value={error} />}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={lifecycle.requestClose}>{text("Hủy", "Cancel")}</Button><Button type="button" variant="danger" disabled={saving || !endReason.trim()} onClick={end}>{text("Kết thúc", "End")}</Button></div></div></Modal>
    {lifecycle.confirmDialog}
  </section>;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block space-y-1"><span className="text-[10px] font-semibold text-slate-500">{label}</span>{children}</label>;
const ErrorNotice = ({ value }: { value: string }) => <div className="rounded-lg bg-rose-50 p-3 text-[10px] text-rose-700">{value}</div>;
const roleLabel = (role: ContactCustomerRelationshipRole) => role.replaceAll("_", " ");
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
