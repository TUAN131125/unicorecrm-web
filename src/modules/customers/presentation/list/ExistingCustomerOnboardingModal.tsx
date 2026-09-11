import React from "react";
import { Button, Input, Modal, Select } from "@/shared/components/ui";
import { getContactsSnapshot } from "@/modules/contacts";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { formatApplicationError } from "@/shared/operations";
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
  const [kind, setKind] = React.useState<RelationshipKind>("CONTACT");
  const [relationshipId, setRelationshipId] = React.useState("");
  const [segment, setSegment] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [tier, setTier] = React.useState<"" | "STANDARD" | "SILVER" | "GOLD" | "PLATINUM" | "STRATEGIC">("");
  const [serviceLevel, setServiceLevel] = React.useState<"" | "STANDARD" | "PRIORITY" | "PREMIUM" | "ENTERPRISE">("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setRelationshipId("");
    setSegment("");
    setTags("");
    setTier("");
    setServiceLevel("");
    setError("");
    setSubmitting(false);
  }, [isOpen]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!relationshipId) {
      setError(isVi ? "Chọn Contact hoặc Tổ chức." : "Select a Contact or Organization.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const customer = await createCustomerCommand({
        relationshipRef: { type: kind, id: relationshipId },
        segment: segment.trim() || undefined,
        tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
        tier: tier || undefined,
        serviceLevel: serviceLevel || undefined,
      });
      onCompleted(customer);
      onClose();
    } catch (caught) {
      setError(formatApplicationError(caught, { locale: isVi ? "vi" : "en" }));
    } finally {
      setSubmitting(false);
    }
  };

  const options = kind === "CONTACT"
    ? contacts.map((contact) => ({ id: contact.id, label: `${contact.fullName || contact.name}${contact.email ? ` · ${contact.email}` : contact.phone ? ` · ${contact.phone}` : ""}` }))
    : organizations.map((organization) => ({ id: organization.id, label: `${organization.displayName}${organization.taxCode ? ` · ${organization.taxCode}` : ""}` }));

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} size="md" title={isVi ? "Tạo Customer" : "Create Customer"}>
      <form onSubmit={submit} className="crm-form-surface space-y-5">
        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-xs leading-5 text-violet-900">
          {isVi ? "Chọn Contact hoặc Tổ chức đã tồn tại. Backend kiểm tra quyền, workspace, trạng thái và chống tạo trùng theo danh tính nguồn." : "Select an existing Contact or Organization. The backend enforces access, workspace, eligibility, and source-identity uniqueness."}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label={isVi ? "Loại quan hệ" : "Relationship type"} value={kind} onChange={(event) => { setKind(event.target.value as RelationshipKind); setRelationshipId(""); }}>
            <option value="CONTACT">{isVi ? "B2C · Cá nhân" : "B2C · Contact"}</option>
            <option value="ORGANIZATION_ACCOUNT">{isVi ? "B2B · Tổ chức" : "B2B · Organization"}</option>
          </Select>
          <Select label={isVi ? "Danh tính nguồn *" : "Source identity *"} value={relationshipId} onChange={(event) => setRelationshipId(event.target.value)} required>
            <option value="">{isVi ? "Chọn bản ghi" : "Select record"}</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Select>
          <Input label={isVi ? "Phân khúc" : "Segment"} value={segment} onChange={(event) => setSegment(event.target.value)} />
          <Input label={isVi ? "Nhãn (phân cách bằng dấu phẩy)" : "Tags (comma separated)"} value={tags} onChange={(event) => setTags(event.target.value)} />
          <Select label={isVi ? "Hạng" : "Tier"} value={tier} onChange={(event) => setTier(event.target.value as typeof tier)}>
            <option value="">—</option><option value="STANDARD">STANDARD</option><option value="SILVER">SILVER</option><option value="GOLD">GOLD</option><option value="PLATINUM">PLATINUM</option><option value="STRATEGIC">STRATEGIC</option>
          </Select>
          <Select label={isVi ? "Mức dịch vụ" : "Service level"} value={serviceLevel} onChange={(event) => setServiceLevel(event.target.value as typeof serviceLevel)}>
            <option value="">—</option><option value="STANDARD">STANDARD</option><option value="PRIORITY">PRIORITY</option><option value="PREMIUM">PREMIUM</option><option value="ENTERPRISE">ENTERPRISE</option>
          </Select>
        </div>
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div> : null}
        <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>{isVi ? "Hủy" : "Cancel"}</Button><Button type="submit" variant="primary" loading={submitting} disabled={submitting}>{isVi ? "Tạo Customer" : "Create Customer"}</Button></div>
      </form>
    </Modal>
  );
}
