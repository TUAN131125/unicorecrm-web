import { formatApplicationError } from "@/shared/operations";
import React, { useEffect, useState } from "react";
import { Crown, UserRound } from "lucide-react";
import { Button, Modal } from "@/shared/components/ui";
import { type Contact } from "@/modules/contacts";
import { createOrganizationRepresentativeWorkflow } from "@/workflows/contact-organization-relationship";
import { recordOperationalAudit } from "@/platform/operational-audit";
import type { OrganizationAccount } from "../../public/api";

interface OrganizationRepresentativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: OrganizationAccount;
  actorId: string;
  onCreated: (contact: Contact, account: OrganizationAccount) => void;
}

interface Draft {
  fullName: string;
  roleTitle: string;
  department: string;
  phone: string;
  email: string;
  decisionRole: Contact["decisionRole"];
  isPrimary: boolean;
}

const EMPTY_DRAFT: Draft = { fullName: "", roleTitle: "", department: "", phone: "", email: "", decisionRole: "influencer", isPrimary: false };

export const OrganizationRepresentativeModal: React.FC<OrganizationRepresentativeModalProps> = ({ isOpen, onClose, account, actorId, onCreated }) => {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (isOpen) { setDraft(EMPTY_DRAFT); setError(null); } }, [isOpen]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.fullName.trim()) return setError("Họ tên cá nhân là bắt buộc.");
    if (!draft.phone.trim() && !draft.email.trim()) return setError("Cần có số điện thoại hoặc email.");
    try {
      const now = new Date().toISOString();
      const contactId = `contact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const contact: Contact = {
        id: contactId,
        name: draft.fullName.trim(),
        fullName: draft.fullName.trim(),
        contactCode: `CN-${String(Date.now()).slice(-6)}`,
        roleTitle: draft.roleTitle.trim() || "Đại diện doanh nghiệp",
        title: draft.roleTitle.trim() || "Đại diện doanh nghiệp",
        roleAtCompany: draft.roleTitle.trim() || "Đại diện doanh nghiệp",
        department: draft.department.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        mobilePhone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        workEmail: draft.email.trim() || undefined,
        organizationAccountId: account.id,
        organizationRelationships: [{
          id: `contact-org-${crypto.randomUUID()}`,
          organizationAccountId: account.id,
          role: draft.decisionRole === "decision_maker" ? "decision_maker" : draft.decisionRole === "buyer" ? "buyer" : draft.decisionRole === "finance" ? "finance" : draft.decisionRole === "technical" ? "technical" : "employee",
          roleTitle: draft.roleTitle.trim() || undefined,
          department: draft.department.trim() || undefined,
          decisionRole: draft.decisionRole,
          isPrimaryRepresentative: draft.isPrimary,
          effectiveFrom: now,
          createdAt: now,
          createdBy: actorId,
        }],
        organizationName: account.displayName,
        companyName: account.displayName,
        ownerId: account.ownerId || actorId,
        source: account.source || "manual",
        tags: ["B2B representative"],
        isPrimaryContact: draft.isPrimary,
        decisionRole: draft.decisionRole,
        relationshipLevel: "warm",
        status: "active",
        createdFrom: "manual",
        createdAt: now,
        updatedAt: now,
      };
      const outcome = { data: createOrganizationRepresentativeWorkflow({
        organizationAccountId: account.id,
        representative: contact,
        relationship: {
          role: draft.decisionRole === "decision_maker" ? "decision_maker" : draft.decisionRole === "buyer" ? "buyer" : draft.decisionRole === "finance" ? "finance" : draft.decisionRole === "technical" ? "technical" : "employee",
          roleTitle: draft.roleTitle,
          department: draft.department,
          decisionRole: draft.decisionRole,
          isPrimaryRepresentative: draft.isPrimary || !account.primaryContactId,
          effectiveFrom: now,
        },
        actorId,
        now,
      }) };
      recordOperationalAudit({ moduleKey: "organizations", recordId: account.id, action: "OrganizationRepresentativeLinked", actorId, actorName: "CRM Operator", after: { contactId: contact.id, primary: outcome.data.organization.primaryContactId === contact.id } });
      onCreated(outcome.data.contact, outcome.data.organization);
      onClose();
    } catch (caught) {
      setError(formatApplicationError(caught));
    }
  };

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} size="md" title="Thêm cá nhân đại diện">
      <form onSubmit={submit} className="crm-form-surface space-y-5 text-left">
        <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><UserRound size={17} /></span><div><div className="text-xs font-semibold text-slate-900">Liên kết Contact với {account.displayName}</div><div className="mt-0.5 text-[10px] text-slate-500">Contact vẫn là cá nhân; Organization chỉ giữ quan hệ B2B và vai trò đại diện.</div></div></div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Họ và tên *"><input required value={draft.fullName} onChange={(e) => setDraft((c) => ({ ...c, fullName: e.target.value }))} className={INPUT_CLASS} /></Field>
          <Field label="Chức danh"><input value={draft.roleTitle} onChange={(e) => setDraft((c) => ({ ...c, roleTitle: e.target.value }))} placeholder="CEO, Procurement Manager..." className={INPUT_CLASS} /></Field>
          <Field label="Phòng ban"><input value={draft.department} onChange={(e) => setDraft((c) => ({ ...c, department: e.target.value }))} className={INPUT_CLASS} /></Field>
          <Field label="Vai trò quyết định"><select value={draft.decisionRole || "influencer"} onChange={(e) => setDraft((c) => ({ ...c, decisionRole: e.target.value as Contact["decisionRole"] }))} className={INPUT_CLASS}><option value="decision_maker">Người quyết định</option><option value="influencer">Người ảnh hưởng</option><option value="buyer">Người mua</option><option value="technical">Kỹ thuật</option><option value="finance">Tài chính</option><option value="user">Người sử dụng</option><option value="other">Khác</option></select></Field>
          <Field label="Số điện thoại"><input value={draft.phone} onChange={(e) => setDraft((c) => ({ ...c, phone: e.target.value }))} className={INPUT_CLASS} /></Field>
          <Field label="Email công việc"><input type="email" value={draft.email} onChange={(e) => setDraft((c) => ({ ...c, email: e.target.value }))} className={INPUT_CLASS} /></Field>
        </div>
        <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><input type="checkbox" checked={draft.isPrimary} onChange={(e) => setDraft((c) => ({ ...c, isPrimary: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-amber-300 text-violet-600 focus:ring-violet-500" /><span><span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"><Crown size={13} /> Đặt làm đại diện chính</span><span className="mt-1 block text-[10px] leading-4 text-amber-700/80">Người này sẽ xuất hiện ở danh sách Organization và phần tổng quan account.</span></span></label>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div>}
        <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Hủy</Button><Button type="submit" variant="primary">Thêm đại diện</Button></div>
      </form>
    </Modal>
  );
};

const INPUT_CLASS = "min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15";
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block space-y-1.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
