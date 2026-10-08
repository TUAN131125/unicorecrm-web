import React from "react";
import { Building2, Crown, ShieldCheck, UserRound } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, SearchableSelect, Select, Textarea } from "@/shared/components/ui";
import { useBoundFormDraft } from "@/shared/hooks/useBoundFormDraft";
import { presentApplicationError } from "@/shared/operations";
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
  onSubmit(draft: OrganizationAccountFormDraft, opening: OrganizationAccount | undefined, isCurrent: () => boolean, intentId: string): void | Promise<void>;
  connected?: boolean;
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

export function OrganizationAccountFormModal({
  isOpen,
  onClose,
  mode: requestedMode,
  account,
  representatives = [],
  onSubmit,
  error,
  connected: requestedConnected = false,
}: OrganizationAccountFormModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const lifecycle = useBoundFormDraft(isOpen, `${requestedMode}:${account?.id ?? "new"}`, { account, mode: requestedMode, connected: requestedConnected }, () => accountDraft(account), "Organization", onClose);
  const { mode, connected } = lifecycle.opening.current;
  const openingAccount = lifecycle.opening.current.account;
  const { draft, setDraft } = lifecycle;
  const [submitError, setSubmitError] = React.useState("");
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const wasOpen = React.useRef(false);
  React.useEffect(() => { setValidationErrors({}); setSubmitError(""); }, [lifecycle.cycle]);

  React.useEffect(() => {
    if (isOpen && !wasOpen.current) setValidationErrors({});
    wasOpen.current = isOpen;
  }, [isOpen]);

  const update = React.useCallback(<K extends keyof OrganizationAccountFormDraft>(field: K, value: OrganizationAccountFormDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => ({ ...current, [field]: "" }));
  }, [setDraft]);

  const focusFirstInvalidField = React.useCallback((errors: Record<string, string>) => {
    const fieldOrder = ["displayName", "legalName", "taxCode", "industry", "sizeBand", "website", "domain", "phone", "email", "source", "address", "notes", "representativeName", "representativePhone", "representativeEmail"];
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

  const save = async (): Promise<boolean> => {
    if (lifecycle.pending) return false;
    const nextErrors: Record<string, string> = {};
    if (!draft.displayName.trim()) nextErrors.displayName = vi ? "Vui lòng nhập tên tổ chức." : "Enter the organization name.";
    if (draft.email && !/\S+@\S+\.\S+/.test(draft.email)) nextErrors.email = vi ? "Email doanh nghiệp không hợp lệ." : "Business email is invalid.";
    if (mode === "create" && !connected) {
      if (!draft.representativeName.trim()) nextErrors.representativeName = vi ? "Vui lòng nhập họ tên người đại diện chính." : "Enter the primary representative's name.";
      if (!draft.representativePhone.trim() && !draft.representativeEmail.trim()) {
        nextErrors.representativePhone = vi ? "Nhập số điện thoại hoặc email của người đại diện." : "Enter the representative's phone number or email.";
      }
      if (draft.representativeEmail && !/\S+@\S+\.\S+/.test(draft.representativeEmail)) {
        nextErrors.representativeEmail = vi ? "Email người đại diện không hợp lệ." : "Representative email is invalid.";
      }
    }
    if (connected && mode === "edit" && !draft.email.trim() && openingAccount?.email) nextErrors.email = "Business email is invalid.";
    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      focusFirstInvalidField(nextErrors);
      return false;
    }
    const operation = lifecycle.begin();
    if (!operation) return false;
    setValidationErrors({}); setSubmitError("");
    try { await onSubmit({
      ...draft,
      displayName: draft.displayName.trim(),
      domain: normalizedDomain,
    }, openingAccount, operation.isCurrent, lifecycle.intentId);
      if (!operation.isCurrent()) return false;
      operation.complete(); onClose(); return true;
    } catch (caught) {
      if (operation.isCurrent()) {
        const presentation = presentApplicationError(caught, { locale });
        setSubmitError(presentation.message);
        const fields = Object.fromEntries(Object.keys(presentation.error.fieldErrors ?? {}).map(key => [key, presentation.message]));
        setValidationErrors(fields); focusFirstInvalidField(fields);
      }
      return false;
    } finally { operation.finish(); }
  };
  lifecycle.bindSave(save);

  return (
    <>
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={lifecycle.requestClose}
      size="md"
      title={mode === "create"
        ? (vi ? "Tạo tổ chức B2B" : "Create B2B organization")
        : (vi ? "Chỉnh sửa tổ chức B2B" : "Edit B2B organization")}
    >
      <form id={`organization-account-${mode}-form`} data-organization-target-id={openingAccount?.id ?? "new"} onSubmit={event => { event.preventDefault(); void save(); }} className="crm-form-surface space-y-6 text-left">
        <fieldset className="contents" disabled={lifecycle.pending}>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Building2 size={17} /></span>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-slate-900">{vi ? "Thông tin tổ chức" : "Organization information"}</h3>
              {mode === "edit" && openingAccount ? <p className="mt-0.5 break-words text-[10px] text-slate-500 [overflow-wrap:anywhere]">{openingAccount.displayName}</p> : null}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input id={`organization-${mode}-displayName`} label={vi ? "Tên tổ chức" : "Organization name"} required value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} error={validationErrors.displayName} />
            <Input id={`organization-${mode}-legalName`} label={vi ? "Tên pháp lý" : "Legal name"} error={validationErrors.legalName} value={draft.legalName} onChange={(event) => update("legalName", event.target.value)} />
            <Input id={`organization-${mode}-taxCode`} label={vi ? "Mã số thuế" : "Tax code"} error={validationErrors.taxCode} value={draft.taxCode} onChange={(event) => update("taxCode", event.target.value)} />
            <Input id={`organization-${mode}-industry`} label={vi ? "Ngành nghề" : "Industry"} error={validationErrors.industry} value={draft.industry} onChange={(event) => update("industry", event.target.value)} />
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
            </Select>
            <Input id={`organization-${mode}-website`} label="Website" error={validationErrors.website} value={draft.website} onChange={(event) => update("website", event.target.value)} />
            <Input id={`organization-${mode}-domain`} label={vi ? "Tên miền" : "Domain"} error={validationErrors.domain} value={draft.domain} onChange={(event) => update("domain", event.target.value)} placeholder={normalizedDomain || "acme.vn"} />
            <Input id={`organization-${mode}-phone`} label={vi ? "Điện thoại doanh nghiệp" : "Business phone"} error={validationErrors.phone} value={draft.phone} onChange={(event) => update("phone", event.target.value)} />
            <Input id={`organization-${mode}-email`} label={vi ? "Email doanh nghiệp" : "Business email"} type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} error={validationErrors.email} />
            <Input id={`organization-${mode}-source`} label={vi ? "Nguồn" : "Source"} error={validationErrors.source} value={draft.source} onChange={(event) => update("source", event.target.value)} />
            <Input id={`organization-${mode}-address`} label={vi ? "Địa chỉ" : "Address"} error={validationErrors.address} value={draft.address} onChange={(event) => update("address", event.target.value)} />
          </div>
        </section>

        {mode === "create" && !connected ? (
          <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><UserRound size={17} /></span>
              <h3 className="text-xs font-semibold text-slate-900">{vi ? "Cá nhân đại diện chính" : "Primary representative"}</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input id={`organization-${mode}-representativeName`} label={vi ? "Họ tên người đại diện" : "Representative name"} required value={draft.representativeName} onChange={(event) => update("representativeName", event.target.value)} error={validationErrors.representativeName} />
              <Input id={`organization-${mode}-representativeRole`} label={vi ? "Vai trò / chức danh" : "Role / title"} error={validationErrors.representativeRole} value={draft.representativeRole} onChange={(event) => update("representativeRole", event.target.value)} />
              <Input id={`organization-${mode}-representativeDepartment`} label={vi ? "Phòng ban" : "Department"} error={validationErrors.representativeDepartment} value={draft.representativeDepartment} onChange={(event) => update("representativeDepartment", event.target.value)} />
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
        ) : mode === "edit" ? (
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
                  disabled={connected}
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
        ) : null}

        <Textarea id={`organization-${mode}-notes`} label={vi ? "Ghi chú account" : "Account notes"} error={validationErrors.notes} value={draft.notes} onChange={(event) => update("notes", event.target.value)} rows={3} />

        {submitError || error ? <p className="text-xs text-slate-600" role="alert">{submitError || error}</p> : null}

        <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={lifecycle.requestClose} disabled={lifecycle.pending}>{vi ? "Hủy" : "Cancel"}</Button>
          <Button type="submit" variant="primary" loading={lifecycle.pending} disabled={lifecycle.pending}>
            {mode === "create" ? (vi ? "Tạo tổ chức" : "Create organization") : (vi ? "Lưu thay đổi" : "Save changes")}
          </Button>
        </div>
        </fieldset>
      </form>
    </Modal>
    <ConfirmDialog isOpen={lifecycle.confirmOpen} onClose={() => lifecycle.setConfirmOpen(false)} onConfirm={lifecycle.discard}
      title={vi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"} message={vi ? "Các thay đổi chưa được lưu." : "Your changes have not been saved."}
      confirmText={vi ? "Bỏ thay đổi" : "Discard changes"} cancelText={vi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" />
    </>
  );
}
