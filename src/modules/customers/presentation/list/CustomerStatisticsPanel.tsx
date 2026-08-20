import React from "react";
import { BarChart3 } from "lucide-react";
import { Modal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { formatCustomerCurrency } from "./customerList.helpers";

export interface CustomerStatisticsSummary {
  total: number;
  b2b: number;
  b2c: number;
  active: number;
  atRisk: number;
  archived: number;
  revenue: number;
  openDeals: number;
  openWork: number;
  openSupport: number;
  statusCount: Record<string, number>;
  healthCount: Record<string, number>;
}

interface CustomerStatisticsPanelProps {
  show: boolean;
  onClose(): void;
  statsSummary: CustomerStatisticsSummary;
}

export const CustomerStatisticsPanel: React.FC<CustomerStatisticsPanelProps> = ({ show, onClose, statsSummary }) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const rate = (value: number) => statsSummary.total > 0 ? (value / statsSummary.total) * 100 : 0;

  return (
    <Modal
      id="customer-statistics-modal"
      isOpen={show}
      onClose={onClose}
      size="lg"
      title={<span className="inline-flex items-center gap-2"><BarChart3 className="text-indigo-600" size={20} />{isVi ? "Thống kê khách hàng" : "Customer statistics"}</span>}
      bodyClassName="bg-slate-50/70"
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">{isVi ? "Tổng quan" : "Summary"}</h3>
          <div className="grid grid-cols-2 gap-3 text-left md:grid-cols-3">
            <StatCard label={isVi ? "Tổng khách hàng" : "Total customers"} value={String(statsSummary.total)} />
            <StatCard label="B2B" value={String(statsSummary.b2b)} meta={`${rate(statsSummary.b2b).toFixed(0)}%`} tone="text-indigo-600" />
            <StatCard label="B2C" value={String(statsSummary.b2c)} meta={`${rate(statsSummary.b2c).toFixed(0)}%`} tone="text-cyan-600" />
            <StatCard label={isVi ? "Đang hoạt động" : "Active"} value={String(statsSummary.active)} meta={`${rate(statsSummary.active).toFixed(0)}%`} tone="text-emerald-600" />
            <StatCard label={isVi ? "Có rủi ro" : "At risk"} value={String(statsSummary.atRisk)} meta={`${rate(statsSummary.atRisk).toFixed(0)}%`} tone="text-rose-600" />
            <StatCard label={isVi ? "Cơ hội đang mở" : "Open opportunities"} value={String(statsSummary.openDeals)} tone="text-violet-600" />
            <StatCard label={isVi ? "Doanh thu hoàn tất" : "Completed revenue"} value={formatCustomerCurrency(statsSummary.revenue, isVi)} className="col-span-2" valueClassName="text-lg" />
            <StatCard label={isVi ? "Công việc đang mở" : "Open tasks"} value={String(statsSummary.openWork)} tone="text-amber-600" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DistributionCard title={isVi ? "Phân bố trạng thái" : "Status distribution"} total={statsSummary.total} entries={Object.entries(statsSummary.statusCount)} label={(key) => statusLabel(key, isVi)} />
          <DistributionCard title={isVi ? "Phân bố sức khỏe" : "Health distribution"} total={statsSummary.total} entries={Object.entries(statsSummary.healthCount)} label={(key) => healthLabel(key, isVi)} />
        </div>

        <div className="grid grid-cols-1 gap-3 text-left md:grid-cols-2">
          <StatCard label={isVi ? "Hỗ trợ đang mở" : "Open support"} value={String(statsSummary.openSupport)} />
          <StatCard label={isVi ? "Đã lưu trữ" : "Archived"} value={String(statsSummary.archived)} />
        </div>
      </div>
    </Modal>
  );
};

const StatCard: React.FC<{ label: string; value: string; meta?: string; tone?: string; className?: string; valueClassName?: string }> = ({ label, value, meta, tone = "text-slate-800", className = "", valueClassName = "text-2xl" }) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
    <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
    <h4 className={`mt-1 font-semibold ${valueClassName} ${tone}`}>{value}</h4>
    {meta && <span className="text-[9px] font-semibold text-slate-400">{meta}</span>}
  </div>
);

const DistributionCard: React.FC<{ title: string; total: number; entries: Array<[string, number]>; label(key: string): string }> = ({ title, total, entries, label }) => (
  <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
    <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</h3>
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const distributionRate = total > 0 ? (value / total) * 100 : 0;
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-600"><span>{label(key)}</span><span>{value} ({distributionRate.toFixed(0)}%)</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-400" style={{ width: `${distributionRate}%` }} /></div>
          </div>
        );
      })}
    </div>
  </div>
);

function statusLabel(value: string, isVi: boolean): string {
  const labels: Record<string, [string, string]> = {
    NEW: ["Mới", "New"], ACTIVE: ["Đang hoạt động", "Active"], AT_RISK: ["Có rủi ro", "At risk"],
    INACTIVE: ["Không hoạt động", "Inactive"], CHURNED: ["Đã rời bỏ", "Churned"],
    DO_NOT_CONTACT: ["Không liên hệ", "Do not contact"], ARCHIVED: ["Đã lưu trữ", "Archived"],
  };
  return labels[value]?.[isVi ? 0 : 1] ?? value;
}

function healthLabel(value: string, isVi: boolean): string {
  const labels: Record<string, [string, string]> = { GOOD: ["Tốt", "Good"], WATCH: ["Theo dõi", "Watch"], RISK: ["Rủi ro", "Risk"] };
  return labels[value]?.[isVi ? 0 : 1] ?? value;
}
