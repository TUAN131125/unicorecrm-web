import React, { useMemo } from "react";
import { BarChart3, BadgeCheck, CircleDollarSign, Clock3, Target, UserRoundSearch } from "lucide-react";
import { Modal } from "@/shared/components/ui";
import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState, QualificationOutcome } from "../../domain/model/leadLifecycle.canonical";
import { getLeadWorkStateLabel, getQualificationOutcomeLabel } from "../leadLifecyclePresentation";

interface LeadStatisticsModalProps {
  isOpen: boolean;
  onClose(): void;
  leads: readonly Lead[];
  locale: string;
}

export const LeadStatisticsModal: React.FC<LeadStatisticsModalProps> = ({ isOpen, onClose, leads, locale }) => {
  const vi = locale === "vi";
  const stats = useMemo(() => {
    const now = Date.now();
    const workStateCount = Object.fromEntries(Object.values(LeadWorkState).map((state) => [state, 0])) as Record<string, number>;
    const outcomeCount = Object.fromEntries(Object.values(QualificationOutcome).map((outcome) => [outcome, 0])) as Record<string, number>;
    let overdueFollowUp = 0;
    let expectedValue = 0;
    for (const lead of leads) {
      workStateCount[lead.leadWorkState] = (workStateCount[lead.leadWorkState] || 0) + 1;
      if (lead.qualificationOutcome) outcomeCount[lead.qualificationOutcome] = (outcomeCount[lead.qualificationOutcome] || 0) + 1;
      if (lead.leadWorkState !== LeadWorkState.CLOSED && lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() < now) overdueFollowUp += 1;
      expectedValue += Number.isFinite(lead.expectedValue) ? Number(lead.expectedValue) : 0;
    }
    const positive = outcomeCount[QualificationOutcome.OPPORTUNITY] + outcomeCount[QualificationOutcome.DIRECT_SALE];
    const closed = workStateCount[LeadWorkState.CLOSED];
    return {
      total: leads.length,
      active: leads.length - closed,
      closed,
      positive,
      positiveRate: closed > 0 ? (positive / closed) * 100 : 0,
      overdueFollowUp,
      expectedValue,
      workStateCount,
      outcomeCount,
    };
  }, [leads]);

  const currency = new Intl.NumberFormat(vi ? "vi-VN" : "en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(stats.expectedValue);

  return (
    <Modal
      id="lead-statistics-modal"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={<span className="inline-flex items-center gap-2"><BarChart3 className="text-indigo-600" size={20} />{vi ? "Thống kê Lead" : "Lead statistics"}</span>}
      description={vi ? "Tổng quan hàng đợi xác minh, kết quả xử lý và giá trị dự kiến." : "Overview of the qualification queue, outcomes, and expected value."}
      bodyClassName="bg-slate-50/70"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard icon={<Target size={16} />} label={vi ? "Tổng Lead" : "Total Leads"} value={String(stats.total)} />
          <StatCard icon={<UserRoundSearch size={16} />} label={vi ? "Đang xử lý" : "Active queue"} value={String(stats.active)} tone="text-indigo-700" />
          <StatCard icon={<BadgeCheck size={16} />} label={vi ? "Kết quả tích cực" : "Positive outcomes"} value={String(stats.positive)} meta={`${stats.positiveRate.toFixed(0)}%`} tone="text-emerald-700" />
          <StatCard icon={<Clock3 size={16} />} label={vi ? "Follow-up quá hạn" : "Overdue follow-ups"} value={String(stats.overdueFollowUp)} tone="text-rose-700" />
          <StatCard icon={<CircleDollarSign size={16} />} label={vi ? "Giá trị dự kiến" : "Expected value"} value={currency} className="col-span-2" valueClassName="text-lg" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DistributionCard
            title={vi ? "Tiến độ xử lý" : "Work progression"}
            total={stats.total}
            entries={Object.values(LeadWorkState).map((state) => ({ key: state, label: getLeadWorkStateLabel(state, locale), value: stats.workStateCount[state] || 0 }))}
          />
          <DistributionCard
            title={vi ? "Kết quả xác minh" : "Qualification outcomes"}
            total={stats.closed}
            entries={Object.values(QualificationOutcome).map((outcome) => ({ key: outcome, label: getQualificationOutcomeLabel(outcome, locale), value: stats.outcomeCount[outcome] || 0 }))}
          />
        </div>
      </div>
    </Modal>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; meta?: string; tone?: string; className?: string; valueClassName?: string }> = ({ icon, label, value, meta, tone = "text-slate-900", className = "", valueClassName = "text-2xl" }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
    <div className="flex items-center gap-2 text-indigo-600">{icon}<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span></div>
    <div className={`mt-3 font-semibold ${valueClassName} ${tone}`}>{value}</div>
    {meta && <div className="mt-1 text-[10px] font-semibold text-slate-400">{meta}</div>}
  </div>
);

const DistributionCard: React.FC<{ title: string; total: number; entries: Array<{ key: string; label: string; value: number }> }> = ({ title, total, entries }) => (
  <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
    <div className="space-y-3">
      {entries.map((entry) => {
        const rate = total > 0 ? (entry.value / total) * 100 : 0;
        return (
          <div key={entry.key} className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600"><span>{entry.label}</span><span>{entry.value} ({rate.toFixed(0)}%)</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${rate}%` }} /></div>
          </div>
        );
      })}
    </div>
  </section>
);
