import React from "react";
import { BarChart3 } from "lucide-react";
import { useI18n } from "@/i18n";
import { getContactStatusLabel, getContactPriorityLabel } from "./contactList.helpers";
import { formatVnd } from "@/shared/lib/format/currency";
import { Modal } from "@/shared/components/ui";

interface ContactStatisticsPanelProps {
  show: boolean;
  onClose: () => void;
  statsSummary: {
    total: number;
    linked: number;
    linkedRate: number;
    unlinked: number;
    openOppsCount: number;
    totalOppValue: number;
    statusCount: Record<string, number>;
    priorityCount: Record<string, number>;
    needsFollowUpCount: number;
    overdueFollowUpCount: number;
    inConsultingCount: number;
    openOpportunityCount: number;
    becameCustomerCount: number;
    doNotContactCount: number;
    followUpDueRate: number;
    openOpportunityRate: number;
    becameCustomerRate: number;
  };
}

export const ContactStatisticsPanel: React.FC<ContactStatisticsPanelProps> = ({
  show,
  onClose,
  statsSummary,
}) => {
  const { t, tx, locale } = useI18n();

  return (
    <Modal
      id="contact-statistics-modal"
      isOpen={show}
      onClose={onClose}
      size="lg"
      title={<span className="inline-flex items-center gap-2"><BarChart3 className="text-indigo-600" size={20} />{t("contactList.statistics.title")}</span>}
      bodyClassName="bg-slate-50/70"
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">{t("contactList.statistics.summary")}</h3>
          <div className="grid grid-cols-2 gap-3 text-left md:grid-cols-3">
            <StatCard label={t("contactList.kpi.total")} value={String(statsSummary.total)} />
            <StatCard label={t("contactStatus.needs_follow_up")} value={String(statsSummary.needsFollowUpCount)} meta={`${tx("contactList.statistics.linkedRate", "Tỉ lệ")}: ${statsSummary.followUpDueRate.toFixed(0)}%`} tone="text-amber-600" />
            <StatCard label={tx("contactList.statistics.overdueFollowUp", "Trễ hạn liên hệ")} value={String(statsSummary.overdueFollowUpCount)} tone="text-rose-600" />
            <StatCard label={t("contactStatus.in_consulting")} value={String(statsSummary.inConsultingCount)} tone="text-sky-600" />
            <StatCard label={t("contactStatus.has_open_opportunity")} value={String(statsSummary.openOpportunityCount)} meta={`${tx("contactList.statistics.linkedRate", "Tỉ lệ")}: ${statsSummary.openOpportunityRate.toFixed(0)}%`} tone="text-indigo-600" />
            <StatCard label={tx("contactList.statistics.customerMembers", "Đã là khách hàng")} value={String(statsSummary.becameCustomerCount)} meta={`${tx("contactList.statistics.linkedRate", "Tỉ lệ")}: ${statsSummary.becameCustomerRate.toFixed(0)}%`} tone="text-emerald-600" />
            <StatCard label={t("contactDetail.overview.totalPipeline")} value={formatVnd(statsSummary.totalOppValue, locale)} className="col-span-2" valueClassName="text-lg" />
            <StatCard label={t("contactStatus.do_not_contact")} value={String(statsSummary.doNotContactCount)} tone="text-rose-600" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DistributionCard
            title={t("contactList.statistics.statusDistribution")}
            total={statsSummary.total}
            entries={Object.entries(statsSummary.statusCount)}
            label={(key) => getContactStatusLabel(key, t)}
            tone={(key) => key === "active" ? "bg-blue-400" : key === "needs_follow_up" ? "bg-amber-400" : key === "in_consulting" ? "bg-sky-400" : key === "has_open_opportunity" ? "bg-indigo-400" : key === "do_not_contact" ? "bg-rose-500" : "bg-slate-400"}
          />
          <DistributionCard
            title={t("contactList.statistics.priorityDistribution")}
            total={statsSummary.total}
            entries={Object.entries(statsSummary.priorityCount)}
            label={(key) => getContactPriorityLabel(key, t)}
            tone={(key) => key === "LOW" ? "bg-slate-400" : key === "MEDIUM" ? "bg-indigo-400" : key === "HIGH" ? "bg-amber-500" : "bg-rose-500"}
          />
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

const DistributionCard: React.FC<{
  title: string;
  total: number;
  entries: Array<[string, number]>;
  label(key: string): string;
  tone(key: string): string;
}> = ({ title, total, entries, label, tone }) => (
  <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
    <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</h3>
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const distributionRate = total > 0 ? (value / total) * 100 : 0;
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-600">
              <span>{label(key)}</span>
              <span>{value} ({distributionRate.toFixed(0)}%)</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${tone(key)}`} style={{ width: `${distributionRate}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
