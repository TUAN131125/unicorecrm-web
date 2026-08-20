import React from "react";
import { Building2, Crown, ShieldCheck, UserRound } from "lucide-react";
import { Button, Input, Modal, SearchableSelect, Select, Textarea } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Contact } from "@/modules/contacts";
import type {
  OrganizationAccount,
  OrganizationAccountStatus,
  OrganizationRelationshipLevel,
} from "../../public/api";

export type OrganizationAccountFormMode = "create" | "edit";

export interface OrganizationAccountFormDraft {
  displayName: string;
  legalName: string;
  taxCode: string;
  industry: string;
  sizeBand: string;
  website: string;
  domain: string;
  phone: string;
  email: string;
  address: string;
  source: string;
  status: OrganizationAccountStatus;
  relationshipLevel: OrganizationRelationshipLevel;
  primaryContactId: string;
  notes: string;
  representativeName: string;
  representativeRole: string;
  representativeDepartment: string;
  representativePhone: string;
  representativeEmail: string;
}

export interface OrganizationAccountFormModalProps {
  isOpen: boolean;
  onClose(): void;
  mode: OrganizationAccountFormMode;
  account?: OrganizationAccount;
  representatives?: Contact[];
  onSubmit(draft: OrganizationAccountFormDraft): void;
  error?: string | null;
}

function emptyDraft(): OrganizationAccountFormDraft {
  return {
    displayName: "",
    legalName: "",
    taxCode: "",
    industry: "",
    sizeBand: "SME",
    website: "",
    domain: "",
    phone: "",
    email: "",
    address: "",
    source: "manual",
    status: "prospect",
    relationshipLevel: "new",
    primaryContactId: "",
    notes: "",
    representativeName: "",
    representativeRole: "",
    representativeDepartment: "",
    representativePhone: "",
    representativeEmail: "",
  };
}

function accountDraft(account?: OrganizationAccount): OrganizationAccountFormDraft {
  if (!account) return emptyDraft();
  return {
    ...emptyDraft(),
    displayName: account.displayName,
    legalName: account.legalName ?? "",
    taxCode: account.taxCode ?? "",
    industry: account.industry ?? "",
    sizeBand: account.sizeBand ?? "",
    website: account.website ?? "",
    domain: account.domain ?? "",
    phone: account.phone ?? "",
    email: account.email ?? "",
    address: account.address ?? "",
    source: account.source ?? "",
    status: account.status ?? "prospect",
    relationshipLevel: account.relationshipLevel ?? "new",
    primaryContactId: account.primaryContactId ?? "",
    notes: account.notes ?? "",
  };
}

function useDraftOnOpen(isOpen: boolean, account?: OrganizationAccount) {
  const createDraft = React.useCallback(() => accountDraft(account), [account]);
  const [draft, setDraft] = React.useState<OrganizationAccountFormDraft>(createDraft);
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !wasOpen.current) setDraft(createDraft());
    wasOpen.current = isOpen;
  }, [createDraft, isOpen]);

  return [draft, setDraft] as const;
}

export function OrganizationAccountFormModal({
  isOpen,
  onClose,
  mode,
  account,
  representatives = [],
  onSubmit,
  error,
}: OrganizationAccountFormModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const [draft, setDraft] = useDraftOnOpen(isOpen, account);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !wasOpen.current) setValidationErrors({});
    wasOpen.current = isOpen;
  }, [isOpen]);

  const update = React.useCallback(<K extends keyof OrganizationAccountFormDraft>(field: K, value: OrganizationAccountFormDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => ({ ...current, [field]: "" }));
  }, [setDraft]);

  const focusFirstInvalidField = React.useCallback((errors: Record<string, string>) => {
    const fieldOrder = ["displayName", "email", "representativeName", "representativePhone", "representativeEmail"];
    const firstField = fieldOrder.find((field) => Boolean(errors[field]));
    if (!firstField) return;
    requestAnimationFrame(() => {
      const control = document.getElementById(`organization-${mode}-${firstField}`);
      control?.scrollIntoView({ behavior: "smooth", block: "center" });
      control?.focus({ preventScroll: true });
    });
  }, [mode]);

  const normalizedDomain = React.useMemo(() => {
    if (draft.domain.trim()) return draft.domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!draft.website.trim()) return "";
    try {
      return new URL(draft.website.startsWith("http") ? draft.website : `https://${draft.website}`).hostname;
    } catch {
      return draft.website.trim().replace(/^https?:\/\//, "").split("/")[0] ?? "";
    }
  }, [draft.domain, draft.website]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!draft.displayName.trim()) nextErrors.displayName = vi ? "Vui lòng nhập tên tổ chức." : "Enter the organization name.";
    if (draft.email && !/\S+@\S+\.\S+/.test(draft.email)) nextErrors.email = vi ? "Email doanh nghiệp không hợp lệ." : "Business email is invalid.";
    if (mode === "create") {
      if (!draft.representativeName.trim()) nextErrors.representativeName = vi ? "Vui lòng nhập họ tên người đại diện chính." : "Enter the primary representative's name.";
      if (!draft.representativePhone.trim() && !draft.representativeEmail.trim()) {
        nextErrors.representativePhone = vi ? "Nhập số điện thoại hoặc email của người đại diện." : "Enter the representative's phone number or email.";
      }
      if (draft.representativeEmail && !/\S+@\S+\.\S+/.test(draft.representativeEmail)) {
        nextErrors.representativeEmail = vi ? "Email người đại diện không hợp lệ." : "Representative email is invalid.";
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      focusFirstInvalidField(nextErrors);
      return;
    }
    setValidationErrors({});
    onSubmit({
      ...draft,
      displayName: draft.displayName.trim(),
      domain: normalizedDomain,
    });
  };

  return (
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={mode === "create"
        ? (vi ? "Tạo tổ chức B2B" : "Create B2B organization")
        : (vi ? "Chỉnh sửa tổ chức B2B" : "Edit B2B organization")}
    >
      <form id={`organization-account-${mode}-form`} onSubmit={submit} className="crm-form-surface space-y-6 text-left">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Building2 size={17} /></span>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-slate-900">{vi ? "Thông tin tổ chức" : "Organization information"}</h3>
              {mode === "edit" && account ? <p className="mt-0.5 break-words text-[10px] text-slate-500 [overflow-wrap:anywhere]">{account.displayName}</p> : null}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input id={`organization-${mode}-displayName`} label={vi ? "Tên tổ chức" : "Organization name"} required value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} error={validationErrors.displayName} />
            <Input label={vi ? "Tên pháp lý" : "Legal name"} value={draft.legalName} onChange={(event) => update("legalName", event.target.value)} />
            <Input label={vi ? "Mã số thuế" : "Tax code"} value={draft.taxCode} onChange={(event) => update("taxCode", event.target.value)} />
            <Input label={vi ? "Ngành nghề" : "Industry"} value={draft.industry} onChange={(event) => update("industry", event.target.value)} />
            <Select label={vi ? "Quy mô" : "Size band"} value={draft.sizeBand} onChange={(event) => update("sizeBand", event.target.value)}>
              <option value="Micro">{vi ? "Siêu nhỏ" : "Micro"}</option>
              <option value="SME">{vi ? "Doanh nghiệp vừa và nhỏ" : "SME"}</option>
              <option value="Mid-market">{vi ? "Doanh nghiệp tầm trung" : "Mid-market"}</option>
              <option value="Enterprise">{vi ? "Doanh nghiệp lớn" : "Enterprise"}</option>
              <option value="Key Account">{vi ? "Khách hàng trọng điểm" : "Key Account"}</option>
            </Select>
            <Select label={vi ? "Trạng thái" : "Status"} value={draft.status} onChange={(event) => update("status", event.target.value as OrganizationAccountStatus)}>
              <option value="prospect">{vi ? "Tiềm năng" : "Prospect"}</option>
              <option value="active">{vi ? "Đang hoạt động" : "Active"}</option>
              <option value="strategic">{vi ? "Chiến lược" : "Strategic"}</option>
              {mode === "edit" ? <option value="inactive">{vi ? "Ngừng hoạt động" : "Inactive"}</option> : null}
              {mode === "edit" ? <option value="archived">{vi ? "Lưu trữ" : "Archived"}</option> : null}
            </Select>
            <Input label="Website" value={draft.website} onChange={(event) => update("website", event.target.value)} />
            <Input label={vi ? "Tên miền" : "Domain"} value={draft.domain} onChange={(event) => update("domain", event.target.value)} placeholder={normalizedDomain || "acme.vn"} />
            <Input label={vi ? "Điện thoại doanh nghiệp" : "Business phone"} value={draft.phone} onChange={(event) => update("phone", event.target.value)} />
            <Input id={`organization-${mode}-email`} label={vi ? "Email doanh nghiệp" : "Business email"} type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} error={validationErrors.email} />
            <Input label={vi ? "Nguồn" : "Source"} value={draft.source} onChange={(event) => update("source", event.target.value)} />
            <Input label={vi ? "Địa chỉ" : "Address"} value={draft.address} onChange={(event) => update("address", event.target.value)} />
          </div>
        </section>

        {mode === "create" ? (
          <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><UserRound size={17} /></span>
              <h3 className="text-xs font-semibold text-slate-900">{vi ? "Cá nhân đại diện chính" : "Primary representative"}</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input id={`organization-${mode}-representativeName`} label={vi ? "Họ tên người đại diện" : "Representative name"} required value={draft.representativeName} onChange={(event) => update("representativeName", event.target.value)} error={validationErrors.representativeName} />
              <Input label={vi ? "Vai trò / chức danh" : "Role / title"} value={draft.representativeRole} onChange={(event) => update("representativeRole", event.target.value)} />
              <Input label={vi ? "Phòng ban" : "Department"} value={draft.representativeDepartment} onChange={(event) => update("representativeDepartment", event.target.value)} />
              <Input id={`organization-${mode}-representativePhone`} label={vi ? "Số điện thoại" : "Phone number"} value={draft.representativePhone} onChange={(event) => update("representativePhone", event.target.value)} error={validationErrors.representativePhone} />
              <Input id={`organization-${mode}-representativeEmail`} label="Email" type="email" value={draft.representativeEmail} onChange={(event) => update("representativeEmail", event.target.value)} error={validationErrors.representativeEmail} />
              <div className="flex items-end">
                <div className="flex min-h-[42px] w-full items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-[10px] font-semibold text-violet-700">
                  <ShieldCheck size={14} />
                  {vi ? "Contact sẽ là đại diện chính và người ra quyết định." : "The contact becomes the primary representative and decision maker."}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Select label={vi ? "Mức quan hệ" : "Relationship level"} value={draft.relationshipLevel} onChange={(event) => update("relationshipLevel", event.target.value as OrganizationRelationshipLevel)}>
                <option value="new">{vi ? "Mới" : "New"}</option>
                <option value="developing">{vi ? "Đang phát triển" : "Developing"}</option>
                <option value="strong">{vi ? "Quan hệ tốt" : "Strong"}</option>
                <option value="strategic">{vi ? "Chiến lược" : "Strategic"}</option>
              </Select>
              <div>
                <SearchableSelect
                  label={vi ? "Người đại diện chính" : "Primary representative"}
                  value={draft.primaryContactId}
                  onChange={(value) => update("primaryContactId", value)}
                  placeholder={vi ? "Chưa chỉ định" : "Not assigned"}
                  searchPlaceholder={vi ? "Tìm người liên hệ..." : "Search contacts..."}
                  options={representatives.map((contact) => ({
                    value: contact.id,
                    label: contact.fullName || contact.name,
                    description: contact.roleTitle || contact.roleAtCompany || "Contact",
                    keywords: `${contact.email ?? ""} ${contact.phone ?? ""}`,
                  }))}
                />
              </div>
            </div>
            {draft.primaryContactId ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-700">
                <Crown size={13} />
                {vi ? "Cá nhân được chọn sẽ hiển thị là đại diện chính." : "The selected contact will be shown as the primary representative."}
              </div>
            ) : null}
          </section>
        )}

        <Textarea label={vi ? "Ghi chú account" : "Account notes"} value={draft.notes} onChange={(event) => update("notes", event.target.value)} rows={3} />

        {error ? <p className="text-xs text-slate-600" role="alert">{error}</p> : null}

        <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>{vi ? "Hủy" : "Cancel"}</Button>
          <Button type="submit" variant="primary">
            {mode === "create" ? (vi ? "Tạo tổ chức" : "Create organization") : (vi ? "Lưu thay đổi" : "Save changes")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
