import React from "react";
import { CalendarDays, Crown, Mail, Phone, Unlink, UserRound, UsersRound } from "lucide-react";
import { findContactOrganizationRelationship, type Contact } from "@/modules/contacts";
import { useI18n } from "@/i18n";

interface OrganizationRepresentativesTabProps {
  contacts: Contact[];
  organizationAccountId?: string;
  primaryContactId?: string;
  canEdit: boolean;
  onOpenContact: (contactId: string) => void;
  onSetPrimary: (contactId: string) => void;
  onEndRelationship: (contactId: string) => void;
  onAddRepresentative: () => void;
}

export const OrganizationRepresentativesTab: React.FC<OrganizationRepresentativesTabProps> = ({ contacts, organizationAccountId = "", primaryContactId, canEdit, onOpenContact, onSetPrimary, onEndRelationship, onAddRepresentative }) => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const text = (vn: string, en: string) => vi ? vn : en;
  if (contacts.length === 0) {
    return <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-8 text-center"><UsersRound size={28} className="mx-auto text-amber-500" /><h3 className="mt-3 text-sm font-semibold text-amber-900">{text("Tổ chức chưa có cá nhân đại diện", "No organization representative")}</h3><p className="mx-auto mt-2 max-w-lg text-[11px] leading-5 text-amber-700">{text("Thêm hoặc liên kết Contact để quản lý vai trò và thời gian hiệu lực.", "Add or link a Contact to manage role and effective dates.")}</p><button type="button" onClick={onAddRepresentative} className="mt-4 rounded-xl bg-violet-600 px-4 py-2.5 text-[10px] font-semibold text-white hover:bg-violet-700">{text("Thêm cá nhân đại diện", "Add representative")}</button></div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {contacts.map((contact) => {
        const relationship = findContactOrganizationRelationship(contact, organizationAccountId);
        const isPrimary = contact.id === primaryContactId || Boolean(relationship?.isPrimaryRepresentative);
        return (
          <article key={contact.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${isPrimary ? "border-amber-200 ring-2 ring-amber-100" : "border-slate-200"}`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${isPrimary ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>{initials(contact.fullName || contact.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="crm-text-wrap text-sm font-semibold text-slate-900">{contact.fullName || contact.name}</h3>{isPrimary && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700"><Crown size={10} /> {text("Đại diện chính", "Primary representative")}</span>}</div>
                <div className="mt-1 crm-text-wrap text-[10px] font-medium text-slate-500">{relationship?.roleTitle || contact.roleTitle || contact.roleAtCompany || text("Đại diện doanh nghiệp", "Organization representative")}{(relationship?.department || contact.department) ? ` · ${relationship?.department || contact.department}` : ""}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2"><Info label={text("Vai trò quan hệ", "Relationship role")} value={relationshipRoleLabel(relationship?.role, vi)} /><Info label={text("Vai trò quyết định", "Decision role")} value={decisionRoleLabel(relationship?.decisionRole || contact.decisionRole, vi)} /></div>
            {relationship && <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-600"><CalendarDays size={12} /><span>{text("Hiệu lực từ", "Effective from")} {formatDate(relationship.effectiveFrom)}</span></div>}
            <div className="mt-4 space-y-2 text-[10px] text-slate-600">{contact.phone && <Line icon={<Phone size={12} />} value={contact.phone} />}{(contact.workEmail || contact.email) && <Line icon={<Mail size={12} />} value={contact.workEmail || contact.email || ""} />}{!contact.phone && !contact.workEmail && !contact.email && <Line icon={<UserRound size={12} />} value={text("Chưa có kênh liên hệ", "No contact channel")} />}</div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => onOpenContact(contact.id)} className="text-[10px] font-semibold text-violet-700 hover:underline">{text("Mở hồ sơ Contact", "Open Contact")}</button>{canEdit && <div className="flex flex-wrap gap-2">{!isPrimary && <button type="button" onClick={() => onSetPrimary(contact.id)} className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"><Crown size={11} /> {text("Đặt đại diện chính", "Set primary")}</button>}<button type="button" onClick={() => onEndRelationship(contact.id)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700 hover:bg-rose-100"><Unlink size={11} /> {text("Kết thúc", "End")}</button></div>}</div>
          </article>
        );
      })}
    </div>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl bg-slate-50 px-3 py-2.5"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 crm-text-wrap text-[10px] font-semibold text-slate-800">{value}</div></div>;
const Line: React.FC<{ icon: React.ReactNode; value: string }> = ({ icon, value }) => <div className="flex min-w-0 items-center gap-2"><span className="text-slate-400">{icon}</span><span className="crm-text-wrap">{value}</span></div>;
function initials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "CN"; }
function decisionRoleLabel(value: Contact["decisionRole"], vi: boolean): string { const map: Record<string, [string, string]> = { decision_maker: ["Người quyết định", "Decision maker"], buyer: ["Người mua", "Buyer"], technical: ["Kỹ thuật", "Technical"], finance: ["Tài chính", "Finance"], user: ["Người sử dụng", "User"], influencer: ["Người ảnh hưởng", "Influencer"], other: ["Khác", "Other"] }; return value ? (map[value]?.[vi ? 0 : 1] ?? value) : (vi ? "Chưa xác định" : "Not specified"); }
function relationshipRoleLabel(value: string | undefined, vi: boolean): string { const map: Record<string, [string, string]> = { employee: ["Nhân sự", "Employee"], executive: ["Lãnh đạo", "Executive"], decision_maker: ["Người quyết định", "Decision maker"], buyer: ["Người mua", "Buyer"], finance: ["Tài chính", "Finance"], technical: ["Kỹ thuật", "Technical"], advisor: ["Cố vấn", "Advisor"], partner: ["Đối tác", "Partner"], other: ["Khác", "Other"] }; return value ? (map[value]?.[vi ? 0 : 1] ?? value) : (vi ? "Đại diện" : "Representative"); }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
