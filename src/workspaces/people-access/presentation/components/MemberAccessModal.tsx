import React, { useEffect, useMemo, useState } from "react";
import { Database, ShieldCheck, UserCog, Users } from "lucide-react";
import { Button, Modal } from "@/shared/components/ui";
import type { RoleAssignment, RoleDefinition } from "@/platform/access-control";
import type { WorkspaceMemberDirectoryEntry } from "@/platform/member-directory";
import type { WorkspaceMembership } from "@/platform/workspace-membership";
import { hasPrivilegedRole, PrivilegedRoleConfirmation, RoleChecklist, TEAM_OPTIONS } from "./MemberOnboardingModals";

interface MemberAccessModalProps {
  isOpen: boolean;
  onClose(): void;
  membership?: WorkspaceMembership;
  detail?: WorkspaceMemberDirectoryEntry;
  roles: RoleDefinition[];
  assignments: RoleAssignment[];
  vi: boolean;
  canConfigure: boolean;
  onSave(input: { roleIds: string[]; teamIds: string[] }): void;
}

export const MemberAccessModal: React.FC<MemberAccessModalProps> = ({
  isOpen,
  onClose,
  membership,
  detail,
  roles,
  assignments,
  vi,
  canConfigure,
  onSave,
}) => {
  const text = (viText: string, enText: string) => vi ? viText : enText;
  const assignedRoleIds = useMemo(() => assignments.filter((assignment) => assignment.membershipId === membership?.membershipId).map((assignment) => assignment.roleId), [assignments, membership?.membershipId]);
  const [roleIds, setRoleIds] = useState<string[]>(assignedRoleIds);
  const [teamIds, setTeamIds] = useState<string[]>(membership?.teamIds || []);
  const [privilegedRoleConfirmed, setPrivilegedRoleConfirmed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRoleIds(assignedRoleIds);
    setTeamIds(membership?.teamIds || []);
    setPrivilegedRoleConfirmed(false);
  }, [isOpen, membership?.membershipId, assignedRoleIds, membership?.teamIds]);

  const selectedRoles = roles.filter((role) => roleIds.includes(role.roleId));
  const privilegedRoleSelected = hasPrivilegedRole(roles, roleIds);
  const privilegedRoleAdded = privilegedRoleSelected && !hasPrivilegedRole(roles, assignedRoleIds);
  const capabilityCount = new Set(selectedRoles.flatMap((role) => role.capabilities)).size;
  const productSpaces = [
    selectedRoles.some((role) => role.capabilities.some((capability) => capability.startsWith("studio."))) ? text("Thiết lập", "Studio") : undefined,
    selectedRoles.some((role) => role.capabilities.some((capability) => capability.startsWith("access.") || capability.startsWith("audit."))) ? text("Người dùng & quyền", "People & Access") : undefined,
    selectedRoles.some((role) => role.capabilities.some((capability) => !capability.startsWith("studio.") && !capability.startsWith("access.") && !capability.startsWith("audit."))) ? "CRM" : undefined,
  ].filter(Boolean) as string[];
  const dirty = JSON.stringify([...roleIds].sort()) !== JSON.stringify([...assignedRoleIds].sort()) || JSON.stringify([...teamIds].sort()) !== JSON.stringify([...(membership?.teamIds || [])].sort());

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} size="md" title={text("Quản lý quyền thành viên", "Manage member access")}>
      {membership && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-base font-semibold text-indigo-700 ring-1 ring-indigo-100">{(detail?.displayName || membership.memberId || "?").slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0">
                <div className="crm-text-wrap text-sm font-semibold text-slate-950">{detail?.displayName || membership.memberId}</div>
                <div className="mt-1 crm-text-wrap text-[10px] font-semibold text-slate-400">{detail?.email || membership.accountId || "—"}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[9px] font-semibold">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1.5 text-emerald-700">{membership.status === "active" ? text("Đang hoạt động", "Active") : text("Tạm khóa", "Suspended")}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1.5 text-slate-600">{detail?.accountSource === "direct" ? text("Tài khoản trực tiếp", "Direct account") : detail?.accountSource === "invitation" ? text("Lời mời", "Invitation") : text("Tài khoản hệ thống", "System account")}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard icon={<ShieldCheck size={15} />} label={text("Vai trò", "Roles")} value={String(roleIds.length)} />
            <SummaryCard icon={<Database size={15} />} label={text("Capability hiệu lực", "Effective capabilities")} value={String(capabilityCount)} />
            <SummaryCard icon={<UserCog size={15} />} label={text("Không gian truy cập", "Accessible spaces")} value={productSpaces.join(", ") || "—"} compact />
          </div>

          <RoleChecklist roles={roles.filter((role) => role.isActive || roleIds.includes(role.roleId))} selectedRoleIds={roleIds} vi={vi} onChange={(nextRoleIds) => {
            setRoleIds(nextRoleIds);
            if (!hasPrivilegedRole(roles, nextRoleIds)) setPrivilegedRoleConfirmed(false);
          }} />
          <PrivilegedRoleConfirmation selected={privilegedRoleAdded} confirmed={privilegedRoleConfirmed} vi={vi} onChange={setPrivilegedRoleConfirmed} />

          <fieldset className="space-y-3">
            <legend className="flex items-center gap-2 text-[11px] font-semibold text-slate-800"><Users size={15} className="text-indigo-600" />{text("Nhóm làm việc", "Teams")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEAM_OPTIONS.map((team) => {
                const checked = teamIds.includes(team.id);
                return (
                  <label key={team.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-[10px] font-medium transition ${checked ? "border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                    <input type="checkbox" checked={checked} disabled={!canConfigure} onChange={() => setTeamIds(checked ? teamIds.filter((id) => id !== team.id) : [...teamIds, team.id])} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    {vi ? team.vi : team.en}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[10px] font-semibold leading-5 text-amber-800">
            {text("Quyền hiệu lực là hợp nhất của các vai trò. Chính sách bảo mật trường áp dụng mức hạn chế nhất giữa các vai trò.", "Effective access combines assigned roles. Field security applies the most restrictive policy across roles.")}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>{text("Đóng", "Close")}</Button>
            <Button type="button" actionIntent="save" disabled={!canConfigure || !dirty || roleIds.length === 0 || (privilegedRoleAdded && !privilegedRoleConfirmed)} onClick={() => onSave({ roleIds, teamIds })}>{text("Lưu quyền truy cập", "Save access")}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: string; compact?: boolean }> = ({ icon, label, value, compact }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{icon}{label}</div>
    <div className={`mt-2 font-semibold text-slate-900 ${compact ? "text-[10px] leading-4" : "text-lg"}`}>{value}</div>
  </div>
);
