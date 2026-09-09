import React from "react";
import { Link2, Pencil, Unlink, UsersRound } from "lucide-react";
import { Button, Modal } from "@/shared/components/ui";
import { formatApplicationError, useAuthoritativeResource } from "@/shared/operations";
import { useI18n } from "@/i18n";
import { getCustomerCollectionResource } from "@/modules/customers/application/vertical-slice/customerAuthoritativeQueries";
import { getContactApiRuntime } from "../../application/composition/contactApplicationServices";
import { getContactRelationshipSummaryResource } from "../../application/vertical-slice/contactAuthoritativeQueries";
import type { Contact, ContactCustomerRelationship, ContactCustomerRelationshipRole } from "../../domain/model/contact.types";

interface Props { contact: Contact; onOpenCustomer?(customerId: string): void }
const ROLES: ContactCustomerRelationshipRole[] = ["primary_contact", "billing", "decision_maker", "end_user", "technical", "support", "other"];
const INPUT = "min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs";

export function ContactCustomerRelationshipsPanel({ contact, onOpenCustomer }: Props) {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const summary = useAuthoritativeResource(React.useMemo(() => getContactRelationshipSummaryResource(contact.id), [contact.id]));
  const directory = useAuthoritativeResource(React.useMemo(() => getCustomerCollectionResource(), []));
  const relationships = summary.data?.customerRelationships ?? [];
  const active = relationships.filter((item) => !item.effectiveTo);
  const history = relationships.filter((item) => item.effectiveTo);
  const actions = new Set(summary.data?.allowedActions ?? []);
  const version = summary.data?.projectionVersion ?? contact.resourceVersion;
  const [editing, setEditing] = React.useState<ContactCustomerRelationship>();
  const [endTarget, setEndTarget] = React.useState<ContactCustomerRelationship>();
  const [customerId, setCustomerId] = React.useState("");
  const [role, setRole] = React.useState<ContactCustomerRelationshipRole>("other");
  const [endReason, setEndReason] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (version === undefined) return setError(text("Cần tải lại phiên bản Liên hệ.", "Refresh the Contact version before saving."));
    setSaving(true); setError(undefined);
    try {
      const commands = getContactApiRuntime().commands;
      if (!commands) throw new Error("CONTACT_RELATIONSHIP_COMMAND_UNAVAILABLE");
      if (editing) await commands.updateCustomerRelationship({ contactId: contact.id, relationshipId: editing.id, expectedVersion: version, role });
      else await commands.createCustomerRelationship({ contactId: contact.id, expectedVersion: version, customerId, role });
      await summary.refresh(); setOpen(false); setEditing(undefined); setCustomerId("");
    } catch (caught) { await summary.refresh(); setError(formatApplicationError(caught, { locale })); }
    finally { setSaving(false); }
  };

  const end = async () => {
    if (!endTarget || !endReason.trim() || version === undefined) return;
    setSaving(true); setError(undefined);
    try {
      const commands = getContactApiRuntime().commands;
      if (!commands) throw new Error("CONTACT_RELATIONSHIP_COMMAND_UNAVAILABLE");
      await commands.endCustomerRelationship({ contactId: contact.id, relationshipId: endTarget.id, expectedVersion: version, endedReason: endReason.trim() });
      await summary.refresh(); setEndTarget(undefined); setEndReason("");
    } catch (caught) { await summary.refresh(); setError(formatApplicationError(caught, { locale })); }
    finally { setSaving(false); }
  };

  const beginCreate = () => { setEditing(undefined); setCustomerId(""); setRole("other"); setError(undefined); setOpen(true); };
  const beginEdit = (item: ContactCustomerRelationship) => { setEditing(item); setCustomerId(item.customerId); setRole(item.role); setError(undefined); setOpen(true); };

  return <section className="space-y-4">
    <div className="flex items-center justify-between"><div><h3 className="text-xs font-semibold">{text("Vai trò trong Customer", "Customer stakeholders")}</h3><p className="mt-1 text-[10px] text-slate-500">{text("Tách biệt với chủ thể tài khoản B2C/B2B.", "Separate from the B2C/B2B account subject.")}</p></div>{actions.has("createContactCustomerRelationship") && <Button size="sm" variant="secondary" onClick={beginCreate}><Link2 size={13} />{text("Liên kết", "Link")}</Button>}</div>
    {summary.loading && <p className="text-[10px] text-slate-500">{text("Đang tải...", "Loading...")}</p>}
    {summary.error && <ErrorNotice value={formatApplicationError(summary.error, { locale })} />}
    {directory.error && <ErrorNotice value={formatApplicationError(directory.error, { locale })} />}
    <div className="grid gap-3 sm:grid-cols-2">{active.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex gap-3"><UsersRound size={16} />{onOpenCustomer ? <button className="text-xs font-semibold" onClick={() => onOpenCustomer(item.customerId)}>{item.customerLabel ?? item.customerId}</button> : <span className="text-xs font-semibold">{item.customerLabel ?? item.customerId}</span>}{item.role === "primary_contact" && <span className="ml-auto text-[9px] text-amber-700">{text("Liên hệ chính", "Primary")}</span>}</div><p className="mt-2 text-[10px] text-slate-500">{roleLabel(item.role)} · {formatDate(item.effectiveFrom)}</p><div className="mt-3 flex justify-end gap-3">{actions.has("updateContactCustomerRelationship") && <button className="text-[10px] font-semibold text-violet-700" onClick={() => beginEdit(item)}><Pencil size={11} className="inline" /> {text("Sửa", "Edit")}</button>}{actions.has("endContactCustomerRelationship") && <button className="text-[10px] font-semibold text-rose-600" onClick={() => { setEndTarget(item); setError(undefined); }}><Unlink size={11} className="inline" /> {text("Kết thúc", "End")}</button>}</div></article>)}</div>
    {!summary.loading && active.length === 0 && <div className="rounded-xl border border-dashed p-4 text-center text-[10px] text-slate-500">{text("Chưa có vai trò Customer đang hiệu lực.", "No active Customer stakeholder relationship.")}</div>}
    {history.length > 0 && <details className="rounded-xl border border-slate-200 p-4"><summary className="text-[10px] font-semibold">{text("Lịch sử", "History")} ({history.length})</summary>{history.map((item) => <p key={item.id} className="mt-2 text-[10px] text-slate-600">{item.customerLabel ?? item.customerId} · {roleLabel(item.role)} · {formatDate(item.effectiveFrom)}–{item.effectiveTo ? formatDate(item.effectiveTo) : ""}</p>)}</details>}
    <Modal variant="form" isOpen={open} onClose={() => setOpen(false)} size="md" title={editing ? text("Cập nhật vai trò", "Update stakeholder") : text("Liên kết Customer", "Link Customer")}><form className="space-y-4" onSubmit={submit}><Field label="Customer"><select required disabled={Boolean(editing)} className={INPUT} value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">{text("Chọn Customer", "Select Customer")}</option>{directory.data?.items.filter((customer) => editing?.customerId === customer.id || !active.some((item) => item.customerId === customer.id)).map((customer) => <option key={customer.id} value={customer.id}>{customer.customerCode}</option>)}</select></Field><Field label={text("Vai trò", "Role")}><select className={INPUT} value={role} onChange={(event) => setRole(event.target.value as ContactCustomerRelationshipRole)}>{ROLES.map((value) => <option key={value} value={value}>{roleLabel(value)}</option>)}</select></Field>{error && <ErrorNotice value={error} />}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>{text("Hủy", "Cancel")}</Button><Button type="submit" disabled={saving || !customerId}>{text("Lưu", "Save")}</Button></div></form></Modal>
    <Modal variant="form" isOpen={Boolean(endTarget)} onClose={() => setEndTarget(undefined)} size="sm" title={text("Kết thúc vai trò", "End stakeholder relationship")}><div className="space-y-4"><Field label={text("Lý do", "Reason")}><textarea className={INPUT} value={endReason} onChange={(event) => setEndReason(event.target.value)} /></Field>{error && <ErrorNotice value={error} />}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEndTarget(undefined)}>{text("Hủy", "Cancel")}</Button><Button variant="danger" disabled={saving || !endReason.trim()} onClick={end}>{text("Kết thúc", "End")}</Button></div></div></Modal>
  </section>;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block space-y-1"><span className="text-[10px] font-semibold text-slate-500">{label}</span>{children}</label>;
const ErrorNotice = ({ value }: { value: string }) => <div className="rounded-lg bg-rose-50 p-3 text-[10px] text-rose-700">{value}</div>;
const roleLabel = (role: ContactCustomerRelationshipRole) => role.replaceAll("_", " ");
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
