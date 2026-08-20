import React, { useMemo } from "react";
import {
  CheckCircle2,
  KeyRound,
  MailPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/components/ui";
import type { RoleAssignment, RoleDefinition } from "@/platform/access-control";
import type { WorkspaceMemberDirectoryEntry } from "@/platform/member-directory";
import type { WorkspaceInvitationRecord, WorkspaceMembership } from "@/platform/workspace-membership";

export type MemberDirectoryFilter = "all" | "active" | "invited" | "suspended" | "accounts";

interface MemberDirectoryViewProps {
  vi: boolean;
  search: string;
  onSearch(value: string): void;
  filter: MemberDirectoryFilter;
  onFilter(value: MemberDirectoryFilter): void;
  members: WorkspaceMembership[];
  memberDetails: Map<string | undefined, WorkspaceMemberDirectoryEntry>;
  roles: RoleDefinition[];
  assignments: RoleAssignment[];
  invitations: WorkspaceInvitationRecord[];
  canConfigure: boolean;
  currentMembershipId: string;
  onManage(membershipId: string): void;
  onStatusChange(membershipId: string, status: "active" | "suspended"): void;
  onResend(invitationId: string): void;
  onRevoke(invitationId: string): void;
  onRotatePassword(accountId: string): void;
}

const filterItems: Array<{ key: MemberDirectoryFilter; vi: string; en: string }> = [
  { key: "all", vi: "Tất cả", en: "All" },
  { key: "active", vi: "Đang hoạt động", en: "Active" },
  { key: "accounts", vi: "Có tài khoản", en: "Accounts" },
  { key: "invited", vi: "Đang chờ", en: "Pending" },
  { key: "suspended", vi: "Tạm khóa", en: "Suspended" },
];

export const MemberDirectoryView: React.FC<MemberDirectoryViewProps> = ({
  vi,
  search,
  onSearch,
  filter,
  onFilter,
  members,
  memberDetails,
  roles,
  assignments,
  invitations,
  canConfigure,
  currentMembershipId,
  onManage,
  onStatusChange,
  onResend,
  onRevoke,
  onRotatePassword,
}) => {
  const text = (viText: string, enText: string) => vi ? viText : enText;
  const roleMap = useMemo(() => new Map(roles.map((role) => [role.roleId, role])), [roles]);
  const activeCount = members.filter((item) => item.status === "active").length;
  const pendingCount = invitations.filter((item) => item.status === "PENDING").length;
  const directAccountCount = members.filter((item) => memberDetails.get(item.membershipId)?.accountSource === "direct").length;
  const filteredMembers = members.filter((membership) => {
    const detail = memberDetails.get(membership.membershipId);
    const haystack = `${detail?.displayName || ""} ${detail?.email || ""} ${membership.memberId || ""}`.toLowerCase();
    if (!haystack.includes(search.trim().toLowerCase())) return false;
    if (filter === "all") return true;
    if (filter === "accounts") return Boolean(membership.accountId);
    return membership.status === filter;
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Users size={17} />} label={text("Tổng thành viên", "Total members")} value={members.length} helper={text("Bao gồm lời mời đang chờ", "Including pending invitations")} />
        <Metric icon={<UserCheck size={17} />} label={text("Đang hoạt động", "Active members")} value={activeCount} helper={text("Có thể truy cập workspace", "Can access this workspace")} />
        <Metric icon={<KeyRound size={17} />} label={text("Tài khoản cấp trực tiếp", "Direct accounts")} value={directAccountCount} helper={text("Đăng nhập ngay bằng mật khẩu khởi tạo", "Can sign in with an initial password")} />
        <Metric icon={<MailPlus size={17} />} label={text("Lời mời đang chờ", "Pending invitations")} value={pendingCount} helper={text("Có hiệu lực trong 7 ngày", "Valid for seven days")} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <div className="space-y-3 border-b border-slate-100 p-4 lg:flex lg:items-center lg:justify-between lg:space-y-0">
          <label className="relative block min-w-0 flex-1 lg:max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={text("Tìm theo tên, email hoặc mã thành viên", "Search name, email, or member ID")}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70"
            />
          </label>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
            {filterItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onFilter(item.key)}
                className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold transition ${filter === item.key ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
              >
                {vi ? item.vi : item.en}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full text-left">
            <thead className="bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5">{text("Nhân sự", "Employee")}</th>
                <th className="px-4 py-3.5">{text("Truy cập", "Access")}</th>
                <th className="px-4 py-3.5">{text("Vai trò hiệu lực", "Effective roles")}</th>
                <th className="px-4 py-3.5">{text("Nhóm", "Team")}</th>
                <th className="px-5 py-3.5 text-right">{text("Thao tác", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((membership) => {
                const detail = memberDetails.get(membership.membershipId);
                const invitation = invitations.find((item) => item.membershipId === membership.membershipId && item.status === "PENDING");
                const isSelf = membership.membershipId === currentMembershipId;
                const assignedRoles = assignments
                  .filter((assignment) => assignment.membershipId === membership.membershipId)
                  .map((assignment) => roleMap.get(assignment.roleId))
                  .filter((role): role is RoleDefinition => Boolean(role));
                return (
                  <tr key={membership.membershipId} className="group transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-100">
                          {(detail?.displayName || membership.memberId || "?").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="crm-text-wrap text-[12px] font-semibold text-slate-950">{detail?.displayName || membership.memberId}</div>
                            {isSelf && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">{text("Bạn", "You")}</span>}
                          </div>
                          <div className="mt-1 crm-text-wrap text-[10px] font-semibold text-slate-400">{detail?.email || text("Chưa có email tài khoản", "No account email")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1.5">
                        <Status status={membership.status} vi={vi} />
                        <AccountSource source={detail?.accountSource || "unknown"} vi={vi} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-[330px] flex-wrap gap-1.5">
                        {assignedRoles.length > 0 ? assignedRoles.slice(0, 3).map((role) => (
                          <span key={role.roleId} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-medium text-slate-700">{role.name}</span>
                        )) : <span className="text-[10px] font-semibold text-rose-500">{text("Chưa có vai trò", "No role assigned")}</span>}
                        {assignedRoles.length > 3 && <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500">+{assignedRoles.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[10px] font-medium text-slate-500">{formatTeams(membership.teamIds || [], vi)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {invitation ? (
                          <>
                            <Button type="button" size="xs" variant="secondary" disabled={!canConfigure} icon={<RefreshCw size={11} />} onClick={() => onResend(invitation.invitationId)}>{text("Gửi lại", "Resend")}</Button>
                            <Button type="button" size="xs" actionIntent="destructive" disabled={!canConfigure} icon={<XCircle size={11} />} onClick={() => onRevoke(invitation.invitationId)}>{text("Thu hồi", "Revoke")}</Button>
                          </>
                        ) : (
                          <>
                            <Button type="button" size="xs" variant="secondary" disabled={!canConfigure} icon={<UserCog size={11} />} onClick={() => membership.membershipId && onManage(membership.membershipId)}>{text("Quản lý quyền", "Manage access")}</Button>
                            {detail?.accountSource === "direct" && detail.accountId && (
                              <Button type="button" size="xs" variant="secondary" disabled={!canConfigure} icon={<KeyRound size={11} />} onClick={() => onRotatePassword(detail.accountId!)}>{text("Cấp lại mật khẩu", "Reset password")}</Button>
                            )}
                            {membership.status === "active" ? (
                              <Button type="button" size="xs" variant="secondary" disabled={!canConfigure || isSelf} icon={<UserMinus size={11} />} onClick={() => membership.membershipId && onStatusChange(membership.membershipId, "suspended")}>{text("Tạm khóa", "Suspend")}</Button>
                            ) : (
                              <Button type="button" size="xs" actionIntent="confirm" disabled={!canConfigure} icon={<CheckCircle2 size={11} />} onClick={() => membership.membershipId && onStatusChange(membership.membershipId, "active")}>{text("Kích hoạt", "Activate")}</Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredMembers.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Search size={20} /></div>
            <div className="mt-3 text-sm font-semibold text-slate-800">{text("Không tìm thấy thành viên", "No members found")}</div>
            <div className="mt-1 text-[11px] font-medium text-slate-400">{text("Thử thay đổi từ khóa hoặc bộ lọc trạng thái.", "Try another keyword or status filter.")}</div>
          </div>
        )}
      </section>
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: number; helper: string }> = ({ icon, label, value, helper }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30">
    <div className="flex items-start justify-between gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</div>
      <span className="text-2xl font-semibold tracking-tight text-slate-950">{value}</span>
    </div>
    <div className="mt-3 text-[11px] font-semibold text-slate-700">{label}</div>
    <div className="mt-1 text-[9px] font-semibold leading-4 text-slate-400">{helper}</div>
  </div>
);

const Status: React.FC<{ status: string; vi: boolean }> = ({ status, vi }) => {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: vi ? "Hoạt động" : "Active", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    invited: { label: vi ? "Đang chờ" : "Pending", className: "bg-amber-50 text-amber-700 ring-amber-100" },
    suspended: { label: vi ? "Tạm khóa" : "Suspended", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  };
  const item = map[status] || { label: status, className: "bg-slate-100 text-slate-600 ring-slate-200" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-semibold ring-1 ${item.className}`}>{item.label}</span>;
};

const AccountSource: React.FC<{ source: WorkspaceMemberDirectoryEntry["accountSource"]; vi: boolean }> = ({ source, vi }) => {
  const labels = {
    direct: vi ? "Tài khoản cấp trực tiếp" : "Direct account",
    invitation: vi ? "Mời qua email" : "Email invitation",
    seed: vi ? "Tài khoản hệ thống" : "System account",
    external: vi ? "Tài khoản bên ngoài" : "External account",
    unknown: vi ? "Chưa liên kết tài khoản" : "No linked account",
  };
  return <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-400"><ShieldCheck size={10} />{labels[source]}</div>;
};

const teamLabels: Record<string, { vi: string; en: string }> = {
  team_sales: { vi: "Kinh doanh", en: "Sales" },
  team_finance: { vi: "Tài chính", en: "Finance" },
  team_operations: { vi: "Vận hành", en: "Operations" },
  team_care: { vi: "Chăm sóc KH", en: "Customer Care" },
  team_support: { vi: "Hỗ trợ", en: "Support" },
  team_admin: { vi: "Quản trị", en: "Administration" },
};

function formatTeams(teamIds: string[], vi: boolean): string {
  if (teamIds.length === 0) return "—";
  return teamIds.map((teamId) => teamLabels[teamId]?.[vi ? "vi" : "en"] || teamId).join(", ");
}
