import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Layers3, Users } from "lucide-react";
import { Button, PageHeader } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Customer } from "../../domain/model/customer.types";
import { buildCustomer360ReadModel } from "../model/customer360ReadModel";

export const CustomerSegmentsPage: React.FC<{ customers: Customer[]; refreshToken?: unknown }> = ({ customers, refreshToken }) => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const rows = useMemo(() => customers.map((customer) => ({ customer, model: buildCustomer360ReadModel(customer) })), [customers, refreshToken]);
  const segments = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.customer.segment || (row.customer.type === "B2B" ? "B2B" : "B2C");
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);
  return <div className="mx-auto w-full max-w-7xl space-y-5 pb-12">
    <PageHeader title={isVi ? "Phân khúc khách hàng" : "Customer segments"} icon={<Layers3 size={18} />} actions={<Button size="sm" variant="secondary" icon={<ArrowLeft size={13} />} onClick={() => navigate("/customers")}>{isVi ? "Khách hàng" : "Customers"}</Button>} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{segments.map(([segment, members]) => <section key={segment} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><div className="max-w-full break-words text-xs font-black uppercase tracking-wider text-slate-500 [overflow-wrap:anywhere]">{segment}</div><div className="mt-1 text-2xl font-black text-slate-950">{members.length}</div></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Users size={18} /></div></div><div className="mt-4 space-y-2">{members.slice(0, 5).map(({ customer, model }) => <button key={customer.id} type="button" onClick={() => navigate(`/customers/${customer.id}`)} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-left hover:border-violet-300"><span className="min-w-0 break-words font-extrabold text-slate-900 [overflow-wrap:anywhere]">{model.identity.displayName}</span><span className="shrink-0 text-[10px] font-bold text-slate-500">{customer.customerCode}</span></button>)}</div></section>)}</div>
  </div>;
};
