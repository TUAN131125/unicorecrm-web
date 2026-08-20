import React from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button, Input, Select } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { useAuditTrail, type AuditJsonValue, type AuditTrailEntry } from "@/platform/audit";

const activityGroups = ["ALL", "MEMBERS", "INVITATIONS", "ROLES", "PERMISSIONS"] as const;
type ActivityGroup = (typeof activityGroups)[number];

const actionCatalog: Record<string, { group: Exclude<ActivityGroup, "ALL">; vi: string; en: string }> = {
  MemberInvitationCreated: { group: "INVITATIONS", vi: "Đã mời thành viên", en: "Member invited" },
  MemberInvitationResent: { group: "INVITATIONS", vi: "Đã gửi lại lời mời", en: "Invitation resent" },
  MemberInvitationRevoked: { group: "INVITATIONS", vi: "Đã thu hồi lời mời", en: "Invitation revoked" },
  WorkspaceMemberAdded: { group: "MEMBERS", vi: "Đã thêm thành viên", en: "Member added" },
  WorkspaceMemberSuspended: { group: "MEMBERS", vi: "Đã tạm khóa thành viên", en: "Member suspended" },
  WorkspaceMemberReactivated: { group: "MEMBERS", vi: "Đã kích hoạt lại thành viên", en: "Member reactivated" },
  MemberAccessChanged: { group: "MEMBERS", vi: "Đã thay đổi quyền truy cập thành viên", en: "Member access changed" },
  MemberRolesChanged: { group: "MEMBERS", vi: "Đã thay đổi vai trò thành viên", en: "Member roles changed" },
  MemberPasswordReset: { group: "MEMBERS", vi: "Đã đặt lại mật khẩu thành viên", en: "Member password reset" },
  RoleCreated: { group: "ROLES", vi: "Đã tạo vai trò", en: "Role created" },
  RoleDuplicated: { group: "ROLES", vi: "Đã nhân bản vai trò", en: "Role duplicated" },
  RoleDeleted: { group: "ROLES", vi: "Đã xóa vai trò", en: "Role deleted" },
  RoleUpdated: { group: "ROLES", vi: "Đã cập nhật vai trò", en: "Role updated" },
  RolePermissionsChanged: { group: "PERMISSIONS", vi: "Đã thay đổi quyền của vai trò", en: "Role permissions changed" },
  RoleDataScopeChanged: { group: "PERMISSIONS", vi: "Đã thay đổi phạm vi dữ liệu", en: "Data scope changed" },
  RoleFieldAccessChanged: { group: "PERMISSIONS", vi: "Đã thay đổi quyền truy cập trường", en: "Field access changed" },
  AccessConfigurationReplaced: { group: "PERMISSIONS", vi: "Đã thay thế cấu hình truy cập", en: "Access configuration replaced" },
};

export const PeopleActivityLog: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const text = (viText: string, enText: string) => (vi ? viText : enText);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query.trim());
  const [group, setGroup] = React.useState<ActivityGroup>("ALL");
  const audit = useAuditTrail({ resourceKey: "access-control", search: deferredQuery || undefined, limit: 200 });

  const items = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
    return (audit.data?.items ?? []).filter((entry) => {
      const catalog = actionCatalog[entry.action];
      if (group !== "ALL" && catalog?.group !== group) return false;
      if (!normalizedQuery) return true;
      return [
        catalog ? (vi ? catalog.vi : catalog.en) : entry.action,
        entry.actor.displayName,
        entry.actor.id,
        subjectLabel(entry),
        changeSummary(entry, vi),
        JSON.stringify(entry.before ?? ""),
        JSON.stringify(entry.after ?? ""),
      ].filter(Boolean).join(" ").toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US").includes(normalizedQuery);
    });
  }, [audit.data?.items, group, locale, query, vi]);

  return (
    <div className="space-y-4" data-people-activity-log>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <Input
            label={text("Tìm trong nhật ký", "Search activity log")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text("Tên thành viên, vai trò, quyền hoặc người thực hiện", "Member, role, permission, or actor")}
          />
        </div>
        <div className="w-full lg:w-[260px]">
          <Select label={text("Loại thay đổi", "Change type")} value={group} onChange={(event) => setGroup(event.target.value as ActivityGroup)}>
            <option value="ALL">{text("Tất cả thay đổi", "All changes")}</option>
            <option value="MEMBERS">{text("Thành viên", "Members")}</option>
            <option value="INVITATIONS">{text("Lời mời", "Invitations")}</option>
            <option value="ROLES">{text("Vai trò", "Roles")}</option>
            <option value="PERMISSIONS">{text("Quyền và phạm vi", "Permissions and scopes")}</option>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" icon={<RefreshCw size={14} />} loading={audit.refreshing} onClick={() => void audit.refresh()}>
            {text("Làm mới", "Refresh")}
          </Button>
          <Button type="button" variant="secondary" size="sm" icon={<Download size={14} />} disabled={items.length === 0} onClick={() => exportCsv(items, locale)}>
            {text("Xuất CSV dữ liệu đã tải", "Export loaded CSV")}
          </Button>
        </div>
      </div>

      {audit.stale ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 leading-5 text-amber-900" role="status">
          {text("Đang hiển thị dữ liệu gần nhất vì lần làm mới vừa rồi không thành công.", "Showing the latest available data because the last refresh failed.")}
        </div>
      ) : null}

      {audit.loading && !audit.data ? <ActivityState text={text("Đang tải nhật ký hoạt động…", "Loading activity log…")} /> : null}
      {audit.error && !audit.data ? (
        <ActivityState
          text={text("Không thể tải nhật ký hoạt động.", "Activity log could not be loaded.")}
          action={<Button type="button" variant="secondary" size="sm" onClick={() => void audit.refresh()}>{text("Thử lại", "Retry")}</Button>}
        />
      ) : null}
      {!audit.loading && !audit.error && items.length === 0 ? (
        <ActivityState text={text("Chưa có thay đổi phù hợp. Các thao tác thêm thành viên, đổi vai trò, cấp hoặc thu hồi quyền sẽ xuất hiện tại đây.", "No matching changes yet. Member, role, and permission changes will appear here.")} />
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-[170px_minmax(220px,1fr)_minmax(190px,0.8fr)_minmax(180px,0.7fr)_auto] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-slate-500 lg:grid">
            <span>{text("Thời gian", "Time")}</span>
            <span>{text("Hoạt động", "Activity")}</span>
            <span>{text("Đối tượng", "Subject")}</span>
            <span>{text("Người thực hiện", "Actor")}</span>
            <span>{text("Chi tiết", "Details")}</span>
          </div>
          {items.map((entry) => <ActivityRow key={entry.id} entry={entry} vi={vi} locale={locale} />)}
        </div>
      ) : null}
      {audit.data?.nextCursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" size="sm" loading={audit.loadingMore} onClick={() => void audit.loadMore()}>
            {text("Tải thêm thay đổi", "Load more changes")}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const ActivityRow: React.FC<{ entry: AuditTrailEntry; vi: boolean; locale: "vi" | "en" }> = ({ entry, vi, locale }) => {
  const catalog = actionCatalog[entry.action];
  const actionLabel = catalog ? (vi ? catalog.vi : catalog.en) : entry.action;
  const summary = changeSummary(entry, vi);
  const hasDetails = entry.before !== undefined || entry.after !== undefined;
  return (
    <div className="border-b border-slate-100 px-4 py-4 last:border-b-0" data-activity-action={entry.action}>
      <div className="grid gap-3 lg:grid-cols-[170px_minmax(220px,1fr)_minmax(190px,0.8fr)_minmax(180px,0.7fr)_auto] lg:items-start lg:gap-4">
        <div className="text-slate-500">
          <span className="mr-2 text-slate-400 lg:hidden">{vi ? "Thời gian:" : "Time:"}</span>
          {new Date(entry.occurredAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-950">{actionLabel}</div>
          {summary ? <div className="mt-1 break-words leading-5 text-slate-500">{summary}</div> : null}
        </div>
        <div className="min-w-0 break-words text-slate-700">
          <span className="mr-2 text-slate-400 lg:hidden">{vi ? "Đối tượng:" : "Subject:"}</span>
          {subjectLabel(entry) || "—"}
        </div>
        <div className="min-w-0 break-words text-slate-700">
          <span className="mr-2 text-slate-400 lg:hidden">{vi ? "Người thực hiện:" : "Actor:"}</span>
          {entry.actor.displayName ?? entry.actor.id}
        </div>
        <div>
          {hasDetails ? (
            <details className="group">
              <summary className="cursor-pointer list-none text-violet-700 hover:text-violet-800">
                {vi ? "Xem thay đổi" : "View changes"}
              </summary>
              <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 lg:col-span-5 lg:grid-cols-2">
                <ChangePanel title={vi ? "Trước" : "Before"} value={entry.before} />
                <ChangePanel title={vi ? "Sau" : "After"} value={entry.after} />
              </div>
            </details>
          ) : <span className="text-slate-400">—</span>}
        </div>
      </div>
    </div>
  );
};

const ActivityState: React.FC<{ text: string; action?: React.ReactNode }> = ({ text, action }) => (
  <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
    <p className="max-w-2xl leading-6">{text}</p>
    {action}
  </div>
);

const ChangePanel: React.FC<{ title: string; value: AuditJsonValue | undefined }> = ({ title, value }) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="mb-2 text-slate-500">{title}</div>
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">{value === undefined ? "—" : JSON.stringify(value, null, 2)}</pre>
  </div>
);

function payloadRecord(value: AuditJsonValue | undefined): Record<string, AuditJsonValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, AuditJsonValue> : undefined;
}

function subjectLabel(entry: AuditTrailEntry): string {
  const after = payloadRecord(entry.after);
  const before = payloadRecord(entry.before);
  const source = after ?? before;
  if (!source) return entry.recordId ?? "";
  for (const key of ["displayName", "email", "roleName", "name", "fieldKey", "resourceKey", "membershipId", "invitationId", "roleId", "accountId"]) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return entry.recordId ?? "";
}

function changeSummary(entry: AuditTrailEntry, vi: boolean): string {
  const before = payloadRecord(entry.before);
  const after = payloadRecord(entry.after);
  if (entry.action === "RolePermissionsChanged") {
    const previous = stringSet(before?.capabilities);
    const next = stringSet(after?.capabilities);
    const granted = [...next].filter((value) => !previous.has(value));
    const revoked = [...previous].filter((value) => !next.has(value));
    const parts = [
      granted.length ? (vi ? `Cấp ${granted.length} quyền` : `${granted.length} permission(s) granted`) : "",
      revoked.length ? (vi ? `Thu hồi ${revoked.length} quyền` : `${revoked.length} permission(s) revoked`) : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (entry.action === "MemberAccessChanged" || entry.action === "MemberRolesChanged") {
    const previousRoles = roleNames(before?.roles ?? before?.roleIds);
    const nextRoles = roleNames(after?.roles ?? after?.roleIds);
    if (previousRoles !== nextRoles) return vi ? `Vai trò: ${previousRoles || "—"} → ${nextRoles || "—"}` : `Roles: ${previousRoles || "—"} → ${nextRoles || "—"}`;
  }
  if (entry.action === "WorkspaceMemberSuspended") return vi ? "Quyền truy cập workspace đã bị tạm khóa." : "Workspace access was suspended.";
  if (entry.action === "WorkspaceMemberReactivated") return vi ? "Quyền truy cập workspace đã được kích hoạt lại." : "Workspace access was reactivated.";
  if (entry.action === "MemberInvitationCreated") return vi ? "Lời mời thành viên mới đã được tạo." : "A new member invitation was created.";
  if (entry.action === "WorkspaceMemberAdded") return vi ? "Tài khoản thành viên đã được thêm vào workspace." : "A member account was added to the workspace.";
  if (entry.action === "RoleDataScopeChanged") return vi ? "Phạm vi dữ liệu của vai trò đã thay đổi." : "The role data scope changed.";
  if (entry.action === "RoleFieldAccessChanged") return vi ? "Quyền xem hoặc chỉnh sửa trường đã thay đổi." : "Field read or edit access changed.";
  return entry.summary ?? "";
}

function stringSet(value: AuditJsonValue | undefined): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
}

function roleNames(value: AuditJsonValue | undefined): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, AuditJsonValue>;
      return typeof record.roleName === "string" ? record.roleName : typeof record.roleId === "string" ? record.roleId : "";
    }
    return "";
  }).filter(Boolean).join(", ");
}

function exportCsv(items: readonly AuditTrailEntry[], locale: "vi" | "en"): void {
  const vi = locale === "vi";
  const header = [vi ? "Thời gian" : "Time", vi ? "Hoạt động" : "Activity", vi ? "Đối tượng" : "Subject", vi ? "Người thực hiện" : "Actor", vi ? "Chi tiết" : "Details"].join(",");
  const rows = items.map((entry) => {
    const catalog = actionCatalog[entry.action];
    return [
      entry.occurredAt,
      catalog ? (vi ? catalog.vi : catalog.en) : entry.action,
      subjectLabel(entry),
      entry.actor.displayName ?? entry.actor.id,
      changeSummary(entry, vi),
    ].map(csvCell).join(",");
  });
  const url = URL.createObjectURL(new Blob([`\uFEFF${[header, ...rows].join("\n")}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `unicorecrm-people-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}
