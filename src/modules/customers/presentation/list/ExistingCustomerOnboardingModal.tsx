import React from "react";
import { useBoundFormDraft } from "@/shared/hooks/useBoundFormDraft";
import { Button, ConfirmDialog, Input, Modal, Select } from "@/shared/components/ui";
import { getContactsSnapshot } from "@/modules/contacts";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { presentApplicationError } from "@/shared/operations";
import { createCustomerCommand, type Customer } from "../../public/api";

interface ExistingCustomerOnboardingModalProps {
  isOpen: boolean;
  onClose(): void;
  actorId: string;
  isVi: boolean;
  onCompleted(customer: Customer): void;
}

type RelationshipKind = "CONTACT" | "ORGANIZATION_ACCOUNT";

export function ExistingCustomerOnboardingModal({ isOpen, onClose, isVi, onCompleted }: ExistingCustomerOnboardingModalProps) {
  const contacts = React.useMemo(() => getContactsSnapshot(), [isOpen]);
  const organizations = React.useMemo(() => getOrganizationAccountsSnapshot(), [isOpen]);
  const lifecycle = useBoundFormDraft(isOpen, "new", {}, () => ({
    kind: "CONTACT" as RelationshipKind, relationshipId: "", segment: "", tags: "",
    tier: "" as "" | "STANDARD" | "SILVER" | "GOLD" | "PLATINUM" | "STRATEGIC",
    serviceLevel: "" as "" | "STANDARD" | "PRIORITY" | "PREMIUM" | "ENTERPRISE",
  }), "Customer onboarding", onClose, draft => JSON.stringify({ ...draft, segment: draft.segment.trim(), tags: draft.tags.split(",").map(value => value.trim()).filter(Boolean) }));
  const { kind, relationshipId, segment, tags, tier, serviceLevel } = lifecycle.draft;
  const update = <K extends keyof typeof lifecycle.draft>(key: K, value: typeof lifecycle.draft[K]) => lifecycle.setDraft(current => ({ ...current, [key]: value }));
  const setKind = (value: RelationshipKind) => update("kind", value);
  const setRelationshipId = (value: string) => update("relationshipId", value);
  const setSegment = (value: string) => update("segment", value);
  const setTags = (value: string) => update("tags", value);
  const setTier = (value: typeof tier) => update("tier", value);
  const setServiceLevel = (value: typeof serviceLevel) => update("serviceLevel", value);
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const submitting = lifecycle.pending;

  React.useEffect(() => { if (isOpen) { setError(""); setFieldErrors({}); } }, [isOpen]);

  const save = async (): Promise<boolean> => {
    if (!relationshipId) {
      setError(isVi ? "Chọn Contact hoặc Tổ chức." : "Select a Contact or Organization.");
      document.getElementById("customer-onboarding-source")?.focus();
      return false;
    }
    const operation = lifecycle.begin(); if (!operation) return false;
    setError(""); setFieldErrors({});
    try {
      const customer = await createCustomerCommand({
        relationshipRef: { type: kind, id: relationshipId },
        segment: segment.trim() || undefined,
        tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
        tier: tier || undefined,
        serviceLevel: serviceLevel || undefined,
      }, { idempotencyKey: lifecycle.intentId });
      if (!operation.isCurrent()) return false;
      operation.complete(); onCompleted(customer); onClose(); return true;
    } catch (caught) {
      if (operation.isCurrent()) {
        const presentation = presentApplicationError(caught, { locale: isVi ? "vi" : "en" }); setError(presentation.message);
        const fields=Object.fromEntries(Object.keys(presentation.error.fieldErrors ?? {}).map(key => [key.startsWith("relationshipRef") ? "source" : key, presentation.message]));
        setFieldErrors(fields); const first=Object.keys(fields)[0]; if(first) requestAnimationFrame(()=>document.getElementById(`customer-onboarding-${first}`)?.focus());
      }
      return false;
    } finally {
      operation.finish();
    }
  };

  lifecycle.bindSave(save);

  const options = kind === "CONTACT"
    ? contacts.map((contact) => ({ id: contact.id, label: `${contact.fullName || contact.name}${contact.email ? ` · ${contact.email}` : contact.phone ? ` · ${contact.phone}` : ""}` }))
    : organizations.map((organization) => ({ id: organization.id, label: `${organization.displayName}${organization.taxCode ? ` · ${organization.taxCode}` : ""}` }));

  return (
    <>
    <Modal variant="form" isOpen={isOpen} onClose={lifecycle.requestClose} size="md" title={isVi ? "Tạo Customer" : "Create Customer"}>
      <form onSubmit={event => { event.preventDefault(); void save(); }} className="crm-form-surface space-y-5">
        <fieldset className="contents" disabled={lifecycle.pending}>
        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-xs leading-5 text-violet-900">
          {isVi ? "Chọn Contact hoặc Tổ chức đã tồn tại. Backend kiểm tra quyền, workspace, trạng thái và chống tạo trùng theo danh tính nguồn." : "Select an existing Contact or Organization. The backend enforces access, workspace, eligibility, and source-identity uniqueness."}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label={isVi ? "Loại quan hệ" : "Relationship type"} value={kind} onChange={(event) => { setKind(event.target.value as RelationshipKind); setRelationshipId(""); }}>
            <option value="CONTACT">{isVi ? "B2C · Cá nhân" : "B2C · Contact"}</option>
            <option value="ORGANIZATION_ACCOUNT">{isVi ? "B2B · Tổ chức" : "B2B · Organization"}</option>
          </Select>
          <Select error={fieldErrors.source} id="customer-onboarding-source" label={isVi ? "Danh tính nguồn *" : "Source identity *"} value={relationshipId} onChange={(event) => setRelationshipId(event.target.value)} required>
            <option value="">{isVi ? "Chọn bản ghi" : "Select record"}</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Select>
          <Input id="customer-onboarding-segment" error={fieldErrors.segment} label={isVi ? "Phân khúc" : "Segment"} value={segment} onChange={(event) => setSegment(event.target.value)} />
          <Input id="customer-onboarding-tags" error={fieldErrors.tags} label={isVi ? "Nhãn (phân cách bằng dấu phẩy)" : "Tags (comma separated)"} value={tags} onChange={(event) => setTags(event.target.value)} />
          <Select id="customer-onboarding-tier" error={fieldErrors.tier} label={isVi ? "Hạng" : "Tier"} value={tier} onChange={(event) => setTier(event.target.value as typeof tier)}>
            <option value="">—</option><option value="STANDARD">STANDARD</option><option value="SILVER">SILVER</option><option value="GOLD">GOLD</option><option value="PLATINUM">PLATINUM</option><option value="STRATEGIC">STRATEGIC</option>
          </Select>
          <Select id="customer-onboarding-serviceLevel" error={fieldErrors.serviceLevel} label={isVi ? "Mức dịch vụ" : "Service level"} value={serviceLevel} onChange={(event) => setServiceLevel(event.target.value as typeof serviceLevel)}>
            <option value="">—</option><option value="STANDARD">STANDARD</option><option value="PRIORITY">PRIORITY</option><option value="PREMIUM">PREMIUM</option><option value="ENTERPRISE">ENTERPRISE</option>
          </Select>
        </div>
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div> : null}
        <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={lifecycle.requestClose} disabled={submitting}>{isVi ? "Hủy" : "Cancel"}</Button><Button type="submit" variant="primary" loading={submitting} disabled={submitting}>{isVi ? "Tạo Customer" : "Create Customer"}</Button></div>
        </fieldset>
      </form>
    </Modal>
    <ConfirmDialog isOpen={lifecycle.confirmOpen} onClose={() => lifecycle.setConfirmOpen(false)} onConfirm={lifecycle.discard}
      title={isVi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"} message={isVi ? "Các thay đổi chưa được lưu." : "Your changes have not been saved."}
      confirmText={isVi ? "Bỏ thay đổi" : "Discard changes"} cancelText={isVi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" />
    </>
  );
}
