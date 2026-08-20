import React from "react";
import { BarChart3, BriefcaseBusiness, Building2, CircleDollarSign, UserCheck, UsersRound } from "lucide-react";
import { Modal } from "@/shared/components/ui";
import { formatOrganizationCurrency } from "../model/organizationAccountView";

interface OrganizationStatisticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  totalOrganizations: number;
  organizationsWithRepresentative: number;
  totalRepresentatives: number;
  openDealsCount: number;
  pipelineValue: number;
  orderValue: number;
  industryBreakdown: Array<{ label: string; count: number }>;
}

export const OrganizationStatisticsDrawer: React.FC<OrganizationStatisticsDrawerProps> = ({
  isOpen,
  onClose,
  totalOrganizations,
  organizationsWithRepresentative,
  totalRepresentatives,
  openDealsCount,
  pipelineValue,
  orderValue,
  industryBreakdown,
}) => (
  <Modal
    id="organization-statistics-modal"
    isOpen={isOpen}
    onClose={onClose}
    size="md"
    title={<span className="inline-flex items-center gap-2"><BarChart3 className="text-indigo-600" size={20} />Thống kê tổ chức B2B</span>}
    bodyClassName="bg-slate-50/70"
  >
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Building2 size={15} />} label="Tổng tổ chức" value={totalOrganizations.toLocaleString()} />
        <Stat icon={<UserCheck size={15} />} label="Có đại diện chính" value={`${organizationsWithRepresentative}/${totalOrganizations}`} />
        <Stat icon={<UsersRound size={15} />} label="Cá nhân liên kết" value={totalRepresentatives.toLocaleString()} />
        <Stat icon={<BriefcaseBusiness size={15} />} label="Cơ hội đang mở" value={openDealsCount.toLocaleString()} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ValueCard label="Pipeline đang mở" value={formatOrganizationCurrency(pipelineValue)} icon={<BarChart3 size={16} />} />
        <ValueCard label="Giá trị đơn hàng" value={formatOrganizationCurrency(orderValue)} icon={<CircleDollarSign size={16} />} />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Phân bổ theo ngành</div>
        <div className="space-y-3">
          {industryBreakdown.length === 0 ? <div className="text-xs text-slate-400">Chưa có dữ liệu ngành.</div> : industryBreakdown.map((item) => {
            const width = totalOrganizations > 0 ? Math.max(8, (item.count / totalOrganizations) * 100) : 0;
            return <div key={item.label}><div className="mb-1 flex items-center justify-between text-[10px]"><span className="font-medium text-slate-700">{item.label}</span><span className="font-semibold text-violet-700">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${width}%` }} /></div></div>;
          })}
        </div>
      </section>
    </div>
  </Modal>
);

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-violet-600">{icon}<span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</span></div><div className="mt-3 text-xl font-semibold text-slate-950">{value}</div></div>;
const ValueCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950 p-4 text-white"><div className="flex items-center gap-2 text-indigo-200">{icon}<span className="text-[9px] font-semibold uppercase tracking-wide">{label}</span></div><div className="mt-3 crm-text-wrap text-lg font-semibold text-white">{value}</div></div>;
