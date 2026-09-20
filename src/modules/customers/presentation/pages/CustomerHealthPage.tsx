import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { Button, PageHeader } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Customer, CustomerHealthBand } from "../../domain/model/customer.types";
import { CustomerHealthBadge } from "../components/CustomerStatusBadge";
import { buildCustomer360ReadModel } from "../model/customer360ReadModel";

const CUSTOMER_HEALTH_ORDER: Record<CustomerHealthBand, number> = {
  CRITICAL: 0,
  AT_RISK: 1,
  WATCH: 2,
  HEALTHY: 3,
  UNKNOWN: 4,
};

export const CustomerHealthPage: React.FC<{
  customers: Customer[];
  connected: boolean;
}> = ({ customers, connected }) => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isVi = locale === "vi";

  const rows = useMemo(
    () =>
      customers
        .map((customer) => ({
          customer,
          model: connected ? undefined : buildCustomer360ReadModel(customer),
          band: customer.healthAssessment?.healthBand ?? "UNKNOWN" as CustomerHealthBand,
        }))
        .sort(
          (a, b) =>
            CUSTOMER_HEALTH_ORDER[a.band] - CUSTOMER_HEALTH_ORDER[b.band],
        ),
    [connected, customers],
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-12">
      <PageHeader
        title={isVi ? "Sức khỏe khách hàng" : "Customer health"}
        icon={<HeartPulse size={18} />}
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowLeft size={13} />}
            onClick={() => navigate("/customers")}
          >
            {isVi ? "Khách hàng" : "Customers"}
          </Button>
        }
      />

      <div className="grid gap-3">
        {rows.map(({ customer, model, band }) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => navigate(`/customers/${customer.id}`)}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-300 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
          >
            <div>
              <div className="font-black text-slate-950">
                {model?.identity.displayName ?? customer.customerCode}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {customer.customerCode} · {customer.type}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {isVi ? "Điểm" : "Score"}
              </div>
              <div className="mt-1 font-extrabold">
                {customer.healthAssessment?.score ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {isVi ? "Độ tin cậy" : "Confidence"}
              </div>
              <div className="mt-1 font-extrabold">
                {customer.healthAssessment?.confidence ?? (isVi ? "Không có" : "None")}
              </div>
            </div>
            <CustomerHealthBadge
              health={connected ? band : customer.health}
              locale={isVi ? "vi" : "en"}
            />
          </button>
        ))}
      </div>
    </div>
  );
};
