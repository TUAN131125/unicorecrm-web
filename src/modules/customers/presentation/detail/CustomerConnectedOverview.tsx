import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { useWorkspaceMemberDirectory } from "@/platform/member-directory/useWorkspaceMemberDirectory";
import { Button } from "@/shared/components/ui";
import type { Customer360Projection } from "../../application/ports/CustomerApiRuntime";
import { CustomerHealthBadge } from "../components/CustomerStatusBadge";
import { customerBusinessTags, customerPresentationLabel } from "../model/customerPresentationLabels";

export function CustomerConnectedOverview({ projection, view = "overview" }: { projection: Customer360Projection; view?: "overview" | "relationship" }) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const text = (a: string, b: string) => vi ? a : b;
  const navigate = useNavigate();
  const access = useEffectiveAccess();
  const decision = useEffectiveRecordAccessDecision();
  const directory = useWorkspaceMemberDirectory();
  const { customer, identity, stakeholderContacts, healthAssessment: health } = projection;
  const readable = (key: string) => (decision?.fieldAccess[key] ?? access.getFieldAccess("customers", key)) !== "HIDDEN";
  const unavailable = "—";
  const fields: Array<[string, string, string | number | null | undefined]> = [
    ["segment", text("Phân khúc", "Segment"), customer.segment],
    ["tier", text("Hạng khách hàng", "Tier"), customer.tier],
    ["serviceLevel", text("Mức dịch vụ", "Service level"), customer.serviceLevel],
    ["onboardingStatus", text("Tiếp nhận", "Onboarding"), customer.onboardingStatus],
    ["careCadenceDays", text("Nhịp chăm sóc (ngày)", "Care cadence (days)"), customer.careCadenceDays],
    ["nextCareAt", text("Chăm sóc tiếp theo", "Next care"), customer.nextCareAt],
    ["lastCareAt", text("Chăm sóc gần nhất", "Last care"), customer.lastCareAt],
  ];
  const owner = (decision?.fieldAccess.ownerId ?? access.getFieldAccess("customers", "ownerId")) === "MASKED" ? undefined : directory.members.find(member => member.memberId === customer.ownerId)?.displayName;
  const canOpenContact = access.can("contacts.read");
  const canOpenOrganization = access.can("organizations.read");
  return <div className="space-y-4" data-customer-connected-overview>
    {view === "overview" && <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label={text("Thông tin khách hàng", "Customer information")}>
      <h2 className="mb-4 text-sm font-semibold">{text("Thông tin khách hàng", "Customer information")}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">{text("Loại khách hàng", "Customer type")}</dt><dd>{customerPresentationLabel(customer.type, vi)}</dd></div>
        {fields.filter(([key]) => readable(key)).map(([key, label, value]) => <div key={key} className="min-w-0 [overflow-wrap:anywhere]"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-xs">{value === null || value === undefined ? unavailable : (decision?.fieldAccess[key] ?? access.getFieldAccess("customers", key)) === "MASKED" ? "—" : key === "nextCareAt" || key === "lastCareAt" ? new Date(String(value)).toLocaleDateString(locale) : customerPresentationLabel(value, vi)}</dd></div>)}
        {readable("ownerId") && <div><dt className="text-xs text-slate-500">{text("Phụ trách", "Owner")}</dt><dd>{owner || unavailable}</dd></div>}
        {readable("tags") && customerBusinessTags(customer.tags).length > 0 && <div className="min-w-0 [overflow-wrap:anywhere]"><dt className="text-xs text-slate-500">{text("Nhãn", "Tags")}</dt><dd>{(decision?.fieldAccess.tags ?? access.getFieldAccess("customers", "tags")) === "MASKED" ? "—" : customerBusinessTags(customer.tags).join(", ")}</dd></div>}
      </dl>
    </section>}
    {view === "relationship" && <><section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={text("Định danh và liên kết", "Identity and associations")}>
      <h2 className="text-sm font-semibold">{text("Định danh và liên kết", "Identity and associations")}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 [overflow-wrap:anywhere]"><dt className="text-xs text-slate-500">{text("Tên hiển thị", "Display name")}</dt><dd>{identity.displayName}</dd></div>
        {identity.email && <div className="min-w-0 [overflow-wrap:anywhere]"><dt className="text-xs text-slate-500">Email</dt><dd>{identity.email}</dd></div>}
        {identity.phone && <div><dt className="text-xs text-slate-500">{text("Điện thoại", "Phone")}</dt><dd>{identity.phone}</dd></div>}
      </dl>
      <div className="flex flex-wrap gap-2">
        {identity.contactId && canOpenContact && <Button variant="secondary" onClick={() => navigate(`/contacts/${identity.contactId}`)}>{text("Mở hồ sơ Contact", "Open Contact record")}</Button>}
        {identity.organizationId && canOpenOrganization && <Button variant="secondary" onClick={() => navigate(`/organizations/${identity.organizationId}`)}>{text("Mở hồ sơ Organization", "Open Organization record")}</Button>}
        {identity.primaryContactId && canOpenContact && <Button variant="secondary" onClick={() => navigate(`/contacts/${identity.primaryContactId}`)}>{text("Mở liên hệ chính", "Open primary contact")}</Button>}
      </div>
    </section>
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={text("Liên hệ", "Contacts")}>
      <h2 className="text-sm font-semibold">{text("Liên hệ", "Contacts")}</h2>
      {!canOpenContact || !stakeholderContacts.length ? <p role="status" className="text-xs">{text("Không có thông tin để hiển thị.", "No information to display.")}</p> : <ul className="space-y-2">{stakeholderContacts.map(item => <li key={item.relationshipId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 text-sm [overflow-wrap:anywhere]">
        <div className="min-w-0"><p>{item.displayName}</p><p className="text-xs text-slate-500">{customerPresentationLabel(item.role, vi)} · {item.effectiveTo ? text("Đã kết thúc", "Ended") : text("Đang hiệu lực", "Active")}</p></div>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/contacts/${item.contactId}`)}>{text("Mở liên hệ", "Open contact")}</Button>
      </li>)}</ul>}
    </section></>}
    {view === "overview" && <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={text("Sức khỏe khách hàng", "Customer health")} data-customer-health-authority="backend">
      <h2 className="text-sm font-semibold">{text("Sức khỏe khách hàng", "Customer health")}</h2>
      {readable("health") && (decision?.fieldAccess.health ?? access.getFieldAccess("customers", "health")) !== "MASKED" && health ? <><dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">{text("Mức sức khỏe", "Health band")}</dt><dd><CustomerHealthBadge health={health.healthBand} locale={vi ? "vi" : "en"} /></dd></div>
        <div><dt className="text-xs text-slate-500">{text("Điểm sức khỏe", "Health score")}</dt><dd>{health.score === null ? "—" : `${health.score}/100`}</dd></div>
        <div><dt className="text-xs text-slate-500">{text("Độ tin cậy", "Confidence")}</dt><dd>{customerPresentationLabel(health.confidence, vi)}</dd></div>
        <div><dt className="text-xs text-slate-500">{text("Số lần mua có bằng chứng", "Evidenced purchases")}</dt><dd>{health.purchaseCount}</dd></div>
      </dl><p className="text-xs text-slate-500">{health.reasonCode === "NO_PURCHASE_EVIDENCE" ? text("Chưa có bằng chứng mua hàng hiệu lực.", "No effective purchase evidence is available.") : text("Dựa trên lịch sử mua hàng.", "Based on purchase history.")}</p></> : <p role="status">{unavailable}</p>}
    </section>}
  </div>;
}
