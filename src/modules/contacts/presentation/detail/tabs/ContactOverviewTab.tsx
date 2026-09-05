import React from "react";
import { ArrowRight, BriefcaseBusiness, CheckSquare, CircleUserRound, HeartHandshake, ReceiptText, Sparkles, UsersRound } from "lucide-react";
import { Button } from "@/shared/components/ui";
import type { Contact } from "../../../domain/model/contact.types";
import { formatVnd } from "@/shared/lib/format/currency";
import type { ContactTab } from "../ContactDetailTabs";

interface ContactOverviewTabProps {
  contact: Contact;
  customer?: { id: string; customerCode: string };
  customerName?: string;
  ownerName: string;
  locale: "vi" | "en";
  opportunityCount: number;
  orderCount: number;
  invoiceCount: number;
  activeTaskCount: number;
  supportCount: number;
  totalOrderValue: number;
  onSelectTab(tab: ContactTab, subTab?: string): void;
  onOpenCustomer?(): void;
  onCreateOpportunity?(): void;
  onCreateTask(): void;
}

export const ContactOverviewTab: React.FC<ContactOverviewTabProps> = ({
  contact,
  customer,
  customerName,
  ownerName,
  locale,
  opportunityCount,
  orderCount,
  invoiceCount,
  activeTaskCount,
  supportCount,
  totalOrderValue,
  onSelectTab,
  onOpenCustomer,
  onCreateOpportunity,
  onCreateTask,
}) => {
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  const next = !customer
    ? { title: text("Hoàn thiện liên kết hồ sơ khách hàng", "Complete the customer profile link"), detail: text("Liên hệ chưa có Customer 360 làm nguồn điều phối giao dịch và dịch vụ.", "This contact has no Customer 360 profile coordinating transactions and service."), action: () => onSelectTab("relationship", "people"), label: text("Kiểm tra liên kết", "Review connections") }
    : activeTaskCount > 0
      ? { title: text("Xử lý công việc đang mở", "Work the open tasks"), detail: text(`Có ${activeTaskCount} công việc cần tiếp tục theo dõi.`, `${activeTaskCount} tasks still need follow-up.`), action: () => onSelectTab("work", "tasks"), label: text("Mở công việc", "Open work") }
      : opportunityCount === 0 && onCreateOpportunity
        ? { title: text("Đánh giá nhu cầu bán hàng tiếp theo", "Assess the next sales need"), detail: text("Chưa có cơ hội đang được điều phối cho người liên hệ này.", "No opportunity is currently coordinated for this contact."), action: onCreateOpportunity, label: text("Tạo cơ hội", "Create opportunity") }
        : supportCount > 0
          ? { title: text("Rà soát yêu cầu dịch vụ", "Review service requests"), detail: text(`Có ${supportCount} phiếu hỗ trợ liên quan cần theo dõi trong bối cảnh quan hệ.`, `${supportCount} related support cases should be reviewed in relationship context.`), action: () => onSelectTab("service", "support"), label: text("Mở dịch vụ", "Open service") }
          : { title: text("Duy trì nhịp chăm sóc", "Maintain the relationship cadence"), detail: text("Hồ sơ đang ổn định; nên lên công việc tiếp theo để giữ liên hệ chủ động.", "The profile is stable; schedule the next task to keep engagement proactive."), action: onCreateTask, label: text("Tạo công việc", "Create task") };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-white to-violet-50/70 p-4 sm:p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-violet-700">
              <Sparkles size={16} />
              <span className="text-xs font-semibold">{text("AI nhận xét quan hệ", "AI relationship brief")}</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              {customer ? text("Người liên hệ đã có bối cảnh Customer 360", "Contact is connected to Customer 360") : text("Quan hệ cần hoàn thiện dữ liệu nền", "Relationship context needs completion")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {customer
                ? text("Thông tin bán hàng, giao dịch, dịch vụ và công việc được tổng hợp từ các module sở hữu để đội ngũ xử lý theo cùng một bối cảnh.", "Sales, transaction, service, and work facts are assembled from their owning modules so teams operate with one context.")
                : text("Có thể tiếp tục chăm sóc ở cấp người liên hệ, nhưng giao dịch và dịch vụ cần được gắn với hồ sơ khách hàng chính thức.", "Contact-level engagement can continue, but transactions and service should be linked to an official customer profile.")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label={text("Cơ hội", "Opportunities")} value={String(opportunityCount)} />
              <Metric label={text("Đơn hàng", "Orders")} value={String(orderCount)} />
              <Metric label={text("Hóa đơn", "Invoices")} value={String(invoiceCount)} />
            </div>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-white/90 p-4 shadow-sm">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-violet-600">{text("Hoạt động tiếp theo", "Recommended next action")}</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{next.title}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{next.detail}</p>
            <Button className="mt-4" size="sm" variant="primary" icon={<ArrowRight size={13} />} onClick={next.action}>{next.label}</Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<ReceiptText size={15} />} label={text("Giá trị đơn hàng", "Order value")} value={formatVnd(totalOrderValue, locale)} onClick={() => onSelectTab("transactions", "orders")} />
        <Kpi icon={<CheckSquare size={15} />} label={text("Công việc đang mở", "Open tasks")} value={String(activeTaskCount)} onClick={() => onSelectTab("work", "tasks")} />
        <Kpi icon={<HeartHandshake size={15} />} label={text("Phiếu hỗ trợ", "Support cases")} value={String(supportCount)} onClick={() => onSelectTab("service", "support")} />
        <Kpi icon={<BriefcaseBusiness size={15} />} label={text("Cơ hội bán hàng", "Sales opportunities")} value={String(opportunityCount)} onClick={() => onSelectTab("sales", "opportunities")} />
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-700"><CircleUserRound size={16} /><h3 className="text-sm font-semibold">{text("Thông tin người liên hệ", "Contact snapshot")}</h3></div>
          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field label={text("Họ và tên", "Full name")} value={contact.fullName || contact.name} />
            <Field label={text("Chức danh", "Title")} value={contact.title} />
            <Field label={text("Tổ chức", "Organization")} value={contact.companyName || contact.organizationName} />
            <Field label={text("Người phụ trách", "Owner")} value={ownerName} />
            <Field label="Email" value={contact.workEmail || contact.email} />
            <Field label={text("Điện thoại", "Phone")} value={contact.phone || contact.mobilePhone} />
          </div>
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => onSelectTab("relationship", "profile")}>{text("Xem hồ sơ đầy đủ", "Open full profile")}</Button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-700"><UsersRound size={16} /><h3 className="text-sm font-semibold">Customer 360</h3></div>
          {customer ? (
            <>
              <div className="mt-4 text-sm font-semibold text-slate-900">{customerName || customer.customerCode}</div>
              <div className="mt-1 text-xs text-slate-500">{customer.customerCode}</div>
              <p className="mt-3 text-xs leading-5 text-slate-500">{text("Đây là hồ sơ điều phối chung cho giao dịch, công nợ, dịch vụ và lịch sử quan hệ.", "This is the coordinating profile for transactions, receivables, service, and relationship history.")}</p>
              {onOpenCustomer ? <Button className="mt-4" size="sm" variant="primary" onClick={onOpenCustomer}>{text("Mở Customer 360", "Open Customer 360")}</Button> : null}
            </>
          ) : (
            <p className="mt-4 text-xs leading-5 text-slate-500">{text("Chưa có hồ sơ Customer 360 liên kết. Dữ liệu giao dịch chỉ được hiển thị khi có quan hệ chính thức.", "No Customer 360 profile is linked. Transaction data appears only when an official relationship exists.")}</p>
          )}
        </div>
      </section>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-slate-200 bg-white/80 p-3"><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-base font-semibold text-slate-900">{value}</div></div>;
const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: string; onClick(): void }> = ({ icon, label, value, onClick }) => <button type="button" onClick={onClick} className="flex min-h-[104px] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-200 hover:shadow-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">{icon}</span><span><span className="block text-xs font-medium text-slate-500">{label}</span><span className="mt-2 block text-lg font-semibold text-slate-900">{value}</span></span></button>;
const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => <div><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 crm-text-wrap text-sm font-medium text-slate-800">{value || "—"}</div></div>;
