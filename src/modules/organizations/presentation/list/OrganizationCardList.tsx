import React from "react";
import { ArrowUpRight, BriefcaseBusiness, Crown, Mail, Phone, ShoppingBag, UsersRound } from "lucide-react";
import {
  formatOrganizationCurrency,
  getOrganizationInitials,
  getOrganizationStatus,
  getOrganizationStatusBadgeClass,
  getOrganizationStatusLabel,
} from "../model/organizationAccountView";
import type { OrganizationListRow } from "./OrganizationTable";

interface OrganizationCardListProps {
  rows: OrganizationListRow[];
  selectedIds: string[];
  onSelect: (id: string, checked: boolean) => void;
  onOpen: (id: string) => void;
}

export const OrganizationCardList: React.FC<OrganizationCardListProps> = ({ rows, selectedIds, onSelect, onOpen }) => (
  <div data-data-surface="list" className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
    {rows.map(({ account, primaryContact, metrics, ownerName }) => {
      const status = getOrganizationStatus(account);
      return (
        <article key={account.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
          <div className="flex items-start gap-3">
            <input type="checkbox" checked={selectedIds.includes(account.id)} onChange={(e) => onSelect(account.id, e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-50 text-sm font-semibold text-violet-700 ring-1 ring-violet-200/70">{getOrganizationInitials(account.displayName)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="crm-text-wrap text-sm font-semibold text-slate-900">{account.displayName}</h3><p className="mt-1 crm-text-wrap text-[10px] font-medium text-slate-500">{account.industry || "Chưa phân ngành"} · {account.sizeBand || "B2B"}</p></div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold ${getOrganizationStatusBadgeClass(status)}`}>{getOrganizationStatusLabel(status)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[9px] font-semibold uppercase tracking-wider text-violet-600">Đại diện chính</span><Crown size={13} className="text-amber-500" /></div>
            {primaryContact ? <><div className="text-xs font-semibold text-slate-900">{primaryContact.fullName || primaryContact.name}</div><div className="mt-1 text-[10px] text-slate-500">{primaryContact.roleTitle || primaryContact.roleAtCompany || "Người đại diện"}</div><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">{primaryContact.phone && <span className="inline-flex items-center gap-1"><Phone size={10} /> {primaryContact.phone}</span>}{(primaryContact.workEmail || primaryContact.email) && <span className="inline-flex min-w-0 items-center gap-1 crm-text-wrap"><Mail size={10} /> {primaryContact.workEmail || primaryContact.email}</span>}</div></> : <div className="text-[10px] font-medium text-amber-700">Chưa xác định cá nhân đại diện.</div>}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric icon={<UsersRound size={12} />} value={String(metrics.representativeCount)} label="Cá nhân" />
            <Metric icon={<BriefcaseBusiness size={12} />} value={String(metrics.openDealsCount)} label="Cơ hội" />
            <Metric icon={<ShoppingBag size={12} />} value={String(metrics.completedOrdersCount)} label="Đơn hoàn tất" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-left">
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[9px] font-medium uppercase text-slate-400">Giá trị cơ hội</div><div className="mt-1 crm-text-wrap text-xs font-semibold text-violet-700">{formatOrganizationCurrency(metrics.pipelineValue)}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[9px] font-medium uppercase text-slate-400">Đơn hàng</div><div className="mt-1 crm-text-wrap text-xs font-semibold text-emerald-700">{formatOrganizationCurrency(metrics.orderValue)}</div></div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><div><div className="text-[9px] uppercase tracking-wide text-slate-400">Người phụ trách</div><div className="mt-0.5 text-[10px] font-medium text-slate-700">{ownerName}</div></div><button type="button" onClick={() => onOpen(account.id)} className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-violet-700">Xem chi tiết <ArrowUpRight size={12} /></button></div>
        </article>
      );
    })}
  </div>
);

const Metric: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"><div className="flex items-center gap-1.5 text-slate-400">{icon}<span className="text-[9px] font-medium uppercase">{label}</span></div><div className="mt-1 text-sm font-semibold text-slate-900">{value}</div></div>;
