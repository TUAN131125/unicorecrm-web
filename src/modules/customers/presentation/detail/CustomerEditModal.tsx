import React, { useState } from "react";
import { useBoundFormDraft } from "../hooks/useBoundFormDraft";
import { presentApplicationError } from "@/shared/operations";
import { Building2, ContactRound, HeartHandshake, Save, ShieldCheck } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, Select, Textarea } from "@/shared/components/ui";
import type { CustomerHealth, CustomerServiceLevel, CustomerStatus, CustomerTier } from "../../domain/model/customer.types";
import type { Customer360ReadModel } from "../model/customer360ReadModel";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";

export interface CustomerEditDraft {
  status: CustomerStatus;
  health: CustomerHealth;
  segment: string;
  tags: string;
  careOwnerId: string;
  nextCareAt: string;
  lastCareAt: string;
  tier: CustomerTier;
  serviceLevel: CustomerServiceLevel;
  careCadenceDays: string;

  displayName: string;
  email: string;
  phone: string;
  address: string;
  source: string;

  salutation: string;
  title: string;
  department: string;
  roleAtCompany: string;
  workEmail: string;
  personalEmail: string;
  mobilePhone: string;
  workPhone: string;
  otherPhone: string;
  zalo: string;
  facebook: string;
  preferredContactChannel: string;
  communicationConsent: boolean;
  doNotCall: boolean;
  doNotEmail: boolean;
  doNotSms: boolean;
  doNotZalo: boolean;
  doNotContact: boolean;
  doNotContactReason: string;
  decisionRole: string;
  relationshipLevel: string;
  painPoint: string;
  needSummary: string;
  consultingNote: string;
  followUpNote: string;
  contactNotes: string;

  legalName: string;
  taxCode: string;
  domain: string;
  website: string;
  industry: string;
  sizeBand: string;
  employeeCount: string;
  annualRevenue: string;
  organizationStatus: string;
  organizationRelationshipLevel: string;
  organizationNotes: string;
}

interface CustomerEditModalProps {
  isOpen: boolean;
  model: Customer360ReadModel;
  isVi: boolean;
  customerFieldsOnly?: boolean;
  onClose(): void;
  onSave(draft: CustomerEditDraft, opening: Customer360ReadModel, isCurrent: () => boolean, intentId: string): void | Promise<void>;
}

function toDateInput(value?: string): string {
  return value ? value.slice(0, 10) : "";
}

export function createCustomerEditDraft(model: Customer360ReadModel): CustomerEditDraft {
  const contact = model.identity.contact ?? model.identity.primaryContact;
  const organization = model.identity.organization;
  return {
    status: model.customer.status,
    health: model.customer.health ?? "WATCH",
    segment: model.customer.segment ?? "",
    tags: model.customer.tags.join(", "),
    careOwnerId: model.customer.careOwnerId || model.identity.ownerId || "",
    nextCareAt: toDateInput(model.customer.nextCareAt),
    lastCareAt: toDateInput(model.customer.lastCareAt),
    tier: model.customer.tier ?? "STANDARD",
    serviceLevel: model.customer.serviceLevel ?? "STANDARD",
    careCadenceDays: model.customer.careCadenceDays === undefined ? "30" : String(model.customer.careCadenceDays),

    displayName: model.identity.displayName,
    email: model.identity.email ?? "",
    phone: model.identity.phone ?? "",
    address: model.identity.address ?? "",
    source: contact?.source || organization?.source || "",

    salutation: contact?.salutation ?? "",
    title: contact?.roleTitle || contact?.title || "",
    department: contact?.department ?? "",
    roleAtCompany: contact?.roleAtCompany ?? "",
    workEmail: contact?.workEmail ?? "",
    personalEmail: contact?.personalEmail ?? "",
    mobilePhone: contact?.mobilePhone ?? "",
    workPhone: contact?.workPhone ?? "",
    otherPhone: contact?.otherPhone ?? "",
    zalo: contact?.zalo || contact?.zaloId || "",
    facebook: contact?.facebook ?? "",
    preferredContactChannel: contact?.preferredContactChannel || contact?.preferredChannel || "",
    communicationConsent: contact?.communicationConsent ?? true,
    doNotCall: contact?.doNotCall ?? false,
    doNotEmail: contact?.doNotEmail ?? false,
    doNotSms: contact?.doNotSms ?? false,
    doNotZalo: contact?.doNotZalo ?? false,
    doNotContact: contact?.doNotContact ?? false,
    doNotContactReason: contact?.doNotContactReason ?? "",
    decisionRole: contact?.decisionRole ?? "",
    relationshipLevel: contact?.relationshipLevel ?? "",
    painPoint: contact?.painPoint ?? "",
    needSummary: contact?.needSummary ?? "",
    consultingNote: contact?.consultingNote ?? "",
    followUpNote: contact?.followUpNote ?? "",
    contactNotes: contact?.notes ?? "",

    legalName: organization?.legalName ?? "",
    taxCode: organization?.taxCode ?? "",
    domain: organization?.domain ?? "",
    website: organization?.website ?? "",
    industry: organization?.industry ?? "",
    sizeBand: organization?.sizeBand ?? "",
    employeeCount: organization?.employeeCount === undefined ? "" : String(organization.employeeCount),
    annualRevenue: organization?.annualRevenue === undefined ? "" : String(organization.annualRevenue),
    organizationStatus: organization?.status ?? "",
    organizationRelationshipLevel: organization?.relationshipLevel ?? "",
    organizationNotes: organization?.notes ?? "",
  };
}

function customerDraftFingerprint(draft: CustomerEditDraft): string {
  return JSON.stringify({ ...draft, tags: draft.tags.split(",").map(value => value.trim()).filter(Boolean) },
    (_key, value: unknown) => typeof value === "string" ? value.trim() : value);
}

export const CustomerEditModal: React.FC<CustomerEditModalProps> = ({ isOpen, model, isVi, customerFieldsOnly = true, onClose, onSave }) => {
  const lifecycle = useBoundFormDraft(isOpen, model.customer.id, { model, customerFieldsOnly }, () => createCustomerEditDraft(model), "Customer edit", onClose, customerDraftFingerprint);
  const { draft, setDraft } = lifecycle;
  const openingModel = lifecycle.opening.current.model;
  const openingCustomerFieldsOnly = lifecycle.opening.current.customerFieldsOnly;
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  React.useEffect(() => { setError(""); setFieldErrors({}); }, [lifecycle.cycle]);
  const formRef = React.useRef<HTMLFormElement>(null);
  const focusInvalid = (fields: Record<string, string>) => requestAnimationFrame(() => {
    const controls = formRef.current?.querySelectorAll<HTMLInputElement>("[data-customer-field]");
    const control = Array.from(controls ?? []).find(item => Boolean(fields[item.dataset.customerField ?? ""]));
    control?.focus();
  });
  const save = async (): Promise<boolean> => {
    const errors: Record<string, string> = {};
    if (!openingCustomerFieldsOnly && !draft.displayName.trim()) errors.displayName = isVi ? "Nhập tên hiển thị." : "Enter a display name.";
    if (!openingCustomerFieldsOnly && (!Number.isFinite(Number(draft.careCadenceDays)) || Number(draft.careCadenceDays) < 1 || Number(draft.careCadenceDays) > 365)) errors.careCadenceDays = isVi ? "Nhập từ 1 đến 365 ngày." : "Enter 1 to 365 days.";
    if (Object.keys(errors).length) { setFieldErrors(errors); focusInvalid(errors); return false; }
    const operation = lifecycle.begin(); if (!operation) return false;
    setError(""); setFieldErrors({});
    try {
      await onSave(draft, openingModel, operation.isCurrent, lifecycle.intentId);
      if (!operation.isCurrent()) return false;
      operation.complete(); onClose(); return true;
    } catch (caught) {
      if (operation.isCurrent()) {
        const presentation = presentApplicationError(caught, { locale: isVi ? "vi" : "en" }); setError(presentation.message);
        const fields = Object.fromEntries(Object.keys(presentation.error.fieldErrors ?? {}).map(key => [key, presentation.message]));
        setFieldErrors(fields); focusInvalid(fields);
      }
      return false;
    } finally { operation.finish(); }
  };
  lifecycle.bindSave(save);
  const update = <K extends keyof CustomerEditDraft>(key: K, value: CustomerEditDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={lifecycle.requestClose}
      title={isVi ? "Chỉnh sửa hồ sơ Customer 360" : "Edit Customer 360 profile"}
      size="lg"
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={lifecycle.requestClose} disabled={lifecycle.pending}>{isVi ? "Hủy" : "Cancel"}</Button>
          <Button type="submit" variant="primary" form="customer-full-edit-form" loading={lifecycle.pending} disabled={lifecycle.pending} icon={<Save size={13} />}>{isVi ? "Lưu toàn bộ thay đổi" : "Save all changes"}</Button>
        </>
      )}
    >
      <form
        id="customer-full-edit-form" ref={formRef} data-customer-target-id={lifecycle.targetId}
        className="crm-form-surface space-y-6 text-left"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset className="contents" disabled={lifecycle.pending}>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-[11px] font-semibold text-indigo-800">
          {isVi
            ? openingCustomerFieldsOnly ? "Chỉnh sửa thông tin quan hệ Customer tại đây. Thông tin liên hệ và tổ chức được chỉnh sửa tại hồ sơ nguồn." : "Customer 360 điều phối cập nhật nhưng dữ liệu vẫn được ghi về đúng owner: Customer lifecycle, Contact hoặc Organization."
            : openingCustomerFieldsOnly ? "Edit Customer relationship information here. Edit contact and organization information in their source profiles." : "Customer 360 coordinates the edit while data is written back to the correct owner: Customer lifecycle, Contact or Organization."}
        </div>

        <FormSection icon={<HeartHandshake size={15} />} title={isVi ? "Quan hệ Customer" : "Customer relationship"}>
          <Select label={isVi ? "Trạng thái" : "Status"} value={draft.status} data-customer-field="status" disabled={openingModel.customer.onboardingStatus !== "COMPLETED"} onChange={(event) => update("status", event.target.value as CustomerStatus)}>
            {(openingCustomerFieldsOnly
              ? (["ACTIVE", "INACTIVE"] as CustomerStatus[])
              : (["ACTIVE", "INACTIVE"] as CustomerStatus[])
            ).map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          {!openingCustomerFieldsOnly && <Select disabled label={isVi ? "Sức khỏe" : "Health"} value={draft.health} data-customer-field="health" onChange={(event) => update("health", event.target.value as CustomerHealth)}>
            {(["GOOD", "WATCH", "RISK"] as CustomerHealth[]).map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>}
          <Input label={isVi ? "Phân khúc" : "Segment"} value={draft.segment} data-customer-field="segment" onChange={(event) => update("segment", event.target.value)} />
          <Input label={isVi ? "Nhãn, cách nhau bằng dấu phẩy" : "Tags, comma separated"} value={draft.tags} data-customer-field="tags" onChange={(event) => update("tags", event.target.value)} />
          {!openingCustomerFieldsOnly && <Select disabled label={isVi ? "Người phụ trách quan hệ" : "Relationship owner"} value={draft.careOwnerId} data-customer-field="careOwnerId" onChange={(event) => update("careOwnerId", event.target.value)} required>
            <option value="">{isVi ? "Chọn người phụ trách" : "Select owner"}</option>
            {getWorkspaceMemberOptions().map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </Select>}
          {!openingCustomerFieldsOnly && <Input disabled label={isVi ? "Chăm sóc tiếp theo" : "Next care"} type="date" value={draft.nextCareAt} data-customer-field="nextCareAt" onChange={(event) => update("nextCareAt", event.target.value)} />}
          {!openingCustomerFieldsOnly && <Input disabled label={isVi ? "Chăm sóc gần nhất" : "Latest care"} type="date" value={draft.lastCareAt} data-customer-field="lastCareAt" onChange={(event) => update("lastCareAt", event.target.value)} />}
          <Select label={isVi ? "Hạng khách hàng" : "Customer tier"} value={draft.tier} data-customer-field="tier" onChange={(event) => update("tier", event.target.value as CustomerTier)}>
            {(["STANDARD", "SILVER", "GOLD", "PLATINUM", "STRATEGIC"] as CustomerTier[]).map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select label={isVi ? "Mức dịch vụ" : "Service level"} value={draft.serviceLevel} data-customer-field="serviceLevel" onChange={(event) => update("serviceLevel", event.target.value as CustomerServiceLevel)}>
            {(["STANDARD", "PRIORITY", "PREMIUM", "ENTERPRISE"] as CustomerServiceLevel[]).map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          {!openingCustomerFieldsOnly && <Input disabled label={isVi ? "Chu kỳ chăm sóc (ngày)" : "Care cadence (days)"} type="number" min={1} max={365} value={draft.careCadenceDays} data-customer-field="careCadenceDays" onChange={(event) => update("careCadenceDays", event.target.value)} />}
          {openingModel.customer.onboardingStatus !== "COMPLETED" && <p className="col-span-full text-xs font-medium text-amber-700">{isVi ? "Hoàn tất onboarding trước khi thay đổi trạng thái Customer." : "Complete onboarding before changing Customer status."}</p>}
        </FormSection>

        {!openingCustomerFieldsOnly && <><FormSection icon={<ContactRound size={15} />} title={isVi ? "Nhận dạng và kênh liên hệ" : "Identity and communication"}>
          <Input label={isVi ? "Tên hiển thị" : "Display name"} value={draft.displayName} data-customer-field="displayName" onChange={(event) => update("displayName", event.target.value)} required />
          <Input label={isVi ? "Nguồn" : "Source"} value={draft.source} data-customer-field="source" onChange={(event) => update("source", event.target.value)} />
          <Input label="Email" type="email" value={draft.email} data-customer-field="email" onChange={(event) => update("email", event.target.value)} />
          <Input label={isVi ? "Điện thoại chính" : "Primary phone"} value={draft.phone} data-customer-field="phone" onChange={(event) => update("phone", event.target.value)} />
          <Input label={isVi ? "Địa chỉ" : "Address"} value={draft.address} data-customer-field="address" onChange={(event) => update("address", event.target.value)} />
          <Input label={isVi ? "Danh xưng" : "Salutation"} value={draft.salutation} data-customer-field="salutation" onChange={(event) => update("salutation", event.target.value)} />
          <Input label={isVi ? "Chức danh" : "Job title"} value={draft.title} data-customer-field="title" onChange={(event) => update("title", event.target.value)} />
          <Input label={isVi ? "Bộ phận" : "Department"} value={draft.department} data-customer-field="department" onChange={(event) => update("department", event.target.value)} />
          <Input label={isVi ? "Vai trò tại công ty" : "Role at company"} value={draft.roleAtCompany} data-customer-field="roleAtCompany" onChange={(event) => update("roleAtCompany", event.target.value)} />
          <Input label={isVi ? "Email công việc" : "Work email"} type="email" value={draft.workEmail} data-customer-field="workEmail" onChange={(event) => update("workEmail", event.target.value)} />
          <Input label={isVi ? "Email cá nhân" : "Personal email"} type="email" value={draft.personalEmail} data-customer-field="personalEmail" onChange={(event) => update("personalEmail", event.target.value)} />
          <Input label={isVi ? "Di động" : "Mobile phone"} value={draft.mobilePhone} data-customer-field="mobilePhone" onChange={(event) => update("mobilePhone", event.target.value)} />
          <Input label={isVi ? "Điện thoại công việc" : "Work phone"} value={draft.workPhone} data-customer-field="workPhone" onChange={(event) => update("workPhone", event.target.value)} />
          <Input label={isVi ? "Điện thoại khác" : "Other phone"} value={draft.otherPhone} data-customer-field="otherPhone" onChange={(event) => update("otherPhone", event.target.value)} />
          <Input label="Zalo" value={draft.zalo} data-customer-field="zalo" onChange={(event) => update("zalo", event.target.value)} />
          <Input label="Facebook" value={draft.facebook} data-customer-field="facebook" onChange={(event) => update("facebook", event.target.value)} />
          <Select label={isVi ? "Kênh ưu tiên" : "Preferred channel"} value={draft.preferredContactChannel} data-customer-field="preferredContactChannel" onChange={(event) => update("preferredContactChannel", event.target.value)}>
            <option value="">—</option><option value="phone">{isVi ? "Điện thoại" : "Phone"}</option><option value="email">Email</option><option value="zalo">Zalo</option><option value="facebook">Facebook</option><option value="sms">SMS</option>
          </Select>
          <Select label={isVi ? "Vai trò quyết định" : "Decision role"} value={draft.decisionRole} data-customer-field="decisionRole" onChange={(event) => update("decisionRole", event.target.value)}>
            <option value="">—</option><option value="decision_maker">{isVi ? "Người ra quyết định" : "Decision maker"}</option><option value="influencer">{isVi ? "Người ảnh hưởng" : "Influencer"}</option><option value="user">{isVi ? "Người sử dụng" : "User"}</option><option value="buyer">{isVi ? "Người mua" : "Buyer"}</option><option value="technical">{isVi ? "Phụ trách kỹ thuật" : "Technical"}</option><option value="finance">{isVi ? "Phụ trách tài chính" : "Finance"}</option><option value="other">{isVi ? "Khác" : "Other"}</option>
          </Select>
          <Select label={isVi ? "Mức độ quan hệ" : "Relationship level"} value={draft.relationshipLevel} data-customer-field="relationshipLevel" onChange={(event) => update("relationshipLevel", event.target.value)}>
            <option value="">—</option><option value="cold">{isVi ? "Chưa có quan hệ" : "Cold"}</option><option value="warm">{isVi ? "Đang xây dựng" : "Warm"}</option><option value="good">{isVi ? "Tốt" : "Good"}</option><option value="strong">{isVi ? "Gắn kết" : "Strong"}</option><option value="vip">VIP</option>
          </Select>
        </FormSection>

        <FormSection icon={<ShieldCheck size={15} />} title={isVi ? "Đồng ý liên hệ và bối cảnh chăm sóc" : "Communication consent and relationship context"}>
          <BooleanField label={isVi ? "Đồng ý nhận liên hệ" : "Communication consent"} checked={draft.communicationConsent} onChange={(value) => update("communicationConsent", value)} />
          <BooleanField label={isVi ? "Không gọi điện" : "Do not call"} checked={draft.doNotCall} onChange={(value) => update("doNotCall", value)} />
          <BooleanField label={isVi ? "Không gửi email" : "Do not email"} checked={draft.doNotEmail} onChange={(value) => update("doNotEmail", value)} />
          <BooleanField label={isVi ? "Không gửi SMS" : "Do not SMS"} checked={draft.doNotSms} onChange={(value) => update("doNotSms", value)} />
          <BooleanField label={isVi ? "Không nhắn Zalo" : "Do not Zalo"} checked={draft.doNotZalo} onChange={(value) => update("doNotZalo", value)} />
          <BooleanField label={isVi ? "Không liên hệ" : "Do not contact"} checked={draft.doNotContact} onChange={(value) => update("doNotContact", value)} />
          <Input label={isVi ? "Lý do hạn chế liên hệ" : "Contact restriction reason"} value={draft.doNotContactReason} data-customer-field="doNotContactReason" onChange={(event) => update("doNotContactReason", event.target.value)} />
          <Textarea label={isVi ? "Nhu cầu / Vấn đề cần giải quyết" : "Pain point"} value={draft.painPoint} data-customer-field="painPoint" onChange={(event) => update("painPoint", event.target.value)} rows={3} />
          <Textarea label={isVi ? "Tóm tắt nhu cầu" : "Need summary"} value={draft.needSummary} data-customer-field="needSummary" onChange={(event) => update("needSummary", event.target.value)} rows={3} />
          <Textarea label={isVi ? "Ghi chú tư vấn" : "Consulting note"} value={draft.consultingNote} data-customer-field="consultingNote" onChange={(event) => update("consultingNote", event.target.value)} rows={3} />
          <Textarea label={isVi ? "Ghi chú theo dõi" : "Follow-up note"} value={draft.followUpNote} data-customer-field="followUpNote" onChange={(event) => update("followUpNote", event.target.value)} rows={3} />
          <Textarea label={isVi ? "Ghi chú hồ sơ Contact" : "Contact profile notes"} value={draft.contactNotes} data-customer-field="contactNotes" onChange={(event) => update("contactNotes", event.target.value)} rows={4} />
        </FormSection>

        {openingModel.customer.type === "B2B" && (
          <FormSection icon={<Building2 size={15} />} title={isVi ? "Thông tin tổ chức B2B" : "B2B organization information"}>
            <Input label={isVi ? "Tên pháp lý" : "Legal name"} value={draft.legalName} data-customer-field="legalName" onChange={(event) => update("legalName", event.target.value)} />
            <Input label={isVi ? "Mã số thuế" : "Tax code"} value={draft.taxCode} data-customer-field="taxCode" onChange={(event) => update("taxCode", event.target.value)} />
            <Input label="Domain" value={draft.domain} data-customer-field="domain" onChange={(event) => update("domain", event.target.value)} />
            <Input label="Website" value={draft.website} data-customer-field="website" onChange={(event) => update("website", event.target.value)} />
            <Input label={isVi ? "Ngành nghề" : "Industry"} value={draft.industry} data-customer-field="industry" onChange={(event) => update("industry", event.target.value)} />
            <Input label={isVi ? "Quy mô" : "Size band"} value={draft.sizeBand} data-customer-field="sizeBand" onChange={(event) => update("sizeBand", event.target.value)} />
            <Input label={isVi ? "Số nhân viên" : "Employee count"} type="number" min="0" value={draft.employeeCount} data-customer-field="employeeCount" onChange={(event) => update("employeeCount", event.target.value)} />
            <Input label={isVi ? "Doanh thu năm" : "Annual revenue"} type="number" min="0" value={draft.annualRevenue} data-customer-field="annualRevenue" onChange={(event) => update("annualRevenue", event.target.value)} />
            <Select label={isVi ? "Trạng thái tổ chức" : "Organization status"} value={draft.organizationStatus} data-customer-field="organizationStatus" onChange={(event) => update("organizationStatus", event.target.value)}>
              <option value="">—</option><option value="prospect">Prospect</option><option value="active">Active</option><option value="strategic">Strategic</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
            </Select>
            <Select label={isVi ? "Mức độ quan hệ tổ chức" : "Organization relationship"} value={draft.organizationRelationshipLevel} data-customer-field="organizationRelationshipLevel" onChange={(event) => update("organizationRelationshipLevel", event.target.value)}>
              <option value="">—</option><option value="new">New</option><option value="developing">Developing</option><option value="strong">Strong</option><option value="strategic">Strategic</option>
            </Select>
            <Textarea label={isVi ? "Ghi chú tổ chức" : "Organization notes"} value={draft.organizationNotes} data-customer-field="organizationNotes" onChange={(event) => update("organizationNotes", event.target.value)} rows={5} />
          </FormSection>
        )}</>}
        {error ? <p role="alert">{error}</p> : null}
        {Object.entries(fieldErrors).map(([field, message]) => <p role="alert" key={field}>{field}: {message}</p>)}
        </fieldset>
      </form>
    </Modal>
    <ConfirmDialog isOpen={lifecycle.confirmOpen} onClose={() => lifecycle.setConfirmOpen(false)} onConfirm={lifecycle.discard}
      title={isVi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"} message={isVi ? "Các thay đổi chưa được lưu." : "Your changes have not been saved."}
      confirmText={isVi ? "Bỏ thay đổi" : "Discard changes"} cancelText={isVi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" />
    </>
  );
};

const FormSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-indigo-600">
      {icon}
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">{title}</h3>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  </section>
);

const BooleanField: React.FC<{ label: string; checked: boolean; onChange(value: boolean): void }> = ({ label, checked, onChange }) => (
  <label className="flex min-h-[42px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
  </label>
);
