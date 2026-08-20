import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { Button, PageHeader } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Customer, CustomerHealth } from "../../domain/model/customer.types";
import { CustomerHealthBadge } from "../components/CustomerStatusBadge";
import { buildCustomer360ReadModel } from "../model/customer360ReadModel";

const CUSTOMER_HEALTH_ORDER: Record<CustomerHealth, number> = {
  RISK: 0,
  WATCH: 1,
  GOOD: 2,
};

export const CustomerHealthPage: React.FC<{
  customers: Customer[];
  refreshToken?: unknown;
}> = ({ customers, refreshToken }) => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isVi = locale === "vi";

  const rows = useMemo(
    () =>
      customers
        .map((customer) => ({
          customer,
          model: buildCustomer360ReadModel(customer),
        }))
        .sort(
          (a, b) =>
            CUSTOMER_HEALTH_ORDER[a.customer.health] -
            CUSTOMER_HEALTH_ORDER[b.customer.health],
        ),
    [customers, refreshToken],
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
        {rows.map(({ customer, model }) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => navigate(`/customers/${customer.id}`)}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-300 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
          >
            <div>
              <div className="font-black text-slate-950">
                {model.identity.displayName}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {customer.customerCode} · {customer.type}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {isVi ? "Việc mở" : "Open work"}
              </div>
              <div className="mt-1 font-extrabold">
                {model.metrics.openTaskCount}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {isVi ? "Hỗ trợ mở" : "Open support"}
              </div>
              <div className="mt-1 font-extrabold">
                {model.metrics.openSupportCount}
              </div>
            </div>
            <CustomerHealthBadge
              health={customer.health}
              locale={isVi ? "vi" : "en"}
            />
          </button>
        ))}
      </div>
    </div>
  );
};
