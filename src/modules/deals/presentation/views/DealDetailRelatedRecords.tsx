import React from "react";
import { Building2, UserRound } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { DealDetailField } from "./DealDetailField";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailRelatedRecords({ controller: c }: { controller: DealDetailController }) {
  const vi = c.locale === "vi";
  const organization = c.deal.buyerRef.type === "ORGANIZATION_ACCOUNT";
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-sm font-semibold text-slate-900">{vi ? "Thông tin người mua" : "Buyer information"}</h2>
    <DealDetailField field="buyerRef" className="space-y-3">
      <div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-600">{organization ? <Building2 size={18} /> : <UserRound size={18} />}</span><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-800">{"name" in c.buyerLabel ? c.buyerLabel.name : c.buyerLabel.status === "LOADING" ? (vi ? "Đang tải…" : "Loading…") : (vi ? "Chưa có tên người mua" : "Buyer name unavailable")}</p><p className="mt-1 text-xs text-slate-500">{organization ? (vi ? "Tổ chức" : "Organization") : (vi ? "Liên hệ" : "Contact")}</p></div></div>
      {c.buyerLabel.status === "READY" && <Button size="sm" variant="secondary" fullWidth onClick={() => c.navigate(`/${organization ? "organizations" : "contacts"}/${c.deal.buyerRef.id}`)}>{vi ? "Mở hồ sơ người mua" : "Open buyer record"}</Button>}
    </DealDetailField>
  </section>;
}
