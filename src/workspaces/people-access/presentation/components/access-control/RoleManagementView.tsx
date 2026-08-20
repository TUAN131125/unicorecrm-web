import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Database,
  EyeOff,
  KeyRound,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  ALL_CAPABILITIES,
  type AccessControlSnapshot,
  type Capability,
  type DataScope,
  type FieldAccess,
  type RoleAssignment,
  type RoleDefinition,
} from "@/platform/access-control";
import { Button } from "@/shared/components/ui";
import {
  CAPABILITY_GROUP_LABELS,
  DATA_SCOPE_OPTIONS,
  FIELD_ACCESS_OPTIONS,
  RESOURCE_LABELS,
  SCOPE_RESOURCES,
  SENSITIVE_FIELDS,
  capabilityPresentation,
} from "./accessControlUiCatalog";

export type RolePanel = "capabilities" | "scope" | "fields";

interface ScopeOwnerOption {
  ownerId: string;
  label: string;
}

interface RoleManagementViewProps {
  vi: boolean;
  roles: RoleDefinition[];
  assignments: RoleAssignment[];
  selectedRole?: RoleDefinition;
  selectedRoleId: string;
  onSelectRole(roleId: string): void;
  canConfigure: boolean;
  onCreate(): void;
  onDuplicate(): void;
  onDelete(): void;
  onMetadata(patch: Partial<Pick<RoleDefinition, "name" | "description" | "isActive">>): void;
  onToggleCapability(capability: string): void;
  onReplaceCapabilities(capabilities: Capability[]): void;
  dataScopes: AccessControlSnapshot["dataScopes"];
  fieldSecurity: AccessControlSnapshot["fieldSecurity"];
  scopeOwnerOptions: ScopeOwnerOption[];
  onDataScope(resourceKey: string, scope: DataScope, allowedOwnerIds?: string[]): void;
  onFieldAccess(resourceKey: string, fieldKey: string, access: FieldAccess): void;
}

export const RoleManagementView: React.FC<RoleManagementViewProps> = ({
  vi,
  roles,
  assignments,
  selectedRole,
  selectedRoleId,
  onSelectRole,
  canConfigure,
  onCreate,
  onDuplicate,
  onDelete,
  onMetadata,
  onToggleCapability,
  onReplaceCapabilities,
  dataScopes,
  fieldSecurity,
  scopeOwnerOptions,
  onDataScope,
  onFieldAccess,
}) => {
  const text = (viText: string, enText: string) => vi ? viText : enText;
  const [panel, setPanel] = useState<RolePanel>("capabilities");
  const [metadata, setMetadata] = useState({ name: selectedRole?.name ?? "", description: selectedRole?.description ?? "" });
  const [capabilitySearch, setCapabilitySearch] = useState("");

  useEffect(() => {
    setMetadata({ name: selectedRole?.name ?? "", description: selectedRole?.description ?? "" });
    setCapabilitySearch("");
  }, [selectedRole?.roleId, selectedRole?.name, selectedRole?.description]);

  const capabilityGroups = useMemo(() => {
    const groups = new Map<string, Capability[]>();
    ALL_CAPABILITIES.forEach((capability) => {
      const group = capability.split(".")[0];
      const presentation = capabilityPresentation(capability, vi);
      const haystack = `${presentation.groupLabel} ${presentation.actionLabel} ${capability}`.toLowerCase();
      if (capabilitySearch && !haystack.includes(capabilitySearch.trim().toLowerCase())) return;
      groups.set(group, [...(groups.get(group) || []), capability]);
    });
    return [...groups.entries()].sort(([left], [right]) => {
      const leftLabel = CAPABILITY_GROUP_LABELS[left]?.[vi ? "vi" : "en"] || left;
      const rightLabel = CAPABILITY_GROUP_LABELS[right]?.[vi ? "vi" : "en"] || right;
      return leftLabel.localeCompare(rightLabel);
    });
  }, [capabilitySearch, vi]);

  if (!selectedRole) return null;
  const metadataDirty = metadata.name.trim() !== selectedRole.name || metadata.description.trim() !== (selectedRole.description || "");
  const assignmentCount = assignments.filter((assignment) => assignment.roleId === selectedRole.roleId).length;
  const configuredScopes = dataScopes.filter((policy) => policy.roleId === selectedRole.roleId);
  const workspaceScopeCount = configuredScopes.filter((policy) => policy.scope === "WORKSPACE").length;

  return (
    <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <div className="text-[12px] font-semibold text-slate-950">{text("Vai trò trong workspace", "Workspace roles")}</div>
            <div className="mt-1 text-[9px] font-semibold text-slate-400">{text("Tạo từ mẫu hoặc tự cấu hình hoàn toàn", "Start from a template or configure from scratch")}</div>
          </div>
          {canConfigure && <Button type="button" size="sm" actionIntent="create" icon={<Plus size={12} />} onClick={onCreate}>{text("Tạo role", "Create role")}</Button>}
        </div>

        <div className="max-h-[760px] space-y-1 overflow-y-auto p-2">
          {roles.map((role) => {
            const membersUsingRole = assignments.filter((assignment) => assignment.roleId === role.roleId).length;
            const selected = selectedRoleId === role.roleId;
            return (
              <button
                key={role.roleId}
                type="button"
                onClick={() => onSelectRole(role.roleId)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${selected ? "border-indigo-300 bg-indigo-50/80 shadow-sm ring-2 ring-indigo-100" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="crm-text-wrap text-[11px] font-semibold text-slate-900">{role.name}</div>
                    <div className="mt-1 crm-text-wrap text-[9px] font-semibold leading-4 text-slate-400">{role.description || text("Chưa có mô tả trách nhiệm", "No responsibility description")}</div>
                  </div>
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${role.isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                </div>
                <div className="mt-3 flex items-center gap-3 text-[9px] font-medium text-slate-500">
                  <span className="inline-flex items-center gap-1"><Users size={10} />{membersUsingRole}</span>
                  <span className="inline-flex items-center gap-1"><KeyRound size={10} />{role.capabilities.length}</span>
                  <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[8px] font-semibold text-slate-500 ring-1 ring-slate-200">{role.sourceTemplateId ? text("Từ mẫu", "Template") : text("Tùy chỉnh", "Custom")}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${selectedRole.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{selectedRole.isActive ? text("Đang hoạt động", "Active") : text("Tạm khóa", "Disabled")}</span>
                {selectedRole.sourceTemplateId && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[9px] font-semibold text-sky-700">{text("Khởi tạo từ mẫu", "Created from template")}: {selectedRole.sourceTemplateId}</span>}
              </div>
              <input
                value={metadata.name}
                readOnly={!canConfigure}
                onChange={(event) => setMetadata((current) => ({ ...current, name: event.target.value }))}
                className="h-11 w-full max-w-xl rounded-xl border border-slate-200 px-3 text-base font-semibold text-slate-950 outline-none read-only:bg-slate-50 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70"
              />
              <textarea
                value={metadata.description}
                readOnly={!canConfigure}
                onChange={(event) => setMetadata((current) => ({ ...current, description: event.target.value }))}
                placeholder={text("Mô tả trách nhiệm và đối tượng sử dụng vai trò này", "Describe the responsibilities and intended users")}
                className="min-h-20 w-full max-w-3xl resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold leading-5 text-slate-600 outline-none read-only:bg-slate-50 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {canConfigure && metadataDirty && <Button type="button" actionIntent="save" icon={<Save size={12} />} onClick={() => onMetadata({ name: metadata.name, description: metadata.description })}>{text("Lưu thông tin", "Save details")}</Button>}
              <Button type="button" variant="secondary" icon={<Copy size={12} />} onClick={onDuplicate}>{text("Nhân bản", "Duplicate")}</Button>
              <Button type="button" variant="secondary" disabled={!canConfigure} icon={<MoreHorizontal size={12} />} onClick={() => onMetadata({ isActive: !selectedRole.isActive })}>{selectedRole.isActive ? text("Tạm khóa", "Disable") : text("Kích hoạt", "Enable")}</Button>
              <Button type="button" actionIntent="destructive" disabled={!canConfigure} icon={<Trash2 size={12} />} onClick={onDelete}>{text("Xóa", "Delete")}</Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
            <RoleSummary icon={<Users size={15} />} label={text("Thành viên đang dùng", "Assigned members")} value={String(assignmentCount)} />
            <RoleSummary icon={<KeyRound size={15} />} label={text("Capability đã cấp", "Granted capabilities")} value={String(selectedRole.capabilities.length)} />
            <RoleSummary icon={<Database size={15} />} label={text("Tài nguyên toàn workspace", "Workspace-wide resources")} value={String(workspaceScopeCount)} />
          </div>
        </section>

        <div className="flex gap-6 border-b border-slate-200">
          {([
            { key: "capabilities", label: text("Quyền chức năng", "Functional permissions"), icon: <KeyRound size={14} /> },
            { key: "scope", label: text("Phạm vi dữ liệu", "Data scope"), icon: <Database size={14} /> },
            { key: "fields", label: text("Bảo mật trường", "Field security"), icon: <EyeOff size={14} /> },
          ] as const).map((item) => (
            <button key={item.key} type="button" onClick={() => setPanel(item.key)} className={`relative inline-flex items-center gap-2 pb-3 text-[10px] font-semibold transition ${panel === item.key ? "text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
              {item.icon}{item.label}
              {panel === item.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-600" />}
            </button>
          ))}
        </div>

        {panel === "capabilities" && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[12px] font-semibold text-slate-950">{text("Quyền theo chức năng", "Permissions by feature")}</div>
                <div className="mt-1 text-[9px] font-semibold text-slate-400">{text("Tên dễ hiểu đi kèm mã quyền kỹ thuật để kiểm tra.", "Human-friendly labels include technical capability codes for verification.")}</div>
              </div>
              <label className="relative w-full sm:max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={capabilitySearch} onChange={(event) => setCapabilitySearch(event.target.value)} placeholder={text("Tìm quyền...", "Search permissions...")} className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-[10px] font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70" />
              </label>
            </div>

            {capabilityGroups.map(([group, capabilities]) => {
              const selectedCount = capabilities.filter((capability) => selectedRole.capabilities.includes(capability)).length;
              const allSelected = selectedCount === capabilities.length;
              const groupInfo = CAPABILITY_GROUP_LABELS[group];
              const replaceGroup = () => {
                const groupSet = new Set(capabilities);
                const remaining = selectedRole.capabilities.filter((capability) => !groupSet.has(capability));
                onReplaceCapabilities(allSelected ? remaining : [...remaining, ...capabilities]);
              };
              return (
                <div key={group} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex flex-col gap-3 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-900">{groupInfo?.[vi ? "vi" : "en"] || group}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[8px] font-semibold text-slate-500 ring-1 ring-slate-200">{selectedCount}/{capabilities.length}</span>
                      </div>
                      <div className="mt-1 text-[9px] font-semibold text-slate-400">{groupInfo?.[vi ? "descriptionVi" : "descriptionEn"]}</div>
                    </div>
                    {canConfigure && <Button type="button" size="xs" variant="secondary" icon={allSelected ? <Check size={11} /> : <Plus size={11} />} onClick={replaceGroup}>{allSelected ? text("Bỏ chọn nhóm", "Clear group") : text("Cấp cả nhóm", "Grant group")}</Button>}
                  </div>
                  <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-3">
                    {capabilities.map((capability) => {
                      const checked = selectedRole.capabilities.includes(capability);
                      const presentation = capabilityPresentation(capability, vi);
                      return (
                        <label key={capability} className={`flex min-h-[74px] cursor-pointer items-start gap-3 bg-white px-4 py-3 transition ${checked ? "bg-indigo-50/40" : "hover:bg-slate-50"}`}>
                          <input type="checkbox" checked={checked} disabled={!canConfigure} onChange={() => onToggleCapability(capability)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                          <span className="min-w-0">
                            <span className="block text-[10px] font-semibold text-slate-800">{presentation.actionLabel}</span>
                            <code className="mt-1 block break-all text-[8px] font-medium text-slate-400">{presentation.technical}</code>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {panel === "scope" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
            <div className="mb-4">
              <div className="text-[12px] font-semibold text-slate-950">{text("Phạm vi bản ghi được phép xem", "Record visibility scope")}</div>
              <div className="mt-1 text-[9px] font-semibold text-slate-400">{text("Phạm vi được thiết lập độc lập cho từng loại dữ liệu.", "Scope is configured independently for each resource.")}</div>
            </div>
            <div className="space-y-2">
              {SCOPE_RESOURCES.map((resourceKey) => {
                const policy = dataScopes.find((item) => item.roleId === selectedRole.roleId && item.resourceKey === resourceKey);
                const scope = policy?.scope || "OWN";
                const allowedOwnerIds = policy?.allowedOwnerIds || [];
                const setScope = (nextScope: DataScope) => {
                  if (nextScope === "CUSTOM") {
                    const firstOwner = allowedOwnerIds[0] || scopeOwnerOptions[0]?.ownerId;
                    if (!firstOwner) return;
                    onDataScope(resourceKey, nextScope, [firstOwner]);
                    return;
                  }
                  onDataScope(resourceKey, nextScope);
                };
                const toggleOwner = (ownerId: string) => {
                  const next = allowedOwnerIds.includes(ownerId) ? allowedOwnerIds.filter((candidate) => candidate !== ownerId) : [...allowedOwnerIds, ownerId];
                  if (next.length === 0) return;
                  onDataScope(resourceKey, "CUSTOM", next);
                };
                const selectedOption = DATA_SCOPE_OPTIONS.find((candidate) => candidate.value === scope) ?? DATA_SCOPE_OPTIONS[0];
                return (
                  <div key={resourceKey} className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-center">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-800">{RESOURCE_LABELS[resourceKey]?.[vi ? "vi" : "en"] || resourceKey}</div>
                        <code className="mt-1 block text-[8px] font-medium text-slate-400">{resourceKey}</code>
                      </div>
                      <label>
                        <span className="sr-only">Data scope</span>
                        <select disabled={!canConfigure} value={scope} onChange={(event) => setScope(event.target.value as DataScope)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70">
                          {DATA_SCOPE_OPTIONS.map((candidate) => <option key={candidate.value} value={candidate.value}>{candidate[vi ? "vi" : "en"]}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="mt-2 text-[9px] font-semibold text-slate-400">{selectedOption[vi ? "descriptionVi" : "descriptionEn"]}</div>
                    {scope === "CUSTOM" && (
                      <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                        {scopeOwnerOptions.map((owner) => (
                          <label key={owner.ownerId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[9px] font-semibold text-slate-700">
                            <input type="checkbox" disabled={!canConfigure || (allowedOwnerIds.includes(owner.ownerId) && allowedOwnerIds.length === 1)} checked={allowedOwnerIds.includes(owner.ownerId)} onChange={() => toggleOwner(owner.ownerId)} />
                            <span className="crm-text-wrap">{owner.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {panel === "fields" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
            <div className="mb-4 flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[10px] font-semibold leading-5 text-indigo-800">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              <span>{text("Khi một thành viên có nhiều vai trò, mức bảo vệ hạn chế nhất của trường dữ liệu sẽ được áp dụng.", "When a member has multiple roles, the most restrictive field policy is applied.")}</span>
            </div>
            <div className="space-y-2">
              {SENSITIVE_FIELDS.map(({ resourceKey, fieldKey, labelVi, labelEn }) => {
                const policy = fieldSecurity.find((item) => item.roleId === selectedRole.roleId && item.resourceKey === resourceKey && item.fieldKey === fieldKey);
                const access = policy?.access || "READ_WRITE";
                const selectedOption = FIELD_ACCESS_OPTIONS.find((candidate) => candidate.value === access) ?? FIELD_ACCESS_OPTIONS[0];
                return (
                  <div key={`${resourceKey}.${fieldKey}`} className="grid gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_230px] sm:items-center">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-800">{vi ? labelVi : labelEn}</div>
                      <code className="mt-1 block text-[8px] font-medium text-slate-400">{resourceKey}.{fieldKey}</code>
                      <div className="mt-1 text-[9px] font-semibold text-slate-400">{selectedOption[vi ? "descriptionVi" : "descriptionEn"]}</div>
                    </div>
                    <select disabled={!canConfigure} value={access} onChange={(event) => onFieldAccess(resourceKey, fieldKey, event.target.value as FieldAccess)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/70">
                      {FIELD_ACCESS_OPTIONS.map((candidate) => <option key={candidate.value} value={candidate.value}>{candidate[vi ? "vi" : "en"]}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const RoleSummary: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-3">
    <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{icon}{label}</div>
    <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
  </div>
);
