import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { useWorkspaceMemberDirectory } from "@/platform/member-directory/useWorkspaceMemberDirectory";
import { Button } from "@/shared/components/ui";
import type { Customer360Projection } from "../../application/ports/CustomerApiRuntime";

export function CustomerConnectedOverview({ projection }: { projection: Customer360Projection }) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const text = (a: string, b: string) => vi ? a : b;
  const navigate = useNavigate();
  const access = useEffectiveAccess();
  const decision = useEffectiveRecordAccessDecision();
  const directory = useWorkspaceMemberDirectory();
  const { customer, identity, stakeholderContacts, healthAssessment: health } = projection;
  const readable = (key: string) => (decision?.fieldAccess[key] ?? access.getFieldAccess("customers", key)) !== "HIDDEN";
  const unavailable = text("Chưa có dữ liệu được phép", "Permitted data unavailable");
  const fields: Array<[string, string, string | number | null | undefined]> = [
    ["segment", text("Phân khúc", "Segment"), customer.segment],
    ["tier", text("Hạng khách hàng", "Tier"), customer.tier],
    ["serviceLevel", text("Mức dịch vụ", "Service level"), customer.serviceLevel],
    ["onboardingStatus", text("Tiếp nhận", "Onboarding"), customer.onboardingStatus],
    ["careCadenceDays", text("Nhịp chăm sóc (ngày)", "Care cadence (days)"), customer.careCadenceDays],
    ["nextCareAt", text("Chăm sóc tiếp theo", "Next care"), customer.nextCareAt],
    ["lastCareAt", text("Chăm sóc gần nhất", "Last care"), customer.lastCareAt],
  ];
  const owner = directory.members.find(member => member.memberId === customer.ownerId)?.displayName;
  const canOpenContact = access.can("contacts.read");
  const canOpenOrganization = access.can("organizations.read");
  return <div className="space-y-4" data-customer-connected-overview>
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label={text("Thông tin khách hàng", "Customer information")}>
      <h2 className="mb-4 text-sm font-semibold">{text("Thông tin khách hàng", "Customer information")}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">{text("Loại khách hàng", "Customer type")}</dt><dd>{customer.type}</dd></div>
        {fields.filter(([key]) => readable(key)).map(([key, label, value]) => <div key={key} className="min-w-0 [overflow-wrap:anywhere]"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm">{value ?? unavailable}</dd></div>)}
        {readable("ownerId") && <div><dt className="text-xs text-slate-500">{text("Phụ trách", "Owner")}</dt><dd>{owner || text("Chưa phân giải được người phụ trách", "Owner identity unavailable")}</dd></div>}
        {readable("tags") && <div className="min-w-0 [overflow-wrap:anywhere]"><dt className="text-xs text-slate-500">{text("Nhãn", "Tags")}</dt><dd>{customer.tags.length ? customer.tags.join(", ") : text("Không có nhãn trong phạm vi này", "No tags in this scope")}</dd></div>}
      </dl>
    </section>
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={text("Định danh và liên kết", "Identity and associations")}>
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
      <p className="text-xs text-slate-500">{text("Dữ liệu định danh được Backend kiểm tra theo quyền hồ sơ nguồn; hồ sơ đích kiểm tra quyền riêng khi mở.", "The backend checks identity against source-record access; destination records check their own access when opened.")}</p>
    </section>
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={text("Các liên hệ được phép", "Accessible stakeholders")}>
      <h2 className="text-sm font-semibold">{text("Các liên hệ được phép", "Accessible stakeholders")}</h2>
      {!canOpenContact || !stakeholderContacts.length ? <p role="status" className="text-xs">{text("Không có liên hệ được phép trong phạm vi này.", "No accessible stakeholders in this scope.")}</p> : <ul className="space-y-2">{stakeholderContacts.map(item => <li key={item.relationshipId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 text-sm [overflow-wrap:anywhere]">
        <div className="min-w-0"><p>{item.displayName}</p><p className="text-xs text-slate-500">{item.role} · {item.effectiveTo ? text("Đã kết thúc", "Ended") : text("Đang hiệu lực", "Active")}</p></div>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/contacts/${item.contactId}`)}>{text("Mở liên hệ", "Open contact")}</Button>
      </li>)}</ul>}
    </section>
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={text("Sức khỏe khách hàng", "Customer health")} data-customer-health-authority="backend">
      <h2 className="text-sm font-semibold">{text("Sức khỏe khách hàng", "Customer health")}</h2>
      {readable("health") && health ? <><dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">{text("Mức sức khỏe", "Health band")}</dt><dd>{health.healthBand === "UNKNOWN" ? text("Chưa đủ dữ liệu", "Insufficient data") : health.healthBand}</dd></div>
        <div><dt className="text-xs text-slate-500">{text("Điểm sức khỏe", "Health score")}</dt><dd>{health.score === null ? "—" : `${health.score}/100`}</dd></div>
        <div><dt className="text-xs text-slate-500">{text("Độ tin cậy", "Confidence")}</dt><dd>{health.confidence}</dd></div>
        <div><dt className="text-xs text-slate-500">{text("Số lần mua có bằng chứng", "Evidenced purchases")}</dt><dd>{health.purchaseCount}</dd></div>
      </dl><p className="text-xs text-slate-500">{health.reasonCode === "NO_PURCHASE_EVIDENCE" ? text("Chưa có bằng chứng mua hàng hiệu lực.", "No effective purchase evidence is available.") : health.reasonCode}</p></> : <p role="status">{unavailable}</p>}
    </section>
    <p role="status" className="text-xs text-slate-500">{text("Chưa có tổng hợp doanh thu, cơ hội hoặc giao dịch được xác minh cho hồ sơ này.", "Verified revenue, opportunity and transaction summaries are unavailable for this record.")}</p>
    <p className="text-[10px] text-slate-500">{text("Thời điểm tổng hợp", "Projection time")}: <time dateTime={projection.generatedAt}>{new Date(projection.generatedAt).toLocaleString(locale)}</time></p>
  </div>;
}
