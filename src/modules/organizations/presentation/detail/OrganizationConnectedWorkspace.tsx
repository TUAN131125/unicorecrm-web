import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { useWorkspaceMemberDirectory } from "@/platform/member-directory/useWorkspaceMemberDirectory";
import { useAuthoritativeResource } from "@/shared/operations";
import { Button } from "@/shared/components/ui";
import { getOrganizationOverviewResource } from "../../application/vertical-slice/organizationAuthoritativeQueries";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import { OrganizationDetailTabs, type OrganizationDetailTab } from "./OrganizationDetailTabs";
import { OrganizationRelationshipPanel } from "./OrganizationRelationshipPanel";

export function OrganizationConnectedWorkspace({ account, canEdit, onEdit, onArchive, message }: {
  account: OrganizationAccount; canEdit: boolean; onEdit(): void; onArchive?: () => void; message?: string | null;
}) {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const navigate = useNavigate();
  const access = useEffectiveAccess();
  const recordAccess = useEffectiveRecordAccessDecision();
  const allowed = (key: string) => (recordAccess?.fieldAccess[key] ?? access.getFieldAccess("organizations", key)) !== "HIDDEN";
  const directory = useWorkspaceMemberDirectory();
  const [tab, setTab] = useState<OrganizationDetailTab>("overview");
  const [visible, setVisible] = useState(true);
  const [contactLimit, setContactLimit] = useState(10);
  // The overview's separate ContactIds projection does not enforce Organization contactRefs FLS.
  // Under that restriction use the authorized detail DTO without fetching/caching these IDs.
  const overviewEnabled = allowed("contactRefs");
  const overviewResource = getOrganizationOverviewResource(account.id);
  const overview = useAuthoritativeResource(overviewResource, { enabled: overviewEnabled });
  useEffect(() => () => overviewResource.reset(), [overviewResource]);
  if (overviewEnabled && overview.loading) return <p role="status">{text("Đang tải tổng quan tổ chức…", "Loading organization overview…")}</p>;
  if (overviewEnabled && overview.error) return <section role="status"><p>{text("Không thể tải tổng quan tổ chức.", "Organization overview could not be loaded.")}</p><Button onClick={() => void overview.refresh()}>{text("Thử lại", "Retry")}</Button></section>;
  const current = overviewEnabled ? overview.data?.organization : account;
  if (!current) return <p role="status">{text("Tổng quan chưa khả dụng.", "Overview unavailable.")}</p>;
  const contactsVisible = overviewEnabled && access.can("contacts.read");
  const contactIds = contactsVisible ? [...new Set(overview.data?.contactIds ?? [])] : [];
  const owner = directory.members.find(member => member.memberId === current.ownerId)?.displayName;
  const fields: Array<[keyof OrganizationAccount, string]> = [
    ["legalName",text("Tên pháp lý","Legal name")], ["taxCode",text("Mã số thuế","Tax ID")],
    ["domain",text("Tên miền","Domain")], ["website","Website"], ["industry",text("Ngành nghề","Industry")],
    ["sizeBand",text("Quy mô","Company size")], ["employeeCount",text("Số nhân viên","Employee count")],
    ["annualRevenue",text("Doanh thu năm","Annual revenue")], ["email","Email"], ["phone",text("Điện thoại","Phone")],
    ["address",text("Địa chỉ","Address")], ["source",text("Nguồn","Source")], ["relationshipLevel",text("Mức độ quan hệ","Relationship level")],
  ];
  const info = <section aria-label={text("Hồ sơ tổ chức","Organization profile")} className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="mb-4 text-sm font-semibold">{text("Thông tin tổ chức","Organization information")}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">{fields.filter(([key]) => allowed(key) && current[key] !== undefined && current[key] !== "").map(([key,label]) => <div key={key} className="min-w-0 [overflow-wrap:anywhere]"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm">{String(current[key])}</dd></div>)}
        {allowed("ownerId") && <div><dt className="text-xs text-slate-500">{text("Phụ trách","Owner")}</dt><dd>{owner || text("Chưa phân giải được người phụ trách","Owner identity unavailable")}</dd></div>}
      </dl>
      {allowed("notes") && current.notes && <section className="mt-4 border-t border-slate-100 pt-4"><h3 className="text-xs text-slate-500">{text("Ghi chú","Notes")}</h3><p className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{current.notes}</p></section>}
    </div>
    <section aria-label={text("Liên hệ liên quan","Related contacts")} className="rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold">{text("Liên hệ được phép truy cập","Accessible contacts")}</h2>
      {!contactsVisible ? <p role="status" className="mt-2 text-xs">{text("Quan hệ liên hệ chưa khả dụng với quyền hiện tại.","Contact relationships are unavailable for the current policy.")}</p> : <>
        <p className="my-2 text-xs text-slate-500">{contactIds.length} {text("liên hệ trong phạm vi đọc hiện tại","contacts in the current read scope")}</p>
        {!contactIds.length && <p role="status" className="text-xs">{text("Không có liên hệ được phép trong phạm vi này.","No accessible contacts in this scope.")}</p>}
        <ul className="space-y-2">{contactIds.slice(0,contactLimit).map((id,index) => <li key={id}><Button variant="secondary" size="sm" onClick={() => navigate(`/contacts/${id}`)}>{text("Mở liên hệ","Open contact")} {index+1}</Button></li>)}</ul>
        {contactIds.length > contactLimit && <Button onClick={() => setContactLimit(value => value+10)}>{text("Xem thêm liên hệ","Show more contacts")}</Button>}
        <p className="mt-2 text-[10px] text-slate-500">{text("Tên và thông tin cá nhân được kiểm tra tại hồ sơ Contact; quyền Organization không cấp quyền Contact.","Names and personal details are checked on the Contact record; Organization access does not grant Contact access.")}</p>
      </>}
    </section>
    <p role="status" className="text-xs text-slate-500">{text("Chưa có tổng hợp Leads, doanh số hoặc giao dịch được xác minh cho tổ chức này.","Verified Leads, sales and transaction summaries are unavailable for this Organization.")}</p>
  </section>;
  return <div data-organization-connected-workspace data-guidance-id="organizations.detail.workspace" className="min-w-0 space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div className="min-w-0"><h1 className="text-lg font-semibold [overflow-wrap:anywhere]">{current.displayName}</h1><p className="text-xs text-slate-500">{current.status ? ({ active:text("Đang hoạt động","Active"), prospect:text("Tiềm năng","Prospect"), strategic:text("Chiến lược","Strategic"), inactive:text("Ngừng hoạt động","Inactive"), archived:text("Lưu trữ","Archived") })[current.status] : text("Trạng thái chưa khả dụng","Status unavailable")}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => navigate("/organizations")}>{text("Danh sách tổ chức","Organization list")}</Button>{canEdit && current.status !== "archived" && <Button onClick={onEdit}>{text("Chỉnh sửa","Edit")}</Button>}{onArchive && <Button variant="secondary" onClick={onArchive}>{text("Lưu trữ","Archive")}</Button>}</div></header>
    {message && <p role="status" className="text-xs">{message}</p>}
    <div className="flex min-w-0 flex-col items-start gap-3 xl:flex-row">
      <main className="w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white">
        <OrganizationDetailTabs activeTab={tab} onChange={setTab} counts={{}} isRightPanelVisible={visible} onToggleRightPanel={() => setVisible(value => !value)}/>
        <div className="p-4 sm:p-5">{tab === "overview" || tab === "relationship" ? info : tab === "work" ? <div className="space-y-3"><p>{text("Xem Công việc và Lịch sử trong bảng quan hệ.","Use Work and History in the relationship panel.")}</p><Button onClick={() => setVisible(true)}>{text("Hiện bảng quan hệ","Show relationship panel")}</Button></div> : <p role="status">{text("Chưa có dữ liệu liên kết được xác minh cho mục này.","A verified related-data projection is unavailable for this section.")}</p>}</div>
      </main>
      <OrganizationRelationshipPanel recordId={current.id} status={current.status} visible={visible}/>
    </div>
  </div>;
}
