import React from "react";
import { Button, Input, Modal, Select, Textarea } from "@/shared/components/ui";
import { getContactsSnapshot } from "@/modules/contacts";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import type { Customer } from "../../domain/model/customer.types";
import { onboardExistingCustomerWorkflow } from "@/workflows/customer-onboarding";
import { formatApplicationError } from "@/shared/operations";

interface ExistingCustomerOnboardingModalProps {
  isOpen: boolean;
  onClose(): void;
  actorId: string;
  isVi: boolean;
  onCompleted(customer: Customer): void;
}

type RelationshipKind = "CONTACT" | "ORGANIZATION_ACCOUNT";

export function ExistingCustomerOnboardingModal({ isOpen, onClose, actorId, isVi, onCompleted }: ExistingCustomerOnboardingModalProps) {
  const contacts = React.useMemo(() => getContactsSnapshot(), [isOpen]);
  const organizations = React.useMemo(() => getOrganizationAccountsSnapshot(), [isOpen]);
  const [kind, setKind] = React.useState<RelationshipKind>("CONTACT");
  const [relationshipId, setRelationshipId] = React.useState("");
  const [evidenceType, setEvidenceType] = React.useState<"EXTERNAL_PURCHASE_CONFIRMED" | "HISTORICAL_PURCHASE_IMPORTED">("EXTERNAL_PURCHASE_CONFIRMED");
  const [occurredAt, setOccurredAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [sourceSystem, setSourceSystem] = React.useState("Manual onboarding");
  const [sourceId, setSourceId] = React.useState("");
  const [externalCustomerRef, setExternalCustomerRef] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("VND");
  const [productSummary, setProductSummary] = React.useState("");
  const [documentRef, setDocumentRef] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) return;
    setRelationshipId("");
    setSourceId("");
    setExternalCustomerRef("");
    setAmount("");
    setProductSummary("");
    setDocumentRef("");
    setNote("");
    setError("");
  }, [isOpen]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!relationshipId) {
      setError(isVi ? "Chọn Contact hoặc Tổ chức." : "Select a Contact or Organization.");
      return;
    }
    try {
      const result = onboardExistingCustomerWorkflow({
        relationshipRef: { type: kind, id: relationshipId },
        evidenceType,
        occurredAt: `${occurredAt}T12:00:00.000Z`,
        sourceSystem,
        sourceId: sourceId.trim(),
        externalCustomerRef: externalCustomerRef.trim() || undefined,
        amount: amount.trim() ? Number(amount) : undefined,
        currency: currency.trim() || undefined,
        productSummary,
        documentRef,
        note,
        actorId,
      });
      onCompleted(result.customer);
      onClose();
    } catch (caught) {
      setError(formatApplicationError(caught, { locale: isVi ? "vi" : "en" }));
    }
  };

  const options = kind === "CONTACT"
    ? contacts.map((contact) => ({ id: contact.id, label: `${contact.fullName || contact.name}${contact.email ? ` · ${contact.email}` : contact.phone ? ` · ${contact.phone}` : ""}` }))
    : organizations.map((organization) => ({ id: organization.id, label: `${organization.displayName}${organization.taxCode ? ` · ${organization.taxCode}` : ""}` }));

  return (
    <Modal variant="form" isOpen={isOpen} onClose={onClose} size="md" title={isVi ? "Ghi nhận khách hàng hiện hữu" : "Onboard existing customer"}>
      <form onSubmit={submit} className="crm-form-surface space-y-5">
        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-xs leading-5 text-violet-900">
          {isVi ? "Customer chỉ được hệ thống tạo sau khi chọn Contact/Tổ chức và ghi nhận bằng chứng mua hàng hợp lệ." : "The system creates Customer only after an existing Contact/Organization and valid purchase evidence are selected."}
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
          <Select label={isVi ? "Loại bằng chứng" : "Evidence type"} value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as typeof evidenceType)}>
            <option value="EXTERNAL_PURCHASE_CONFIRMED">{isVi ? "Xác nhận mua ngoài CRM" : "External purchase confirmed"}</option>
            <option value="HISTORICAL_PURCHASE_IMPORTED">{isVi ? "Nhập giao dịch lịch sử" : "Historical purchase imported"}</option>
          </Select>
          <Input label={isVi ? "Ngày mua / ký hợp đồng *" : "Purchase / contract date *"} type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required />
          <Input label={isVi ? "Hệ thống nguồn *" : "Source system *"} value={sourceSystem} onChange={(event) => setSourceSystem(event.target.value)} required />
          <Input label={isVi ? "Mã giao dịch / hợp đồng *" : "Transaction / contract reference *"} value={sourceId} onChange={(event) => setSourceId(event.target.value)} required />
          <Input label={isVi ? "Mã khách hàng ngoài hệ thống" : "External customer reference"} value={externalCustomerRef} onChange={(event) => setExternalCustomerRef(event.target.value)} />
          <div className="grid grid-cols-[1fr_110px] gap-2"><Input label={isVi ? "Giá trị" : "Amount"} type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /><Input label={isVi ? "Tiền tệ" : "Currency"} value={currency} onChange={(event) => setCurrency(event.target.value)} /></div>
          <Input label={isVi ? "Sản phẩm / dịch vụ" : "Product / service"} value={productSummary} onChange={(event) => setProductSummary(event.target.value)} />
          <Input label={isVi ? "Số hóa đơn / tệp bằng chứng" : "Invoice / evidence reference"} value={documentRef} onChange={(event) => setDocumentRef(event.target.value)} />
        </div>
        <Textarea label={isVi ? "Ghi chú xác minh" : "Verification note"} value={note} onChange={(event) => setNote(event.target.value)} />
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div> : null}
        <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onClose}>{isVi ? "Hủy" : "Cancel"}</Button><Button type="submit" variant="primary">{isVi ? "Ghi nhận khách hàng" : "Create from evidence"}</Button></div>
      </form>
    </Modal>
  );
}
