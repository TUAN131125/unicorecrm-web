import React from "react";
import { ArrowUpRight, Building2, UserRoundCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { getContactStatusLabel } from "../../list/contactList.helpers";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui";
import type { Contact } from "../../../domain/model/contact.types";
import type { ContactTab } from "../ContactDetailTabs";
import { useContactOverview } from "../../hooks/useContactOverview";

interface ContactOverviewTabProps {
  contact: Contact;
  locale: "vi" | "en";
  onSelectTab(tab: ContactTab, subTab?: string): void;
}

export const ContactOverviewTab: React.FC<ContactOverviewTabProps> = ({ contact, locale, onSelectTab }) => {
  const model = useContactOverview(contact);
  const { t } = useI18n();
  const navigate = useNavigate();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const unavailable = model.query.error?.category === "AUTHORIZATION" ? text("Không có quyền đọc các quan hệ.", "Relationship access denied.")
    : model.query.loading ? text("Đang tải quan hệ…", "Loading relationships…")
    : model.query.stale ? text("Quan hệ có thể chưa mới nhất.", "Relationships may be out of date.")
    : model.query.error ? text("Không thể tải quan hệ.", "Could not load relationships.") : "";
  const profile = model.profile.filter(item => item.value?.trim());
  const hasLinks = model.organizations.length > 0 || model.customers.length > 0;
  const relationshipSummary = !model.ready ? undefined : hasLinks
    ? text("Quan hệ đã được thiết lập", "Relationships established")
    : model.canReadOrganizations || model.canReadCustomers
      ? text("Chưa có hồ sơ liên kết hiển thị", "No linked profiles to display")
      : text("Thông tin liên kết chưa khả dụng", "Connection information unavailable");
  const roleLabel = (role: string) => {
    const roles: Record<string, [string, string]> = {
      employee:["Nhân viên","Employee"], executive:["Lãnh đạo","Executive"], decision_maker:["Người quyết định","Decision maker"], buyer:["Người mua","Buyer"], finance:["Tài chính","Finance"], technical:["Kỹ thuật","Technical"], advisor:["Cố vấn","Advisor"], partner:["Đối tác","Partner"], other:["Khác","Other"], primary_contact:["Liên hệ chính","Primary contact"], billing:["Thanh toán","Billing"], end_user:["Người sử dụng","End user"], support:["Hỗ trợ","Support"],
    };
    const label = roles[role]; return label ? text(label[0],label[1]) : role;
  };
  return <div data-guidance-id="contacts.overview" data-contact-overview="relationship" data-i18n-skip="true" className="space-y-4">
    <section aria-labelledby="contact-relationship-status" className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <h2 id="contact-relationship-status" className="text-sm font-semibold text-slate-800">{text("Tình trạng quan hệ", "Relationship status")}</h2>
      {relationshipSummary && <p className="mt-2 text-sm font-semibold text-slate-800">{relationshipSummary}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>{model.status ? getContactStatusLabel(model.status, t) : text("Trạng thái chưa khả dụng", "Status unavailable")}</span>
        {model.ready && model.canReadOrganizations && <span>{model.organizations.length} {text("tổ chức liên kết", "organization connections")}</span>}
        {model.ready && model.canReadCustomers && <span>{model.customers.length} {text("hồ sơ khách hàng", "customer profiles")}</span>}
      </div>
      {unavailable && <p className="mt-2 text-xs text-slate-600" role="status">{unavailable}</p>}
      {model.query.error && model.query.error.category !== "AUTHORIZATION" && <Button size="xs" className="mt-2" onClick={() => void model.query.refresh()}>{text("Thử lại", "Retry")}</Button>}
    </section>
    <section aria-label={text("Các chỉ số quan trọng", "Important metrics")} className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),16rem))]">
      <button type="button" disabled={!model.canOpenTasks} onClick={() => onSelectTab("work", "tasks")} className="min-h-20 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/20 focus-visible:outline focus-visible:outline-indigo-600 disabled:cursor-default">
        <span className="block text-xs text-slate-500">{text("Công việc đang mở", "Open tasks")}</span><span className="mt-2 block text-lg font-semibold">{model.taskCount ?? "—"}</span>
        {model.taskCount === undefined && <span className="text-[10px] text-slate-500">{text("Chưa có tổng số đáng tin cậy trong phạm vi hiện tại.", "A reliable total is not available in the current scope.")}</span>}
      </button>
    </section>
    <section className="grid min-w-0 items-start gap-3 lg:grid-cols-2" aria-label={text("Hồ sơ và quan hệ", "Profile and relationships")}>
      <article className="min-w-0 rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold">{text("Hồ sơ nghề nghiệp", "Professional profile")}</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">{profile.map(item => <div key={item.key} className="min-w-0"><dt className="text-[10px] text-slate-500">{text(item.vi,item.en)}</dt><dd className="mt-1 crm-text-wrap text-xs">{item.value}</dd></div>)}</dl>
        {!profile.length && <p className="mt-2 text-xs leading-5 text-slate-500">{text("Chưa có thông tin nghề nghiệp để hiển thị.", "No professional details to display.")}</p>}
        <Button size="xs" variant="secondary" className="mt-3" onClick={() => onSelectTab("relationship", "profile")}>{text("Xem hồ sơ đầy đủ", "Open full profile")}</Button>
      </article>
      <article className="min-w-0 rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold">{text("Tổ chức liên kết", "Organization connections")}</h3>
        {!model.canReadOrganizations ? <p role="status" className="mt-2 text-xs text-slate-500">{text("Quan hệ tổ chức chưa khả dụng với quyền hiện tại.", "Organization relationships unavailable with current access.")}</p> : model.ready && !model.organizations.length ? <p className="mt-2 text-xs text-slate-500">{text("Chưa có liên kết tổ chức hiển thị trong phạm vi hiện tại.", "No organization link is visible in the current scope.")}</p> : null}
        {!model.ready && unavailable && model.canReadOrganizations && <p role="status" className="mt-2 text-xs text-slate-500">{unavailable}</p>}
        <ul className="mt-2 space-y-2">{model.organizations.slice(0,3).map(item => <li key={item.id} className="text-xs [overflow-wrap:anywhere]"><button type="button" className="inline-flex min-h-9 max-w-full items-center gap-2 rounded text-left font-semibold text-indigo-700 hover:underline focus-visible:outline focus-visible:outline-indigo-600" onClick={() => navigate(`/organizations/${item.organizationAccountId}`)}><Building2 size={14} className="shrink-0" aria-hidden="true"/><span className="min-w-0 break-words [overflow-wrap:anywhere]">{item.organizationLabel || item.organizationAccountId}</span><ArrowUpRight size={13} className="shrink-0" aria-hidden="true"/></button><p className="mt-1 text-slate-500">{item.roleTitle || roleLabel(item.role)}{item.isPrimaryAffiliation ? text(" · Quan hệ chính", " · Primary affiliation") : ""}</p></li>)}</ul>
        {model.organizations.length > 3 && <Button size="xs" variant="secondary" className="mt-2" onClick={() => onSelectTab("relationship","people")}>{text("Xem tất cả", "View all")}</Button>}
      </article>
      <article className="min-w-0 rounded-xl border border-slate-200 p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold">{text("Liên kết hồ sơ khách hàng", "Customer profile links")}</h3>
        {!model.canReadCustomers ? <p role="status" className="mt-2 text-xs text-slate-500">{text("Hồ sơ khách hàng chưa khả dụng với quyền hiện tại.", "Customer profiles unavailable with current access.")}</p> : model.ready && !model.customers.length ? <p className="mt-2 text-xs text-slate-500">{text("Chưa liên kết hồ sơ khách hàng trong phạm vi hiển thị.", "No customer profile linked in the visible scope.")}</p> : null}
        {!model.ready && unavailable && model.canReadCustomers && <p role="status" className="mt-2 text-xs text-slate-500">{unavailable}</p>}
        <ul className="mt-2 space-y-2">{model.customers.slice(0,3).map(item => <li key={item.id} className="text-xs [overflow-wrap:anywhere]"><button type="button" className="inline-flex min-h-9 max-w-full items-center gap-2 rounded text-left font-semibold text-indigo-700 hover:underline focus-visible:outline focus-visible:outline-indigo-600" onClick={() => navigate(`/customers/${item.customerId}`)}><UserRoundCheck size={14} className="shrink-0" aria-hidden="true"/><span className="min-w-0 break-words [overflow-wrap:anywhere]">{item.customerLabel || item.customerId}</span><ArrowUpRight size={13} className="shrink-0" aria-hidden="true"/></button><p className="text-slate-500">{roleLabel(item.role)}</p></li>)}</ul>
        <Button size="xs" variant="secondary" className="mt-3" onClick={() => onSelectTab("relationship","people")}>{text("Xem các quan hệ", "Review relationships")}</Button>
      </article>
    </section>
    <section aria-label={text("Bối cảnh kinh doanh và dịch vụ", "Business and service context")} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
      {text("Chưa có tổng hợp kinh doanh và dịch vụ đáng tin cậy cho liên hệ này. Xem các tab nghiệp vụ để kiểm tra bản ghi liên quan trong phạm vi được phép.", "A reliable business and service summary is unavailable for this contact. Review the business tabs for related records within your access.")}
    </section>
  </div>;
};
