import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation } from "react-router-dom";
import {
  ROLE_TEMPLATES,
  applyAccessGovernanceMutation,
  createAccessCommandId,
  useAccessGovernance,
  useEffectiveAccess,
  type AccessMutationResult,
  type CreateAccessRoleInput,
  type DataScope,
  type FieldAccess,
  type ReplaceAccessRoleInput,
  type RoleDefinition,
} from "@/platform/access-control";
import { usePlatformState } from "@/platform/application-state";
import { useI18n } from "@/i18n";
import { formatApplicationError } from "@/shared/operations";
import { Button, Modal, PageHeader } from "@/shared/components/ui";
import { MailPlus, Plus, ShieldCheck, UserPlus } from "lucide-react";
import { MemberAccessModal } from "../components/MemberAccessModal";
import { MemberDirectoryView, type MemberDirectoryFilter } from "../components/MemberDirectoryView";
import {
  InviteMemberModal,
  ProvisionAccountModal,
  type MemberOnboardingInput,
  type ProvisionAccountInput,
} from "../components/MemberOnboardingModals";
import { RoleManagementView } from "../components/access-control/RoleManagementView";

export const UsersPermissionsPage: React.FC = () => {
  const location = useLocation();
  const { activeWorkspace } = usePlatformState();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const text = (viText: string, enText: string) => vi ? viText : enText;
  const effectiveAccess = useEffectiveAccess();
  const { state, runtime, refresh } = useAccessGovernance();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MemberDirectoryFilter>("all");
  const [onboardingMode, setOnboardingMode] = useState<"invite" | "account" | null>(null);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>();
  const [roleModal, setRoleModal] = useState<{ open: boolean; source?: RoleDefinition }>({ open: false });
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();

  const mode = location.pathname.endsWith("/roles") ? "roles" : "members";
  const directory = state.snapshot?.directory;
  const snapshot = useMemo(() => directory ? ({
    workspaceId: directory.workspaceId,
    revision: directory.revision,
    roles: directory.roles,
    assignments: directory.assignments,
    dataScopes: directory.dataScopes,
    fieldSecurity: directory.fieldSecurity,
  }) : undefined, [directory]);
  const members = directory?.members ?? [];
  const memberDetails = useMemo(() => new Map((directory?.memberDetails ?? []).map((entry) => [entry.membershipId, entry])), [directory]);
  const selectedRole = snapshot?.roles.find((role) => role.roleId === selectedRoleId) || snapshot?.roles[0];
  const selectedMembership = members.find((membership) => membership.membershipId === selectedMembershipId);
  const canConfigure = effectiveAccess.can("access.configure");

  useEffect(() => {
    if (!snapshot) return;
    if (!snapshot.roles.some((role) => role.roleId === selectedRoleId)) setSelectedRoleId(snapshot.roles[0]?.roleId || "");
  }, [snapshot, selectedRoleId]);
  useEffect(() => {
    setSearch(""); setFilter("all"); setSelectedMembershipId(undefined); setMessage(undefined);
  }, [activeWorkspace.workspaceId]);

  if (!directory || !snapshot) {
    return (
      <div className="mx-auto max-w-[1480px] space-y-5 pb-12 text-xs">
        <PageHeader icon={<ShieldCheck size={18} />} title={text("Người dùng & quyền truy cập", "People & Access")} />
        <div role={state.error ? "alert" : "status"} className={`rounded-xl border px-4 py-5 ${state.error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-500"}`}>
          {state.error || text("Đang tải quyền truy cập từ máy chủ…", "Loading access governance from the server…")}
        </div>
      </div>
    );
  }

  const scopeOwnerOptions = members
    .filter((membership) => membership.status === "active" && membership.memberId)
    .map((membership) => ({ ownerId: membership.memberId!, label: memberDetails.get(membership.membershipId)?.displayName || membership.memberId! }));

  const runMutation = async (mutation: () => Promise<AccessMutationResult>, successMessage?: string) => {
    try {
      const result = await mutation();
      await applyAccessGovernanceMutation(activeWorkspace.workspaceId, result);
      if (successMessage) setMessage({ tone: "success", text: successMessage });
    } catch (error) {
      // Raw exception text can be an internal diagnostic; the central formatter owns the
      // safe copy and falls back to a category sentence for anything unrecognised.
      setMessage({ tone: "error", text: formatApplicationError(error, {
        locale,
        fallbackMessage: text("Không thể cập nhật quyền truy cập.", "Could not update access control."),
      }) });
    }
  };

  const roleInput = (role: RoleDefinition, overrides: Partial<ReplaceAccessRoleInput> = {}): ReplaceAccessRoleInput => ({
    name: overrides.name ?? role.name,
    description: overrides.description ?? role.description,
    sourceTemplateId: overrides.sourceTemplateId ?? role.sourceTemplateId,
    isActive: overrides.isActive ?? role.isActive,
    capabilities: overrides.capabilities ?? [...role.capabilities],
    dataScopes: overrides.dataScopes ?? snapshot.dataScopes.filter((item) => item.roleId === role.roleId).map(({ resourceKey, scope, allowedOwnerIds }) => ({ resourceKey, scope, ...(allowedOwnerIds ? { allowedOwnerIds: [...allowedOwnerIds] } : {}) })),
    fieldSecurity: overrides.fieldSecurity ?? snapshot.fieldSecurity.filter((item) => item.roleId === role.roleId).map(({ resourceKey, fieldKey, access }) => ({ resourceKey, fieldKey, access })),
  });
  const replaceRole = (role: RoleDefinition, input: ReplaceAccessRoleInput, successMessage?: string) => runMutation(
    () => runtime.commands.replaceRole(activeWorkspace.workspaceId, role.roleId, input, { idempotencyKey: createAccessCommandId("replace-role"), expectedVersion: role.version ?? snapshot.revision }),
    successMessage,
  );

  const handleInvite = (input: MemberOnboardingInput) => void runMutation(async () => {
    const result = await runtime.commands.inviteMember(activeWorkspace.workspaceId, input, { idempotencyKey: createAccessCommandId("invite-member") });
    setOnboardingMode(null);
    return result;
  }, text(`Đã tạo lời mời cho ${input.email}.`, `Invitation created for ${input.email}.`));

  const handleProvision = (input: ProvisionAccountInput) => void runMutation(async () => {
    const result = await runtime.commands.provisionMember(activeWorkspace.workspaceId, { displayName: input.displayName, email: input.email, roleIds: input.roleIds, teamIds: input.teamIds }, { idempotencyKey: createAccessCommandId("provision-member") });
    setOnboardingMode(null);
    return result;
  }, text(`Đã tạo tài khoản và gửi hướng dẫn kích hoạt cho ${input.email}.`, `Account created and activation instructions sent to ${input.email}.`));

  const handleRotatePassword = (accountId: string) => {
    const target = members.find((member) => member.accountId === accountId);
    if (!target?.membershipId) { setMessage({ tone: "error", text: text("Không tìm thấy membership được quản lý.", "Managed membership was not found.") }); return; }
    void runMutation(() => runtime.commands.rotateManagedMemberPassword(activeWorkspace.workspaceId, target.membershipId!, { idempotencyKey: createAccessCommandId("rotate-password") }), text("Đã gửi quy trình đặt lại mật khẩu an toàn.", "Secure password reset process started."));
  };

  return (
    <div data-guidance-id="people.members.screen" data-people-access-surface="canonical" className="mx-auto max-w-[1480px] space-y-5 pb-12 text-xs">
      <PageHeader
        icon={<ShieldCheck size={18} />}
        title={text("Người dùng & quyền truy cập", "People & Access")}
        actions={mode === "members" && canConfigure ? (
          <div data-guidance-id="people.members.invite" className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" icon={<MailPlus size={14} />} onClick={() => setOnboardingMode("invite")}>{text("Mời qua email", "Invite by email")}</Button>
            <Button type="button" actionIntent="create" icon={<UserPlus size={14} />} onClick={() => setOnboardingMode("account")}>{text("Cấp tài khoản", "Create account")}</Button>
          </div>
        ) : undefined}
      />

      {!canConfigure && <div className="flex justify-end"><span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-700">{text("Chế độ chỉ xem", "Read-only mode")}</span></div>}
      <AnimatePresence mode="wait" initial={false}>{message && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} role={message.tone === "error" ? "alert" : "status"} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[11px] font-medium ${message.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}><span>{message.text}</span><button type="button" onClick={() => setMessage(undefined)} className="shrink-0 rounded-lg px-2 py-1 text-[9px] font-semibold opacity-70 hover:bg-white/60">{text("Đóng", "Dismiss")}</button></motion.div>}</AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
          {mode === "members" ? (
            <MemberDirectoryView vi={vi} search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} members={members} memberDetails={memberDetails} roles={snapshot.roles} assignments={snapshot.assignments} invitations={directory.invitations} canConfigure={canConfigure} currentMembershipId={effectiveAccess.membershipId} onManage={setSelectedMembershipId}
              onStatusChange={(membershipId, status) => { const member = members.find((item) => item.membershipId === membershipId); void runMutation(() => runtime.commands.changeMemberStatus(activeWorkspace.workspaceId, membershipId, { status }, { idempotencyKey: createAccessCommandId("member-status"), expectedVersion: member?.resourceVersion ?? snapshot.revision }), status === "active" ? text("Đã kích hoạt lại thành viên.", "Member reactivated.") : text("Đã tạm khóa quyền truy cập workspace.", "Workspace access suspended.")); }}
              onResend={(invitationId) => void runMutation(() => runtime.commands.resendInvitation(activeWorkspace.workspaceId, invitationId, { idempotencyKey: createAccessCommandId("resend-invitation") }), text("Đã gia hạn và gửi lại lời mời.", "Invitation resent and extended."))}
              onRevoke={(invitationId) => void runMutation(() => runtime.commands.revokeInvitation(activeWorkspace.workspaceId, invitationId, { idempotencyKey: createAccessCommandId("revoke-invitation") }), text("Đã thu hồi lời mời.", "Invitation revoked."))}
              onRotatePassword={handleRotatePassword}
            />
          ) : (
            <RoleManagementView vi={vi} roles={snapshot.roles} assignments={snapshot.assignments} selectedRole={selectedRole} selectedRoleId={selectedRole?.roleId || ""} onSelectRole={setSelectedRoleId} canConfigure={canConfigure} onCreate={() => setRoleModal({ open: true })} onDuplicate={() => selectedRole && setRoleModal({ open: true, source: selectedRole })}
              onDelete={() => selectedRole && void runMutation(async () => { const nextRole = snapshot.roles.find((role) => role.roleId !== selectedRole.roleId); const result = await runtime.commands.archiveRole(activeWorkspace.workspaceId, selectedRole.roleId, undefined, { idempotencyKey: createAccessCommandId("archive-role"), expectedVersion: selectedRole.version ?? snapshot.revision }); setSelectedRoleId(nextRole?.roleId || ""); return result; }, text("Đã lưu trữ vai trò.", "Role archived."))}
              onMetadata={(patch) => selectedRole && void replaceRole(selectedRole, roleInput(selectedRole, patch), text("Đã cập nhật vai trò.", "Role updated."))}
              onToggleCapability={(capability) => selectedRole && void replaceRole(selectedRole, roleInput(selectedRole, { capabilities: selectedRole.capabilities.includes(capability) ? selectedRole.capabilities.filter((item) => item !== capability) : [...selectedRole.capabilities, capability] }))}
              onReplaceCapabilities={(capabilities) => selectedRole && void replaceRole(selectedRole, roleInput(selectedRole, { capabilities }), text("Đã cập nhật nhóm quyền.", "Permission group updated."))}
              dataScopes={snapshot.dataScopes} fieldSecurity={snapshot.fieldSecurity} scopeOwnerOptions={scopeOwnerOptions}
              onDataScope={(resourceKey: string, scope: DataScope, allowedOwnerIds?: string[]) => selectedRole && void replaceRole(selectedRole, roleInput(selectedRole, { dataScopes: [...snapshot.dataScopes.filter((item) => item.roleId === selectedRole.roleId && item.resourceKey !== resourceKey).map(({ resourceKey: key, scope: currentScope, allowedOwnerIds: currentOwners }) => ({ resourceKey: key, scope: currentScope, ...(currentOwners ? { allowedOwnerIds: [...currentOwners] } : {}) })), { resourceKey, scope, ...(allowedOwnerIds ? { allowedOwnerIds } : {}) }] }))}
              onFieldAccess={(resourceKey: string, fieldKey: string, access: FieldAccess) => selectedRole && void replaceRole(selectedRole, roleInput(selectedRole, { fieldSecurity: [...snapshot.fieldSecurity.filter((item) => item.roleId === selectedRole.roleId && !(item.resourceKey === resourceKey && item.fieldKey === fieldKey)).map(({ resourceKey: key, fieldKey: field, access: current }) => ({ resourceKey: key, fieldKey: field, access: current })), { resourceKey, fieldKey, access }] }))}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <InviteMemberModal isOpen={onboardingMode === "invite"} onClose={() => setOnboardingMode(null)} roles={snapshot.roles.filter((role) => role.isActive)} vi={vi} onSubmit={handleInvite} />
      <ProvisionAccountModal isOpen={onboardingMode === "account"} onClose={() => setOnboardingMode(null)} roles={snapshot.roles.filter((role) => role.isActive)} vi={vi} onSubmit={handleProvision} />
      <MemberAccessModal isOpen={Boolean(selectedMembership)} onClose={() => setSelectedMembershipId(undefined)} membership={selectedMembership} detail={selectedMembership ? memberDetails.get(selectedMembership.membershipId) : undefined} roles={snapshot.roles} assignments={snapshot.assignments} vi={vi} canConfigure={canConfigure}
        onSave={({ roleIds, teamIds }) => { if (!selectedMembership?.membershipId) return; void runMutation(async () => { const result = await runtime.commands.replaceMemberAccess(activeWorkspace.workspaceId, selectedMembership.membershipId!, { roleIds, teamIds }, { idempotencyKey: createAccessCommandId("member-access"), expectedVersion: selectedMembership.resourceVersion ?? snapshot.revision }); setSelectedMembershipId(undefined); return result; }, text("Đã cập nhật quyền và nhóm của thành viên.", "Member access and teams updated.")); }}
      />
      <RoleModal isOpen={roleModal.open} source={roleModal.source} vi={vi} onClose={() => setRoleModal({ open: false })}
        onSubmit={({ name, description, templateId }) => { const template = templateId ? ROLE_TEMPLATES.find((item) => item.templateId === templateId) : undefined; const input: CreateAccessRoleInput = roleModal.source ? { name, description, sourceTemplateId: roleModal.source.sourceTemplateId, capabilities: [...roleModal.source.capabilities], dataScopes: snapshot.dataScopes.filter((item) => item.roleId === roleModal.source?.roleId).map(({ resourceKey, scope, allowedOwnerIds }) => ({ resourceKey, scope, ...(allowedOwnerIds ? { allowedOwnerIds: [...allowedOwnerIds] } : {}) })), fieldSecurity: snapshot.fieldSecurity.filter((item) => item.roleId === roleModal.source?.roleId).map(({ resourceKey, fieldKey, access }) => ({ resourceKey, fieldKey, access })) } : { name, description, ...(templateId ? { sourceTemplateId: templateId } : {}), capabilities: template ? [...template.capabilities] : ["dashboard.read"], dataScopes: [], fieldSecurity: [] }; void runMutation(async () => { const result = await runtime.commands.createRole(activeWorkspace.workspaceId, input, { idempotencyKey: createAccessCommandId("create-role") }); setSelectedRoleId(result.aggregateId); setRoleModal({ open: false }); return result; }, text("Đã tạo vai trò. Toàn bộ quyền vẫn có thể tùy chỉnh.", "Role created. All permissions remain customizable.")); }}
      />
    </div>
  );
};

const RoleModal: React.FC<{
  isOpen: boolean;
  source?: RoleDefinition;
  vi: boolean;
  onClose(): void;
  onSubmit(input: { name: string; description: string; templateId?: string }): void;
}> = ({ isOpen, source, vi, onClose, onSubmit }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    setName(source ? `${source.name} Copy` : "");
    setDescription(source?.description || "");
    setTemplateId("");
  }, [isOpen, source?.roleId]);
  const text = (viText: string, enText: string) => vi ? viText : enText;
  const applyTemplate = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    const template = ROLE_TEMPLATES.find((candidate) => candidate.templateId === nextTemplateId);
    if (template) {
      setName(template.name);
      setDescription(template.description);
    }
  };
  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} size="sm" title={source ? text("Nhân bản vai trò", "Duplicate role") : text("Tạo vai trò tùy biến", "Create custom role")}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit({ name, description, templateId: templateId || undefined }); }} className="crm-form-surface space-y-4">
        {!source && (
          <label className="space-y-1.5">
            <span className="text-[10px] font-medium text-slate-700">{text("Bắt đầu từ mẫu gợi ý", "Start from a suggested template")}</span>
            <select value={templateId} onChange={(event) => applyTemplate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70">
              <option value="">{text("Vai trò tối thiểu", "Minimal role")}</option>
              {ROLE_TEMPLATES.map((template) => <option key={template.templateId} value={template.templateId}>{template.name}</option>)}
            </select>
            <span className="block text-[9px] font-semibold leading-4 text-slate-400">{text("Mẫu chỉ sao chép quyền khởi tạo, không khóa chỉnh sửa hoặc đổi tên.", "Templates only copy initial permissions and never lock editing or renaming.")}</span>
          </label>
        )}
        <FormInput label={text("Tên vai trò", "Role name")} value={name} onChange={setName} required />
        <label className="space-y-1.5">
          <span className="text-[10px] font-medium text-slate-700">{text("Mô tả trách nhiệm", "Responsibility description")}</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70" />
        </label>
        <div className="crm-form-action-bar flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>{text("Hủy", "Cancel")}</Button>
          <Button type="submit" actionIntent="create" icon={<Plus size={14} />} disabled={!name.trim()}>{source ? text("Tạo bản sao", "Create copy") : text("Tạo vai trò", "Create role")}</Button>
        </div>
      </form>
    </Modal>
  );
};

const FormInput: React.FC<{ label: string; value: string; onChange(value: string): void; required?: boolean }> = ({ label, value, onChange, required }) => (
  <label className="space-y-1.5">
    <span className="text-[10px] font-medium text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>
    <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70" />
  </label>
);
