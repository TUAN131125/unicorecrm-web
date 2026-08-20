import React from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Crown,
  Globe2,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Contact } from "@/modules/contacts";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import type { OrganizationDetailTab } from "./OrganizationDetailTabs";
import {
  formatOrganizationCurrency,
  getOrganizationStatus,
  getOrganizationStatusLabel,
} from "../model/organizationAccountView";

interface OrganizationOverviewTabProps {
  account: OrganizationAccount;
  primaryContact?: Contact;
  ownerName: string;
  representativeCount: number;
  openDealsCount: number;
  pipelineValue: number;
  orderValue: number;
  quotesCount: number;
  openTasksCount: number;
  supportCount: number;
  onOpenPrimaryContact: () => void;
  onAddRepresentative: () => void;
  onSelectTab: (tab: OrganizationDetailTab, subTab?: string) => void;
}

export const OrganizationOverviewTab: React.FC<OrganizationOverviewTabProps> = ({
  account,
  primaryContact,
  ownerName,
  representativeCount,
  openDealsCount,
  pipelineValue,
  orderValue,
  quotesCount,
  openTasksCount,
  supportCount,
  onOpenPrimaryContact,
  onAddRepresentative,
  onSelectTab,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  const status = getOrganizationStatus(account);
  const assessment = buildOrganizationAssessment({
    account,
    primaryContact,
    representativeCount,
    openDealsCount,
    pipelineValue,
    orderValue,
    quotesCount,
    openTasksCount,
    supportCount,
    isVi,
  });

  const runRecommendedAction = () => {
    if (assessment.action === "ADD_REPRESENTATIVE") return onAddRepresentative();
    if (assessment.action === "OPEN_DEALS") return onSelectTab("sales", "opportunities");
    if (assessment.action === "OPEN_SUPPORT") return onSelectTab("service", "support");
    if (assessment.action === "OPEN_WORK") return onSelectTab("work", "tasks");
    if (primaryContact) return onOpenPrimaryContact();
    return onSelectTab("relationship", "people");
  };

  return (
    <div data-organization-overview="ai-first" className="min-w-0 space-y-4 animate-fade-in">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 sm:p-5">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <Sparkles size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-violet-700">
                    {text("AI tổng quan tổ chức", "AI organization overview")}
                  </div>
                  <h2 className="mt-0.5 crm-text-wrap text-base font-semibold leading-6 text-slate-950 sm:text-lg">
                    {text("Sức khỏe quan hệ B2B và ưu tiên hiện tại", "B2B relationship health and current priority")}
                  </h2>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${assessment.badgeClass}`}>
                  {getOrganizationStatusLabel(status)}
                </span>
              </div>

              <p className="mt-3 max-w-3xl crm-text-wrap text-sm font-normal leading-6 text-slate-600">
                {assessment.summary}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <AiMetric label={text("Điểm quan hệ", "Relationship score")} value={`${assessment.score}/100`} />
                <AiMetric label={text("Độ phủ dữ liệu", "Data coverage")} value={`${assessment.coverage}%`} />
                <AiMetric
                  label={text("Tín hiệu cần theo dõi", "Signals to monitor")}
                  value={String(assessment.attentionCount)}
                  help={assessment.attentionCount > 0 ? text("Cần ưu tiên xử lý", "Requires attention") : text("Chưa có ngoại lệ", "No current exception")}
                />
              </div>
            </div>

            <aside className="min-w-0 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
              <div className="flex items-center gap-2 text-[11px] font-medium text-violet-700">
                <Sparkles size={14} />
                <span>{text("Đề xuất hoạt động tiếp theo", "Recommended next activity")}</span>
              </div>
              <p className="mt-2 crm-text-wrap text-sm font-medium leading-6 text-slate-900">
                {assessment.nextAction}
              </p>
              <Button type="button" variant="primary" size="sm" className="mt-4 w-full justify-center" onClick={runRecommendedAction}>
                {assessment.actionLabel}
              </Button>
            </aside>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {text("Nhận xét chính từ AI", "Key AI observations")}
                </h3>
                <p className="mt-0.5 text-xs font-normal leading-5 text-slate-500">
                  {text("Chỉ giữ các tín hiệu ảnh hưởng trực tiếp đến quan hệ, bán hàng và chăm sóc.", "Only signals that directly affect the relationship, sales and service are shown.")}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                {assessment.observations.length} {text("nhận xét", "observation(s)")}
              </span>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {assessment.observations.map((observation) => (
                <div key={observation.title} className={`rounded-xl border p-3 ${observation.className}`}>
                  <div className="crm-text-wrap text-xs font-medium leading-5 text-slate-900">{observation.title}</div>
                  <div className="mt-1 crm-text-wrap text-[11px] font-normal leading-5 text-slate-600">{observation.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<BriefcaseBusiness size={15} />} label={text("Cơ hội đang mở", "Open opportunities")} value={String(openDealsCount)} meta={formatOrganizationCurrency(pipelineValue)} />
        <Kpi icon={<ShoppingBag size={15} />} label={text("Giá trị đơn hàng", "Order value")} value={formatOrganizationCurrency(orderValue)} meta={`${quotesCount} ${text("báo giá liên quan", "related quote(s)")}`} />
        <Kpi icon={<UsersRound size={15} />} label={text("Cá nhân liên kết", "Linked representatives")} value={String(representativeCount)} meta={primaryContact ? `${text("Đại diện", "Primary")}: ${primaryContact.fullName || primaryContact.name}` : text("Chưa có đại diện chính", "No primary representative")} />
        <Kpi icon={<CalendarClock size={15} />} label={text("Công việc cần xử lý", "Work requiring action")} value={String(openTasksCount)} meta={`${supportCount} ${text("phiếu hỗ trợ liên quan", "related support case(s)")}`} />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-violet-600" />
            <h3 className="text-sm font-semibold text-slate-900">{text("Thông tin tổ chức", "Organization snapshot")}</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Info label={text("Tên pháp lý", "Legal name")} value={account.legalName || account.displayName} />
            <Info label={text("Mã số thuế", "Tax ID")} value={account.taxCode || text("Chưa cập nhật", "Not available")} />
            <Info label={text("Ngành nghề", "Industry")} value={account.industry || text("Chưa phân ngành", "Not categorized")} />
            <Info label={text("Quy mô", "Company size")} value={account.sizeBand || text("Chưa phân loại", "Not categorized")} />
            <Info label={text("Người phụ trách", "Owner")} value={ownerName} />
            <Info label={text("Nguồn", "Source")} value={account.source || text("Chưa xác định", "Not identified")} />
          </div>
          <div className="mt-4 grid min-w-0 gap-2 border-t border-slate-100 pt-4 text-xs font-normal text-slate-600 sm:grid-cols-2">
            {account.website || account.domain ? <Line icon={<Globe2 size={13} />} value={account.website || account.domain || ""} /> : null}
            {account.phone ? <Line icon={<Phone size={13} />} value={account.phone} /> : null}
            {account.email ? <Line icon={<Mail size={13} />} value={account.email} /> : null}
            {account.address ? <Line icon={<MapPin size={13} />} value={account.address} /> : null}
          </div>
          {account.notes ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="text-[11px] font-medium text-slate-600">{text("Ghi chú", "Notes")}</div>
              <p className="mt-1 crm-text-wrap text-xs font-normal leading-5 text-slate-600">{account.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown size={15} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900">{text("Đại diện chính", "Primary representative")}</h3>
            </div>
            {primaryContact ? (
              <button type="button" onClick={onOpenPrimaryContact} className="inline-flex min-h-8 items-center gap-1 text-[11px] font-medium text-violet-700 hover:text-violet-800">
                {text("Mở hồ sơ", "Open record")} <ArrowRight size={13} />
              </button>
            ) : null}
          </div>

          {primaryContact ? (
            <div className="mt-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-semibold text-violet-700">
                  {initials(primaryContact.fullName || primaryContact.name)}
                </span>
                <div className="min-w-0">
                  <div className="crm-text-wrap text-sm font-semibold text-slate-900">{primaryContact.fullName || primaryContact.name}</div>
                  <div className="mt-0.5 crm-text-wrap text-[11px] font-normal leading-5 text-slate-500">
                    {primaryContact.roleTitle || primaryContact.roleAtCompany || text("Người đại diện", "Representative")}
                    {primaryContact.department ? ` · ${primaryContact.department}` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Info label={text("Vai trò quyết định", "Decision role")} value={decisionRoleLabel(primaryContact.decisionRole, isVi)} />
                <Info label={text("Mức ảnh hưởng", "Influence")} value={primaryContact.influenceLevel ? influenceLabel(primaryContact.influenceLevel, isVi) : text("Chưa đánh giá", "Not assessed")} />
                <Info label={text("Điện thoại", "Phone")} value={primaryContact.phone || primaryContact.mobilePhone || text("Chưa cập nhật", "Not available")} />
                <Info label={text("Email", "Email")} value={primaryContact.workEmail || primaryContact.email || text("Chưa cập nhật", "Not available")} />
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/70 p-4">
              <div className="text-sm font-medium text-amber-900">{text("Chưa xác định đại diện chính", "No primary representative")}</div>
              <p className="mt-1 text-xs font-normal leading-5 text-amber-800">
                {text("Thêm một người liên hệ đại diện để các hoạt động bán hàng và chăm sóc có đầu mối rõ ràng.", "Add a representative contact so sales and service activities have a clear point of contact.")}
              </p>
              <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onAddRepresentative}>
                {text("Thêm đại diện", "Add representative")}
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const AiMetric: React.FC<{ label: string; value: string; help?: string }> = ({ label, value, help }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-3">
    <div className="text-[10px] font-medium text-slate-500">{label}</div>
    <div className="mt-1 crm-text-wrap text-base font-semibold text-slate-950">{value}</div>
    {help ? <div className="mt-0.5 crm-text-wrap text-[10px] font-normal text-slate-500">{help}</div> : null}
  </div>
);

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: string; meta: string }> = ({ icon, label, value, meta }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <span className="crm-text-wrap text-[11px] font-medium leading-5 text-slate-600">{label}</span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">{icon}</span>
    </div>
    <div className="mt-3 crm-text-wrap text-lg font-semibold text-slate-950">{value}</div>
    <div className="mt-1 crm-text-wrap text-[10px] font-normal leading-4 text-slate-500">{meta}</div>
  </div>
);

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
    <div className="text-[10px] font-medium text-slate-500">{label}</div>
    <div className="mt-1 crm-text-wrap text-xs font-medium leading-5 text-slate-800">{value}</div>
  </div>
);

const Line: React.FC<{ icon: React.ReactNode; value: string }> = ({ icon, value }) => (
  <div className="flex min-w-0 items-start gap-2">
    <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
    <span className="min-w-0 break-words">{value}</span>
  </div>
);

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "CN";
}

function decisionRoleLabel(value: Contact["decisionRole"], isVi: boolean): string {
  const labels = {
    decision_maker: ["Người quyết định", "Decision maker"],
    buyer: ["Người mua", "Buyer"],
    technical: ["Kỹ thuật", "Technical"],
    finance: ["Tài chính", "Finance"],
    user: ["Người sử dụng", "User"],
    influencer: ["Người ảnh hưởng", "Influencer"],
    other: ["Khác / Chưa xác định", "Other / Not identified"],
  } as const;
  const label = labels[value || "other"] || labels.other;
  return isVi ? label[0] : label[1];
}

function influenceLabel(value: NonNullable<Contact["influenceLevel"]>, isVi: boolean): string {
  if (value === "high") return isVi ? "Cao" : "High";
  if (value === "medium") return isVi ? "Trung bình" : "Medium";
  return isVi ? "Thấp" : "Low";
}

function buildOrganizationAssessment(args: {
  account: OrganizationAccount;
  primaryContact?: Contact;
  representativeCount: number;
  openDealsCount: number;
  pipelineValue: number;
  orderValue: number;
  quotesCount: number;
  openTasksCount: number;
  supportCount: number;
  isVi: boolean;
}) {
  const { account, primaryContact, representativeCount, openDealsCount, pipelineValue, orderValue, openTasksCount, supportCount, isVi } = args;
  const text = (vi: string, en: string) => isVi ? vi : en;
  const status = getOrganizationStatus(account);
  const populatedFields = [account.taxCode, account.industry, account.sizeBand, account.website || account.domain, account.phone, account.email, account.address, primaryContact?.id].filter(Boolean).length;
  const coverage = Math.round((populatedFields / 8) * 100);
  const relationshipBase = status === "strategic" ? 88 : status === "active" ? 76 : status === "prospect" ? 60 : 42;
  const score = Math.max(20, Math.min(100, relationshipBase + (primaryContact ? 5 : -12) + (openDealsCount > 0 ? 4 : 0) - Math.min(10, supportCount * 2)));
  const attentionCount = Number(!primaryContact) + Number(!account.taxCode && !account.domain && !account.website) + Number(openTasksCount > 4) + Number(supportCount > 0);

  const summary = !primaryContact
    ? text(
      "Tổ chức chưa có đại diện chính. Dữ liệu thương mại vẫn được tổng hợp, nhưng hoạt động bán hàng và chăm sóc chưa có một đầu mối rõ ràng.",
      "The organization has no primary representative. Commercial data is available, but sales and service do not yet have a clear point of contact.",
    )
    : openDealsCount > 0
      ? text(
        `Tổ chức có ${openDealsCount} cơ hội đang mở với tổng giá trị ${formatOrganizationCurrency(pipelineValue)}. Quan hệ có đầu mối rõ ràng và cần duy trì nhịp hoạt động tiếp theo.`,
        `The organization has ${openDealsCount} open opportunity(s) worth ${formatOrganizationCurrency(pipelineValue)}. The relationship has a clear contact and needs a consistent next-activity cadence.`,
      )
      : orderValue > 0
        ? text(
          `Tổ chức đã có lịch sử đơn hàng ${formatOrganizationCurrency(orderValue)} nhưng chưa có cơ hội đang mở. Đây là thời điểm phù hợp để đánh giá khả năng mua lại hoặc mở rộng nhu cầu.`,
          `The organization has ${formatOrganizationCurrency(orderValue)} in order history but no open opportunity. This is a good time to assess repurchase or expansion potential.`,
        )
        : text(
          "Quan hệ đang ở giai đoạn xây dựng. Hồ sơ đã có đầu mối nhưng chưa phát sinh dữ liệu thương mại đáng kể.",
          "The relationship is still developing. A primary contact exists, but meaningful commercial activity has not started.",
        );

  let nextAction: string;
  let actionLabel: string;
  let action: "ADD_REPRESENTATIVE" | "OPEN_DEALS" | "OPEN_SUPPORT" | "OPEN_WORK" | "OPEN_PRIMARY";
  if (!primaryContact) {
    nextAction = text("Xác định một người đại diện chính để mọi hoạt động có đúng đầu mối.", "Assign a primary representative so every activity has a clear owner.");
    actionLabel = text("Thêm đại diện", "Add representative");
    action = "ADD_REPRESENTATIVE";
  } else if (supportCount > 0) {
    nextAction = text("Rà soát các phiếu hỗ trợ đang liên quan trước khi mở rộng hoạt động bán hàng.", "Review related support cases before expanding sales activity.");
    actionLabel = text("Mở hỗ trợ", "Open support");
    action = "OPEN_SUPPORT";
  } else if (openTasksCount > 0) {
    nextAction = text("Hoàn tất các công việc đang mở và ghi nhận kết quả vào hồ sơ tổ chức.", "Complete open work and record the outcome on the organization profile.");
    actionLabel = text("Mở công việc", "Open work");
    action = "OPEN_WORK";
  } else if (openDealsCount > 0) {
    nextAction = text("Duy trì bước tiếp theo cho các cơ hội đang mở và cập nhật người tham gia quyết định.", "Maintain the next step for open opportunities and update decision participants.");
    actionLabel = text("Mở cơ hội", "Open opportunities");
    action = "OPEN_DEALS";
  } else {
    nextAction = text("Trao đổi với đại diện chính để xác định nhu cầu mới hoặc khả năng mua lại.", "Contact the primary representative to identify new needs or repurchase potential.");
    actionLabel = text("Mở người đại diện", "Open representative");
    action = "OPEN_PRIMARY";
  }

  const observations = [
    primaryContact
      ? {
        title: text(`Đại diện chính: ${primaryContact.fullName || primaryContact.name}`, `Primary representative: ${primaryContact.fullName || primaryContact.name}`),
        detail: primaryContact.roleTitle || primaryContact.roleAtCompany || text("Đầu mối chính của quan hệ tổ chức.", "Primary point of contact for the organization relationship."),
        className: "border-emerald-200 bg-emerald-50/60",
      }
      : {
        title: text("Thiếu đại diện chính", "Primary representative missing"),
        detail: text("Cần xác định một người liên hệ để bán hàng, hỗ trợ và công việc dùng cùng một đầu mối.", "Assign a contact so sales, support and work share the same point of contact."),
        className: "border-rose-200 bg-rose-50/60",
      },
    supportCount > 0
      ? {
        title: text(`${supportCount} phiếu hỗ trợ cần theo dõi`, `${supportCount} support case(s) require follow-up`),
        detail: text("Tình trạng hỗ trợ có thể ảnh hưởng trực tiếp đến sức khỏe quan hệ.", "Support status may directly affect relationship health."),
        className: "border-amber-200 bg-amber-50/60",
      }
      : openDealsCount > 0
        ? {
          title: text(`${openDealsCount} cơ hội đang mở`, `${openDealsCount} open opportunity(s)`),
          detail: text(`Tổng giá trị hiện tại ${formatOrganizationCurrency(pipelineValue)}.`, `Current total value is ${formatOrganizationCurrency(pipelineValue)}.`),
          className: "border-violet-200 bg-violet-50/60",
        }
        : {
          title: text("Chưa có cơ hội đang mở", "No open opportunity"),
          detail: orderValue > 0
            ? text("Có lịch sử đơn hàng; nên đánh giá cơ hội mua lại hoặc mở rộng.", "Order history exists; assess repurchase or expansion potential.")
            : text("Tiếp tục hoàn thiện hồ sơ và xây dựng quan hệ với người đại diện.", "Continue completing the profile and building the relationship with the representative."),
          className: "border-slate-200 bg-slate-50/70",
        },
  ];

  return {
    score,
    coverage,
    attentionCount,
    summary,
    nextAction,
    actionLabel,
    action,
    observations,
    badgeClass: status === "strategic"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : status === "active"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : status === "prospect"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600",
  };
}
