import type { FC } from "react";
import { BarChart3, Info } from "lucide-react";
import { Modal } from "@/shared/components/ui";
import type { OrderStatistics } from "./orderList.types";
import type { OrderState } from "../../domain/model/order.types";

export interface OrderStatisticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  locale: string;
  stats: OrderStatistics;
  getStatusLabel: (status: OrderState) => string;
  formatValue: (val: number) => string;
}

export const OrderStatisticsDrawer: FC<OrderStatisticsDrawerProps> = ({
  isOpen,
  onClose,
  title,
  locale,
  stats,
  getStatusLabel,
  formatValue,
}) => (
  <Modal
    id="order-statistics-modal"
    isOpen={isOpen}
    onClose={onClose}
    size="md"
    title={<span className="inline-flex items-center gap-2"><BarChart3 className="text-indigo-600" size={20} />{title}</span>}
    description={locale === "vi" ? "Tổng quan giá trị, trạng thái và tiến độ xử lý đơn hàng." : "Overview of order value, status, and processing progress."}
    bodyClassName="bg-slate-50/70"
  >
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-violet-100/50 p-4">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-violet-500">{locale === "vi" ? "Doanh số hoàn tất" : "Completed revenue"}</span>
          <span className="mt-1 block font-mono text-sm font-semibold text-violet-800 sm:text-base">{formatValue(stats.completedValue)}</span>
        </div>
        <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-amber-100/50 p-4">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-amber-600">{locale === "vi" ? "Khoản thu chưa hoàn" : "Total unpaid value"}</span>
          <span className="mt-1 block font-mono text-sm font-semibold text-amber-800 sm:text-base">{formatValue(stats.unpaidValue)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500">{locale === "vi" ? "Giá trị đơn hàng trung bình" : "Average order value"}</div>
        <div className="mt-1 font-mono text-xl font-semibold text-slate-900">{formatValue(stats.avgValue)}</div>
      </div>

      <h3 className="border-b border-slate-200 pb-2 pt-2 text-xs font-medium uppercase tracking-wider text-slate-400">{locale === "vi" ? "Thống kê số lượng" : "Volume statistics"}</h3>

      <div className="grid gap-2.5 text-xs text-slate-600 sm:grid-cols-2">
        <MetricRow label={locale === "vi" ? "Tất cả đơn hàng" : "Total volume"} value={stats.totalCount} />
        <MetricRow label={getStatusLabel("DRAFT")} value={stats.draftCount} />
        <MetricRow label={getStatusLabel("CONFIRMED")} value={stats.confirmedCount} />
        <MetricRow label={locale === "vi" ? "Đang xử lý" : "Processing"} value={stats.processingCount} />
        <MetricRow label={getStatusLabel("COMPLETED")} value={stats.completedCount} tone="text-emerald-700" />
        <MetricRow label={getStatusLabel("CANCELLED")} value={stats.cancelledCount} tone="text-rose-700" />
      </div>

      <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-[11px] leading-relaxed text-blue-800">
        <Info size={16} className="shrink-0 text-blue-600" />
        <span>{locale === "vi" ? "Thống kê được tổng hợp từ dữ liệu đơn hàng và các module owner liên quan." : "Statistics are aggregated from Order data and related owning modules."}</span>
      </div>
    </div>
  </Modal>
);

const MetricRow: FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone = "text-slate-700" }) => (
  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <span className={`font-semibold ${tone}`}>{label}</span>
    <span className={`font-semibold leading-none ${tone}`}>{value}</span>
  </div>
);
