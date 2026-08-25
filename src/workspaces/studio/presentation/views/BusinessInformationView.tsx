import React from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  Landmark,
  MailCheck,
  MapPin,
  PackageOpen,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Store,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { ConfirmDialog } from "@/shared/components/ui";
import {
  type BusinessAddress,
  type BusinessAddressPurpose,
  type WorkspaceBusinessInformation,
  useWorkspaceOperationalConfiguration,
} from "@/platform/workspace-config";
import { updateStudioBusinessInformation } from "../../public/studioCore";
import { cn } from "@/shared/lib/classnames/cn";
import { formatApplicationError } from "@/shared/operations";
import {
  StudioMetricCard,
  StudioMetricsGrid,
} from "../components/StudioExperiencePrimitives";
import {
  StudioButton,
  StudioField,
  StudioInput,
  StudioPageFrame,
  StudioSaveBar,
  StudioSection,
  StudioStatus,
  StudioSwitch,
} from "../components/StudioPrimitives";

const PURPOSES: BusinessAddressPurpose[] = ["REGISTERED", "OPERATING", "INVOICE", "PICKUP", "RETURN"];

const purposeIcons: Record<BusinessAddressPurpose, React.ReactNode> = {
  REGISTERED: <BadgeCheck size={18} aria-hidden="true" />,
  OPERATING: <Store size={18} aria-hidden="true" />,
  INVOICE: <ReceiptText size={18} aria-hidden="true" />,
  PICKUP: <PackageOpen size={18} aria-hidden="true" />,
  RETURN: <RotateCcw size={18} aria-hidden="true" />,
};

function BusinessProfileGroup({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.55)]">
      <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function AddressPurposeCard({
  label,
  description,
  icon,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  disabled: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <label
      className={cn(
        "relative flex min-h-[112px] gap-3 rounded-xl border p-3.5 transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        checked
          ? "border-violet-300 bg-violet-50/75 shadow-[0_10px_24px_-22px_rgba(124,58,237,0.85)]"
          : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30",
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", checked ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600")}>{icon}</span>
      <span className="min-w-0 pr-6">
        <span className="block text-sm font-medium text-slate-950">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <span className={cn("absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border", checked ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white text-transparent")} aria-hidden="true">
        <Check size={12} />
      </span>
    </label>
  );
}

export function BusinessInformationView() {
  const { t, locale } = useI18n();
  const text = React.useCallback((vi: string, en: string) => locale === "vi" ? vi : en, [locale]);
  const access = useEffectiveAccess();
  const configuration = useWorkspaceOperationalConfiguration();
  const canConfigure = access.can(CAPABILITIES.STUDIO_CONFIGURE);
  const [business, setBusiness] = React.useState<WorkspaceBusinessInformation>(configuration.businessInformation);
  const [addresses, setAddresses] = React.useState<BusinessAddress[]>(configuration.addresses);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [addressPendingRemoval, setAddressPendingRemoval] = React.useState<string | null>(null);
  const [expandedAddressId, setExpandedAddressId] = React.useState<string | null>(configuration.addresses[0]?.id ?? null);
  const displayNameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setBusiness(configuration.businessInformation);
    setAddresses(configuration.addresses);
  }, [configuration.businessInformation, configuration.addresses]);

  const updateBusiness = (key: keyof WorkspaceBusinessInformation, value: string) => setBusiness((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(business) !== JSON.stringify(configuration.businessInformation)
    || JSON.stringify(addresses) !== JSON.stringify(configuration.addresses);

  const save = async (): Promise<boolean> => {
    if (!business.displayName.trim()) {
      setError(t("studio.validation.displayNameRequired"));
      displayNameRef.current?.focus();
      return false;
    }
    setSaving(true);
    setMessage("");
    try {
      await updateStudioBusinessInformation(business, addresses);
      setError("");
      setMessage(t("common.updatedSuccessfully"));
      return true;
    } catch (cause) {
      // MA-08: a configuration refusal carries an internal diagnostic. The central
      // formatter owns what the user is shown; the fallback keeps this feature's own wording
      // for everything else.
      setError(formatApplicationError(cause, {
        locale,
        fallbackMessage: text("Không thể lưu cấu hình doanh nghiệp.", "Unable to save business configuration."),
      }));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addAddress = () => {
    const id = `address-${crypto.randomUUID()}`;
    setAddresses((current) => [...current, {
      id,
      name: "",
      purposes: [],
      addressLine1: "",
      addressLine2: "",
      countryCode: configuration.localeRegion.countryCode,
      provinceCode: "",
      districtCode: "",
      wardCode: "",
      postalCode: "",
      contactName: "",
      contactPhone: "",
      active: true,
    }]);
    setExpandedAddressId(id);
  };

  const updateAddress = (id: string, patch: Partial<BusinessAddress>) => setAddresses((current) => current.map((address) => address.id === id ? { ...address, ...patch } : address));
  const removeAddress = (id: string) => {
    setAddresses((current) => current.filter((address) => address.id !== id));
    setAddressPendingRemoval(null);
  };

  const profileSection = (
    <StudioSection title={t("studio.business.profile")}>
      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <BusinessProfileGroup icon={<Building2 size={18} />} title={text("Nhận diện", "Identity")}>
          <StudioField label={t("studio.business.displayName")}><StudioInput ref={displayNameRef} disabled={!canConfigure} value={business.displayName} onChange={(event) => updateBusiness("displayName", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.tradingName")}><StudioInput disabled={!canConfigure} value={business.tradingName} onChange={(event) => updateBusiness("tradingName", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.industry")}><StudioInput disabled={!canConfigure} value={business.industry} onChange={(event) => updateBusiness("industry", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.logoReference")}><StudioInput disabled={!canConfigure} value={business.logoReference} onChange={(event) => updateBusiness("logoReference", event.target.value)} /></StudioField>
        </BusinessProfileGroup>
        <BusinessProfileGroup icon={<Landmark size={18} />} title={text("Thông tin pháp lý", "Legal details")}>
          <StudioField label={t("studio.business.legalName")}><StudioInput disabled={!canConfigure} value={business.legalName} onChange={(event) => updateBusiness("legalName", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.registrationNumber")}><StudioInput disabled={!canConfigure} value={business.registrationNumber} onChange={(event) => updateBusiness("registrationNumber", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.taxId")}><StudioInput disabled={!canConfigure} value={business.taxId} onChange={(event) => updateBusiness("taxId", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.representative")}><StudioInput disabled={!canConfigure} value={business.representativeName} onChange={(event) => updateBusiness("representativeName", event.target.value)} /></StudioField>
        </BusinessProfileGroup>
        <BusinessProfileGroup icon={<MailCheck size={18} />} title={text("Kênh liên hệ", "Contact channels")}>
          <StudioField label={t("studio.business.phone")}><StudioInput disabled={!canConfigure} value={business.phone} onChange={(event) => updateBusiness("phone", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.email")}><StudioInput type="email" disabled={!canConfigure} value={business.email} onChange={(event) => updateBusiness("email", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.supportEmail")}><StudioInput type="email" disabled={!canConfigure} value={business.supportEmail} onChange={(event) => updateBusiness("supportEmail", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.billingEmail")}><StudioInput type="email" disabled={!canConfigure} value={business.billingEmail} onChange={(event) => updateBusiness("billingEmail", event.target.value)} /></StudioField>
          <StudioField label={t("studio.business.website")}><StudioInput type="url" disabled={!canConfigure} value={business.website} onChange={(event) => updateBusiness("website", event.target.value)} /></StudioField>
        </BusinessProfileGroup>
      </div>
    </StudioSection>
  );

  const addressSection = (
    <StudioSection
      title={t("studio.business.addressBook")}
      actions={canConfigure ? <StudioButton tone="accent" icon={<Plus size={15} />} onClick={addAddress}>{t("common.add")}</StudioButton> : undefined}
    >
      <div className="space-y-3">
        {addresses.map((address) => (
          <details
            key={address.id}
            open={expandedAddressId === address.id}
            onToggle={(event) => setExpandedAddressId(event.currentTarget.open ? address.id : null)}
            className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/45 open:bg-white"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20">
              <span className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><MapPin size={18} /></span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="block text-sm font-semibold text-slate-950 [overflow-wrap:anywhere]">{address.name || text("Địa chỉ chưa đặt tên", "Untitled address")}</span>
                    <StudioStatus tone={address.active ? "success" : "neutral"}>{address.active ? t("studio.business.statusActive") : t("studio.business.statusInactive")}</StudioStatus>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">{address.addressLine1 || text("Mở để bổ sung thông tin địa điểm", "Open to add location details")}</span>
                </span>
              </span>
              <span className="flex max-w-[50%] flex-wrap justify-end gap-1.5">
                {address.purposes.slice(0, 3).map((purpose) => <span key={purpose} className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700">{t(`studio.business.purpose.${purpose}`)}</span>)}
                {address.purposes.length > 3 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">+{address.purposes.length - 3}</span> : null}
                {address.purposes.length === 0 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">{text("Chưa chọn vai trò", "No roles selected")}</span> : null}
              </span>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <StudioSwitch
                  disabled={!canConfigure}
                  checked={address.active}
                  onChange={(active) => updateAddress(address.id, { active })}
                  label={t("studio.business.activeAddress")}
                  description={t("studio.business.activeAddressDescription")}
                />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center gap-2"><MapPin size={16} className="text-violet-600" /><h3 className="text-sm font-semibold text-slate-950">{t("studio.business.locationDetails")}</h3></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <StudioField label={t("studio.business.addressName")}><StudioInput disabled={!canConfigure} value={address.name} onChange={(event) => updateAddress(address.id, { name: event.target.value })} /></StudioField>
                    <StudioField label={t("studio.business.province")}><StudioInput disabled={!canConfigure} value={address.provinceCode} onChange={(event) => updateAddress(address.id, { provinceCode: event.target.value })} /></StudioField>
                    <StudioField label={t("studio.business.addressLine1")} className="md:col-span-2"><StudioInput disabled={!canConfigure} value={address.addressLine1} onChange={(event) => updateAddress(address.id, { addressLine1: event.target.value })} /></StudioField>
                    <StudioField label={t("studio.business.addressLine2")} className="md:col-span-2"><StudioInput disabled={!canConfigure} value={address.addressLine2} onChange={(event) => updateAddress(address.id, { addressLine2: event.target.value })} /></StudioField>
                  </div>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center gap-2"><MailCheck size={16} className="text-violet-600" /><h3 className="text-sm font-semibold text-slate-950">{t("studio.business.locationContact")}</h3></div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <StudioField label={t("studio.business.contactName")}><StudioInput disabled={!canConfigure} value={address.contactName} onChange={(event) => updateAddress(address.id, { contactName: event.target.value })} /></StudioField>
                    <StudioField label={t("studio.business.contactPhone")}><StudioInput disabled={!canConfigure} value={address.contactPhone} onChange={(event) => updateAddress(address.id, { contactPhone: event.target.value })} /></StudioField>
                  </div>
                </section>
              </div>

              <section className="mt-4 rounded-xl border border-violet-100 bg-violet-50/30 p-4">
                <div className="max-w-3xl">
                  <h3 className="text-sm font-semibold text-slate-950">{t("studio.business.addressUsage")}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{t("studio.business.addressUsageDescription")}</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {PURPOSES.map((purpose) => (
                    <AddressPurposeCard
                      key={purpose}
                      disabled={!canConfigure}
                      checked={address.purposes.includes(purpose)}
                      label={t(`studio.business.purpose.${purpose}`)}
                      description={t(`studio.business.purposeDescription.${purpose}`)}
                      icon={purposeIcons[purpose]}
                      onChange={(checked) => updateAddress(address.id, { purposes: checked ? [...address.purposes, purpose] : address.purposes.filter((item) => item !== purpose) })}
                    />
                  ))}
                </div>
              </section>

              {canConfigure ? <div className="mt-4 flex justify-end"><StudioButton tone="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setAddressPendingRemoval(address.id)}>{t("common.remove")}</StudioButton></div> : null}
            </div>
          </details>
        ))}
        {addresses.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">{text("Chưa có địa chỉ doanh nghiệp.", "No business addresses yet.")}</div> : null}
      </div>
    </StudioSection>
  );

  return (
    <StudioPageFrame
      title={t("studio.businessInformation")}
      description={text("Quản lý nhận diện, liên hệ và địa chỉ dùng chung trong workspace.", "Manage workspace identity, contact channels, and shared addresses.")}
      locale={locale}
      revision={configuration.revision}
      updatedAt={configuration.updatedAt}
      dirty={dirty}
      error={error}
      message={message}
      actions={<StudioButton tone="primary" icon={<Save size={16} />} disabled={!canConfigure || !dirty || saving} loading={saving} onClick={() => void save()}>{t("common.save")}</StudioButton>}
    >
      {!canConfigure ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{t("studio.readOnly")}</p> : null}
      <StudioMetricsGrid>
        <StudioMetricCard label={text("Nhận diện", "Identity")} value={business.displayName.trim() ? text("Sẵn sàng", "Ready") : text("Cần bổ sung", "Needs attention")} description={business.legalName || text("Chưa có tên pháp lý", "Legal name not set")} icon={<Building2 size={17} />} tone={business.displayName.trim() ? "success" : "warning"} />
        <StudioMetricCard label={text("Kênh liên hệ", "Contact channels")} value={[business.email, business.phone, business.website].filter(Boolean).length} description={text("Email, điện thoại hoặc website đã được khai báo.", "Email, phone, or website values configured.")} icon={<MailCheck size={17} />} />
        <StudioMetricCard label={text("Địa chỉ hoạt động", "Active addresses")} value={addresses.filter((address) => address.active).length} description={text("Dùng lại cho hóa đơn, giao nhận và đổi trả.", "Reusable by invoicing, fulfillment, and returns.")} icon={<MapPin size={17} />} tone="violet" />
      </StudioMetricsGrid>
      <div className="mt-5 space-y-5">{profileSection}{addressSection}</div>
      <ConfirmDialog
        isOpen={Boolean(addressPendingRemoval)}
        onClose={() => setAddressPendingRemoval(null)}
        onConfirm={() => addressPendingRemoval && removeAddress(addressPendingRemoval)}
        title={t("studio.business.removeAddress")}
        message={t("studio.business.confirmRemoveAddress")}
        confirmText={t("common.remove")}
        cancelText={t("common.cancel")}
        type="danger"
      />
      <StudioSaveBar dirty={dirty && canConfigure} saving={saving} onSave={async () => { await save(); }} saveLabel={t("common.save")} cleanLabel={t("studio.saved")} dirtyLabel={t("studio.unsaved")} />
    </StudioPageFrame>
  );
}
