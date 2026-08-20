import React, { useEffect, useMemo, useState } from "react";
import { MailPlus, ShieldAlert, ShieldCheck, UserPlus } from "lucide-react";
import { Button, Modal } from "@/shared/components/ui";
import type { RoleDefinition } from "@/platform/access-control";

export const TEAM_OPTIONS = [
  { id: "team_sales", vi: "Kinh doanh", en: "Sales" },
  { id: "team_finance", vi: "Tài chính", en: "Finance" },
  { id: "team_operations", vi: "Vận hành", en: "Operations" },
  { id: "team_care", vi: "Chăm sóc khách hàng", en: "Customer Care" },
  { id: "team_support", vi: "Hỗ trợ", en: "Support" },
  { id: "team_admin", vi: "Quản trị", en: "Administration" },
] as const;

export function hasPrivilegedRole(roles: readonly RoleDefinition[], roleIds: readonly string[]): boolean {
  const selected = new Set(roleIds);
  return roles.some((role) => selected.has(role.roleId) && role.capabilities.includes("access.configure"));
}

export interface MemberOnboardingInput {
  displayName: string;
  email: string;
  roleIds: string[];
  teamIds: string[];
}

export interface ProvisionAccountInput extends MemberOnboardingInput {}

interface CommonModalProps {
  isOpen: boolean;
  onClose(): void;
  roles: RoleDefinition[];
  vi: boolean;
}

export const InviteMemberModal: React.FC<CommonModalProps & { onSubmit(input: MemberOnboardingInput): void }> = ({ isOpen, onClose, roles, vi, onSubmit }) => {
  const text = (viText: string, enText: string) => vi ? viText : enText;
  const [form, setForm] = useState<MemberOnboardingInput>({ displayName: "", email: "", roleIds: [], teamIds: [] });
  const [privilegedRoleConfirmed, setPrivilegedRoleConfirmed] = useState(false);
  const privilegedRoleSelected = hasPrivilegedRole(roles, form.roleIds);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ displayName: "", email: "", roleIds: [], teamIds: [] });
    setPrivilegedRoleConfirmed(false);
  }, [isOpen]);

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} size="md" title={text("Mời thành viên qua email", "Invite member by email")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
        className="crm-form-surface space-y-5"
      >
        <div className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-[11px] font-semibold leading-5 text-sky-900">
          <MailPlus size={18} className="mt-0.5 shrink-0 text-sky-600" />
          <div>
            <div className="font-semibold">{text("Người nhận tự kích hoạt tài khoản", "The recipient activates their own account")}</div>
            <div className="mt-0.5 text-sky-700">{text("Lời mời có hiệu lực 7 ngày. Vai trò và nhóm đã chọn được áp dụng ngay khi lời mời được chấp nhận.", "The invitation is valid for seven days. Selected roles and teams apply when it is accepted.")}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label={text("Họ và tên", "Full name")} value={form.displayName} onChange={(displayName) => setForm((current) => ({ ...current, displayName }))} required />
          <FormInput label={text("Email công việc", "Work email")} type="email" value={form.email} onChange={(email) => setForm((current) => ({ ...current, email }))} required />
        </div>

        <RoleChecklist roles={roles} selectedRoleIds={form.roleIds} vi={vi} onChange={(roleIds) => {
          setForm((current) => ({ ...current, roleIds }));
          if (!hasPrivilegedRole(roles, roleIds)) setPrivilegedRoleConfirmed(false);
        }} />
        <PrivilegedRoleConfirmation selected={privilegedRoleSelected} confirmed={privilegedRoleConfirmed} vi={vi} onChange={setPrivilegedRoleConfirmed} />
        <TeamSelector selectedTeamIds={form.teamIds} vi={vi} onChange={(teamIds) => setForm((current) => ({ ...current, teamIds }))} />

        <div className="crm-form-action-bar flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>{text("Hủy", "Cancel")}</Button>
          <Button type="submit" actionIntent="create" icon={<MailPlus size={14} />} disabled={!form.displayName.trim() || !form.email.trim() || form.roleIds.length === 0 || (privilegedRoleSelected && !privilegedRoleConfirmed)}>{text("Gửi lời mời", "Send invitation")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export const ProvisionAccountModal: React.FC<CommonModalProps & { onSubmit(input: ProvisionAccountInput): void }> = ({ isOpen, onClose, roles, vi, onSubmit }) => {
  const text = (viText: string, enText: string) => vi ? viText : enText;
  const [form, setForm] = useState<ProvisionAccountInput>({ displayName: "", email: "", roleIds: [], teamIds: [] });
  const [privilegedRoleConfirmed, setPrivilegedRoleConfirmed] = useState(false);
  const privilegedRoleSelected = hasPrivilegedRole(roles, form.roleIds);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ displayName: "", email: "", roleIds: [], teamIds: [] });
    setPrivilegedRoleConfirmed(false);
  }, [isOpen]);

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} size="md" title={text("Cấp tài khoản cho nhân viên", "Provision employee account")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
        className="crm-form-surface space-y-5"
      >
        <div className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[11px] font-semibold leading-5 text-indigo-900">
          <UserPlus size={18} className="mt-0.5 shrink-0 text-indigo-600" />
          <div>
            <div className="font-semibold">{text("Tạo tài khoản và kích hoạt quyền an toàn", "Create an account with secure activation")}</div>
            <div className="mt-0.5 text-indigo-700">{text("Người nhận hoàn tất kích hoạt qua hướng dẫn bảo mật được gửi bằng kênh đã cấu hình.", "Activation instructions are sent through the configured secure channel.")}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label={text("Họ và tên nhân viên", "Employee name")} value={form.displayName} onChange={(displayName) => setForm((current) => ({ ...current, displayName }))} required />
          <FormInput label={text("Email đăng nhập", "Sign-in email")} type="email" value={form.email} onChange={(email) => setForm((current) => ({ ...current, email }))} required />
        </div>

        <RoleChecklist roles={roles} selectedRoleIds={form.roleIds} vi={vi} onChange={(roleIds) => {
          setForm((current) => ({ ...current, roleIds }));
          if (!hasPrivilegedRole(roles, roleIds)) setPrivilegedRoleConfirmed(false);
        }} />
        <PrivilegedRoleConfirmation selected={privilegedRoleSelected} confirmed={privilegedRoleConfirmed} vi={vi} onChange={setPrivilegedRoleConfirmed} />
        <TeamSelector selectedTeamIds={form.teamIds} vi={vi} onChange={(teamIds) => setForm((current) => ({ ...current, teamIds }))} />

        <div className="crm-form-action-bar flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>{text("Hủy", "Cancel")}</Button>
          <Button type="submit" actionIntent="create" icon={<UserPlus size={14} />} disabled={!form.displayName.trim() || !form.email.trim() || form.roleIds.length === 0 || (privilegedRoleSelected && !privilegedRoleConfirmed)}>{text("Tạo và cấp quyền", "Create and grant access")}</Button>
        </div>
      </form>
    </Modal>
  );
};

interface RoleChecklistProps {
  roles: RoleDefinition[];
  selectedRoleIds: string[];
  vi: boolean;
  onChange(roleIds: string[]): void;
}

export const RoleChecklist: React.FC<RoleChecklistProps> = ({ roles, selectedRoleIds, vi, onChange }) => {
  const text = (viText: string, enText: string) => vi ? viText : enText;
  const selected = useMemo(() => new Set(selectedRoleIds), [selectedRoleIds]);
  const toggle = (roleId: string) => {
    const next = selected.has(roleId) ? selectedRoleIds.filter((id) => id !== roleId) : [...selectedRoleIds, roleId];
    onChange(next);
  };
  return (
    <fieldset className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <legend className="flex items-center gap-2 text-[11px] font-semibold text-slate-800"><ShieldCheck size={15} className="text-indigo-600" />{text("Vai trò được cấp", "Assigned roles")}</legend>
        <span className="text-[9px] font-medium text-slate-400">{text("Có thể chọn nhiều", "Multiple allowed")}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((role) => {
          const checked = selected.has(role.roleId);
          return (
            <label key={role.roleId} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${checked ? "border-indigo-300 bg-indigo-50/80 ring-2 ring-indigo-100" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(role.roleId)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold text-slate-900">{role.name}</span>
                <span className="mt-1 crm-text-wrap block text-[9px] font-semibold leading-4 text-slate-400">{role.description || `${role.capabilities.length} capabilities`}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

const TeamSelector: React.FC<{ selectedTeamIds: string[]; vi: boolean; onChange(teamIds: string[]): void }> = ({ selectedTeamIds, vi, onChange }) => {
  const text = (viText: string, enText: string) => vi ? viText : enText;
  const selected = new Set(selectedTeamIds);
  return (
    <fieldset className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-[11px] font-semibold text-slate-800">{text("Nhóm làm việc", "Teams")}</legend>
        <span className="text-[9px] font-medium text-slate-400">{text("Không tự chọn mặc định", "No automatic default")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TEAM_OPTIONS.map((team) => (
          <label key={team.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-medium transition ${selected.has(team.id) ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
            <input
              type="checkbox"
              checked={selected.has(team.id)}
              onChange={() => onChange(selected.has(team.id) ? selectedTeamIds.filter((id) => id !== team.id) : [...selectedTeamIds, team.id])}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
            />
            {vi ? team.vi : team.en}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export const PrivilegedRoleConfirmation: React.FC<{ selected: boolean; confirmed: boolean; vi: boolean; onChange(confirmed: boolean): void }> = ({ selected, confirmed, vi, onChange }) => {
  if (!selected) return null;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
      <input type="checkbox" checked={confirmed} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600" />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[11px] font-semibold"><ShieldAlert size={15} />{vi ? "Xác nhận cấp quyền quản trị workspace" : "Confirm workspace administrator access"}</span>
        <span className="mt-1 block text-[10px] font-semibold leading-4 text-amber-800">{vi ? "Vai trò đã chọn có thể cấu hình người dùng, quyền và toàn bộ workspace. Chỉ xác nhận khi đây là chủ ý." : "The selected role can configure users, permissions, and the entire workspace. Confirm only when this is intentional."}</span>
      </span>
    </label>
  );
};

const FormInput: React.FC<{ label: string; value: string; onChange(value: string): void; required?: boolean; type?: string }> = ({ label, value, onChange, required, type = "text" }) => (
  <label className="space-y-1.5">
    <span className="text-[10px] font-medium text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>
    <input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70" />
  </label>
);
