import React from "react";
import { Building2, Crown, Mail, Phone, UsersRound } from "lucide-react";
import type { Contact } from "@/modules/contacts";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import {
  formatOrganizationCurrency,
  getOrganizationInitials,
  getOrganizationStatus,
  getOrganizationStatusBadgeClass,
  getOrganizationStatusLabel,
  type OrganizationAccountMetrics,
} from "../model/organizationAccountView";

export interface OrganizationListRow {
  account: OrganizationAccount;
  primaryContact?: Contact;
  metrics: OrganizationAccountMetrics;
  ownerName: string;
}

interface OrganizationTableProps {
  rows: OrganizationListRow[];
  selectedIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelect: (id: string, checked: boolean) => void;
  onOpen: (id: string) => void;
}

export const OrganizationTable: React.FC<OrganizationTableProps> = ({
  rows,
  selectedIds,
  onSelectAll,
  onSelect,
  onOpen,
}) => {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.account.id));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" /></th>
              <th className="px-4 py-3">Tổ chức</th>
              <th className="px-4 py-3">Cá nhân đại diện</th>
              <th className="px-4 py-3">Phân loại B2B</th>
              <th className="px-4 py-3 text-right">Giá trị cơ hội</th>
              <th className="px-4 py-3 text-right">Doanh số đơn hàng</th>
              <th className="px-4 py-3">Người phụ trách</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ account, primaryContact, metrics, ownerName }) => {
              const status = getOrganizationStatus(account);
              const isSelected = selectedIds.includes(account.id);
              return (
                <tr
                  key={account.id}
                  className={`group transition hover:bg-violet-50/35 ${isSelected ? "bg-violet-50/50" : "bg-white"}`}
                >
                  <td className="px-4 py-4 align-top">
                    <input type="checkbox" checked={isSelected} onChange={(e) => onSelect(account.id, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <button type="button" onClick={() => onOpen(account.id)} className="flex max-w-[330px] items-start gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-50 text-xs font-semibold text-violet-700 ring-1 ring-violet-200/70">{getOrganizationInitials(account.displayName)}</span>
                      <span className="min-w-0">
                        <span className="block crm-text-wrap text-sm font-semibold text-slate-900 group-hover:text-violet-700">{account.displayName}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500">
                          <span>{account.taxCode ? `MST ${account.taxCode}` : account.legalName || account.id}</span>
                          {account.domain && <><span>•</span><span>{account.domain}</span></>}
                        </span>
                        {account.tags?.length ? <span className="mt-2 flex flex-wrap gap-1">{account.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600">{tag}</span>)}</span> : null}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-4 align-top">
                    {primaryContact ? (
                      <div className="max-w-[250px]">
                        <div className="flex items-center gap-2 font-semibold text-slate-800"><Crown size={13} className="text-amber-500" /> {primaryContact.fullName || primaryContact.name}</div>
                        <div className="mt-1 text-[10px] font-medium text-slate-500">{primaryContact.roleTitle || primaryContact.roleAtCompany || "Người đại diện"}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                          {primaryContact.phone && <span className="inline-flex items-center gap-1"><Phone size={10} />{primaryContact.phone}</span>}
                          {(primaryContact.workEmail || primaryContact.email) && <span className="inline-flex max-w-[180px] items-center gap-1 crm-text-wrap"><Mail size={10} />{primaryContact.workEmail || primaryContact.email}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-medium text-amber-700">Chưa có người đại diện chính</div>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col items-start gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase ${getOrganizationStatusBadgeClass(status)}`}>{getOrganizationStatusLabel(status)}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600"><Building2 size={11} /> {account.industry || "Chưa phân ngành"}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><UsersRound size={11} /> {metrics.representativeCount} cá nhân liên kết · {account.sizeBand || "Chưa phân loại"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <div className="font-semibold text-violet-700">{formatOrganizationCurrency(metrics.pipelineValue)}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{metrics.openDealsCount} cơ hội mở</div>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <div className="font-semibold text-emerald-700">{formatOrganizationCurrency(metrics.orderValue)}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{metrics.completedOrdersCount} đơn hoàn tất</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="font-medium text-slate-700">{ownerName}</div>
                    <div className="mt-1 text-[10px] text-slate-400">Người phụ trách</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
