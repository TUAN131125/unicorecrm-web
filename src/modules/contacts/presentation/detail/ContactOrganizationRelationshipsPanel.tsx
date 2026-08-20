import React from "react";
import { Building2, CalendarDays, Crown, History, Link2, Pencil, Unlink } from "lucide-react";
import { Button, Input, Modal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Contact, ContactOrganizationRelationship, ContactOrganizationRelationshipRole } from "../../domain/model/contact.types";
import { getContactOrganizationRelationships, isContactOrganizationRelationshipActive } from "../../domain/model/contactOrganizationRelationships";
import {
  getOrganizationAccountsSnapshot,
  subscribeToOrganizationAccounts,
} from "@/modules/organizations";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { useSubscribableSnapshot } from "@/platform/react";
import { formatApplicationError } from "@/shared/operations";
import {
  endContactOrganizationRelationshipCommand,
  upsertContactOrganizationRelationshipCommand,
} from "@/workflows/contact-organization-relationship";

interface Props {
  contact: Contact;
  onOpenOrganization(organizationId: string): void;
}

type EditDraft = {
  organizationAccountId: string;
  role: ContactOrganizationRelationshipRole;
  roleTitle: string;
  department: string;
  decisionRole: NonNullable<Contact["decisionRole"]>;
  effectiveFrom: string;
  isPrimaryRepresentative: boolean;
};

const EMPTY_DRAFT: EditDraft = {
  organizationAccountId: "",
  role: "employee",
  roleTitle: "",
  department: "",
  decisionRole: "influencer",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  isPrimaryRepresentative: false,
};

export function ContactOrganizationRelationshipsPanel({ contact, onOpenOrganization }: Props) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const text = (vn: string, en: string) => vi ? vn : en;
  const organizations = useSubscribableSnapshot(getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts);
  const relationships = getContactOrganizationRelationships(contact);
  const active = relationships.filter((item) => isContactOrganizationRelationshipActive(item));
  const historical = relationships.filter((item) => !isContactOrganizationRelationshipActive(item));
  const actorId = getAuthSessionSnapshot()?.principal.memberId ?? "current-user";
  const [draft, setDraft] = React.useState<EditDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = React.useState<ContactOrganizationRelationship | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [endTarget, setEndTarget] = React.useState<ContactOrganizationRelationship | null>(null);
  const [endReason, setEndReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT, effectiveFrom: new Date().toISOString().slice(0, 10) });
    setEditOpen(true);
    setError(null);
  };

  const openEdit = (relationship: ContactOrganizationRelationship) => {
    setEditing(relationship);
    setDraft({
      organizationAccountId: relationship.organizationAccountId,
      role: relationship.role,
      roleTitle: relationship.roleTitle ?? "",
      department: relationship.department ?? "",
      decisionRole: relationship.decisionRole ?? "influencer",
      effectiveFrom: relationship.effectiveFrom.slice(0, 10),
      isPrimaryRepresentative: relationship.isPrimaryRepresentative,
    });
    setEditOpen(true);
    setError(null);
  };

  const closeEdit = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setEditOpen(false);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.organizationAccountId) return setError(text("Chọn tổ chức cần liên kết.", "Select an organization."));
    setSaving(true);
    setError(null);
    try {
      await upsertContactOrganizationRelationshipCommand({
        contactId: contact.id,
        relationship: {
          organizationAccountId: draft.organizationAccountId,
          role: draft.role,
          roleTitle: draft.roleTitle,
          department: draft.department,
          decisionRole: draft.decisionRole,
          effectiveFrom: new Date(`${draft.effectiveFrom}T00:00:00`).toISOString(),
          isPrimaryRepresentative: draft.isPrimaryRepresentative,
        },
        actorId,
      });
      closeEdit();
    } catch (caught) {
      setError(formatApplicationError(caught, { locale }));
    } finally {
      setSaving(false);
    }
  };

  const endRelationship = async () => {
    if (!endTarget || !endReason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await endContactOrganizationRelationshipCommand({
        contactId: contact.id,
        organizationAccountId: endTarget.organizationAccountId,
        actorId,
        reason: endReason,
      });
      setEndTarget(null);
      setEndReason("");
    } catch (caught) {
      setError(formatApplicationError(caught, { locale }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-900">{text("Quan hệ với tổ chức", "Organization relationships")}</h3>
          <p className="mt-1 text-[10px] text-slate-500">{text("Một Contact có thể giữ nhiều vai trò tại nhiều tổ chức theo từng thời kỳ.", "A contact can hold multiple roles across organizations over time.")}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={openCreate}><Link2 size={13} />{text("Liên kết tổ chức", "Link organization")}</Button>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-[10px] text-slate-500">{text("Chưa có quan hệ tổ chức đang hiệu lực.", "No active organization relationship.")}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map((relationship) => (
            <RelationshipCard key={relationship.id} relationship={relationship} organizationName={organizations.find((item) => item.id === relationship.organizationAccountId)?.displayName} onOpen={() => onOpenOrganization(relationship.organizationAccountId)} onEdit={() => openEdit(relationship)} onEnd={() => { setEndTarget(relationship); setError(null); }} vi={vi} />
          ))}
        </div>
      )}

      {historical.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-[10px] font-semibold text-slate-600">{text(`Lịch sử quan hệ (${historical.length})`, `Relationship history (${historical.length})`)}</summary>
          <div className="mt-3 space-y-2">
            {historical.map((relationship) => (
              <div key={relationship.id} className="flex min-w-0 items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-600"><History size={12} className="shrink-0" /><span className="crm-text-wrap flex-1">{organizations.find((item) => item.id === relationship.organizationAccountId)?.displayName ?? relationship.organizationAccountId} · {relationship.roleTitle || roleLabel(relationship.role, vi)}</span><span>{dateLabel(relationship.effectiveFrom)}–{relationship.effectiveTo ? dateLabel(relationship.effectiveTo) : ""}</span></div>
            ))}
          </div>
        </details>
      )}

      <Modal variant="form" isOpen={editOpen} onClose={closeEdit} size="md" title={editing ? text("Cập nhật quan hệ tổ chức", "Update organization relationship") : text("Liên kết tổ chức", "Link organization")}>
        <form onSubmit={submit} className="crm-form-surface space-y-4 text-left">
          <Field label={text("Tổ chức", "Organization")}><select required disabled={Boolean(editing)} value={draft.organizationAccountId} onChange={(event) => setDraft((current) => ({ ...current, organizationAccountId: event.target.value }))} className={INPUT}><option value="">{text("Chọn tổ chức", "Select organization")}</option>{organizations.filter((item) => !active.some((relationship) => relationship.organizationAccountId === item.id) || item.id === editing?.organizationAccountId).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={text("Loại vai trò", "Relationship role")}><select value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as ContactOrganizationRelationshipRole }))} className={INPUT}>{ROLE_OPTIONS.map((role) => <option key={role} value={role}>{roleLabel(role, vi)}</option>)}</select></Field>
            <Field label={text("Chức danh", "Job title")}><input value={draft.roleTitle} onChange={(event) => setDraft((current) => ({ ...current, roleTitle: event.target.value }))} className={INPUT} /></Field>
            <Field label={text("Phòng ban", "Department")}><input value={draft.department} onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))} className={INPUT} /></Field>
            <Field label={text("Vai trò quyết định", "Decision role")}><select value={draft.decisionRole} onChange={(event) => setDraft((current) => ({ ...current, decisionRole: event.target.value as EditDraft["decisionRole"] }))} className={INPUT}>{DECISION_OPTIONS.map((role) => <option key={role} value={role}>{decisionLabel(role, vi)}</option>)}</select></Field>
            <Field label={text("Hiệu lực từ", "Effective from")}><Input type="date" value={draft.effectiveFrom} onChange={(event) => setDraft((current) => ({ ...current, effectiveFrom: event.target.value }))} className={INPUT} /></Field>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><input type="checkbox" checked={draft.isPrimaryRepresentative} onChange={(event) => setDraft((current) => ({ ...current, isPrimaryRepresentative: event.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-amber-300" /><span className="text-[10px] text-amber-800"><strong className="flex items-center gap-1"><Crown size={12} />{text("Đại diện chính của tổ chức", "Primary organization representative")}</strong><span className="mt-1 block">{text("Mỗi tổ chức chỉ có một đại diện chính đang hiệu lực.", "Each organization has only one active primary representative.")}</span></span></label>
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">{error}</div>}
          <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={closeEdit}>{text("Hủy", "Cancel")}</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? text("Đang lưu...", "Saving...") : text("Lưu quan hệ", "Save relationship")}</Button></div>
        </form>
      </Modal>

      <Modal variant="form" isOpen={Boolean(endTarget)} onClose={() => { setEndTarget(null); setEndReason(""); setError(null); }} size="sm" title={text("Kết thúc quan hệ", "End relationship")}>
        <div className="crm-form-surface space-y-4 text-left"><p className="text-xs text-slate-600">{text("Quan hệ sẽ được giữ trong lịch sử và không bị xóa.", "The relationship remains in history and is not deleted.")}</p><Field label={text("Lý do", "Reason")}><textarea value={endReason} onChange={(event) => setEndReason(event.target.value)} className={`${INPUT} min-h-[96px]`} /></Field>{error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">{error}</div>}<div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setEndTarget(null)}>{text("Hủy", "Cancel")}</Button><Button variant="danger" disabled={!endReason.trim() || saving} onClick={endRelationship}><Unlink size={13} />{text("Kết thúc", "End")}</Button></div></div>
      </Modal>
    </div>
  );
}

function RelationshipCard({ relationship, organizationName, onOpen, onEdit, onEnd, vi }: { relationship: ContactOrganizationRelationship; organizationName?: string; onOpen(): void; onEdit(): void; onEnd(): void; vi: boolean }) {
  return <article className={`rounded-xl border bg-white p-4 ${relationship.isPrimaryRepresentative ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-200"}`}><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Building2 size={15} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={onOpen} className="crm-text-wrap text-left text-xs font-semibold text-slate-900 hover:text-violet-700">{organizationName ?? relationship.organizationAccountId}</button>{relationship.isPrimaryRepresentative && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700"><Crown size={9} />{vi ? "Đại diện chính" : "Primary"}</span>}</div><p className="mt-1 crm-text-wrap text-[10px] text-slate-500">{relationship.roleTitle || roleLabel(relationship.role, vi)}{relationship.department ? ` · ${relationship.department}` : ""}</p></div></div><div className="mt-3 flex items-center gap-2 text-[9px] text-slate-500"><CalendarDays size={11} />{vi ? "Từ" : "From"} {dateLabel(relationship.effectiveFrom)}</div><div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700"><Pencil size={11} />{vi ? "Sửa" : "Edit"}</button><button type="button" onClick={onEnd} className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600"><Unlink size={11} />{vi ? "Kết thúc" : "End"}</button></div></article>;
}

const ROLE_OPTIONS: ContactOrganizationRelationshipRole[] = ["employee", "executive", "decision_maker", "buyer", "finance", "technical", "advisor", "partner", "other"];
const DECISION_OPTIONS: Array<NonNullable<Contact["decisionRole"]>> = ["decision_maker", "influencer", "buyer", "technical", "finance", "user", "other"];
const INPUT = "min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
function roleLabel(role: ContactOrganizationRelationshipRole, vi: boolean): string { const labels: Record<ContactOrganizationRelationshipRole, [string, string]> = { employee: ["Nhân sự", "Employee"], executive: ["Lãnh đạo", "Executive"], decision_maker: ["Người quyết định", "Decision maker"], buyer: ["Người mua", "Buyer"], finance: ["Tài chính", "Finance"], technical: ["Kỹ thuật", "Technical"], advisor: ["Cố vấn", "Advisor"], partner: ["Đối tác", "Partner"], other: ["Khác", "Other"] }; return labels[role][vi ? 0 : 1]; }
function decisionLabel(role: NonNullable<Contact["decisionRole"]>, vi: boolean): string { const labels: Record<NonNullable<Contact["decisionRole"]>, [string, string]> = { decision_maker: ["Người quyết định", "Decision maker"], influencer: ["Người ảnh hưởng", "Influencer"], user: ["Người sử dụng", "User"], buyer: ["Người mua", "Buyer"], technical: ["Kỹ thuật", "Technical"], finance: ["Tài chính", "Finance"], other: ["Khác", "Other"] }; return labels[role][vi ? 0 : 1]; }
function dateLabel(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
