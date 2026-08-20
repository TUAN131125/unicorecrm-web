import React from "react";
import { CalendarClock, Landmark, ReceiptText, Save } from "lucide-react";
import { useI18n } from "@/i18n";
import { getInvoiceSellerInformation, saveInvoiceSellerInformation, subscribeToInvoiceConfiguration, type InvoiceSellerInformation } from "@/modules/invoices";
import { getPaymentConfigurationSnapshot, subscribeToPaymentConfiguration } from "@/modules/payments";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import {
  StudioCallout,
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
  StudioSelect,
  StudioStatus,
  StudioTextarea,
} from "../components/StudioPrimitives";

export function InvoiceInformationView() {
  const { locale } = useI18n();
  const text = React.useCallback((vi: string, en: string) => locale === "vi" ? vi : en, [locale]);
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const source = useSubscribableSnapshot(getInvoiceSellerInformation, subscribeToInvoiceConfiguration);
  const payment = useSubscribableSnapshot(getPaymentConfigurationSnapshot, subscribeToPaymentConfiguration);
  const workspace = useWorkspaceOperationalConfiguration();
  const [draft, setDraft] = React.useState<InvoiceSellerInformation>(source);
  React.useEffect(() => setDraft(source), [source]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);
  const update = <K extends keyof InvoiceSellerInformation>(key: K, value: InvoiceSellerInformation[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = () => {
    setDraft(saveInvoiceSellerInformation(draft));
  };
  const selectedAddress = workspace.addresses.find((address) => address.id === draft.invoiceAddressId);
  const selectedAccount = payment.receivingAccounts.find((account) => account.id === draft.defaultReceivingAccountId);
  const readinessIssues = [
    !draft.sellerName.trim() ? text("Chưa có tên người bán.", "Seller name is missing.") : "",
    !draft.taxId.trim() ? text("Chưa có mã số thuế.", "Tax ID is missing.") : "",
    !selectedAddress ? text("Chưa chọn địa chỉ xuất hóa đơn.", "Invoice address is not selected.") : "",
    !selectedAccount ? text("Chưa chọn tài khoản nhận tiền mặc định.", "Default receiving account is not selected.") : "",
  ].filter(Boolean);


  const content = (
    <>
      {!canConfigure ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{text("Bạn chỉ có quyền xem cấu hình.", "You have read-only access to configuration.")}</p> : null}
      <StudioMetricsGrid>
        <StudioMetricCard label={text("Thông tin người bán", "Seller identity")} value={draft.sellerName.trim() && draft.taxId.trim() ? text("Sẵn sàng", "Ready") : text("Cần bổ sung", "Needs attention")} description={draft.sellerName || text("Chưa có tên người bán", "Seller name not set")} icon={<ReceiptText size={17} />} tone={draft.sellerName.trim() && draft.taxId.trim() ? "success" : "warning"} />
        <StudioMetricCard label={text("Hạn thanh toán", "Payment term")} value={`${draft.defaultDueDays} ${text("ngày", "days")}`} description={text("Áp dụng mặc định cho hóa đơn mới.", "Applied by default to new invoices.")} icon={<CalendarClock size={17} />} />
        <StudioMetricCard label={text("Tài khoản nhận tiền", "Receiving account")} value={selectedAccount ? draft.defaultCurrency : "—"} description={selectedAccount ? (selectedAccount.nickname || selectedAccount.bankName) : text("Chưa chọn tài khoản", "No account selected")} icon={<Landmark size={17} />} tone={selectedAccount ? "violet" : "warning"} />
      </StudioMetricsGrid>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <StudioSection title={text("Người bán", "Seller")}>
            <div className="grid gap-4 md:grid-cols-2">
              <StudioField label={text("Tên người bán", "Seller name")} className="md:col-span-2"><StudioInput disabled={!canConfigure} value={draft.sellerName} onChange={(event) => update("sellerName", event.target.value)} /></StudioField>
              <StudioField label={text("Mã số thuế", "Tax ID")}><StudioInput disabled={!canConfigure} value={draft.taxId} onChange={(event) => update("taxId", event.target.value)} /></StudioField>
              <StudioField label={text("Email", "Email")}><StudioInput disabled={!canConfigure} type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} /></StudioField>
              <StudioField label={text("Địa chỉ hóa đơn", "Invoice address")} className="md:col-span-2">
                <StudioSelect disabled={!canConfigure} value={draft.invoiceAddressId ?? ""} onChange={(event) => update("invoiceAddressId", event.target.value || null)}>
                  <option value="">—</option>
                  {workspace.addresses.filter((address) => address.active && address.purposes.includes("INVOICE")).map((address) => <option key={address.id} value={address.id}>{address.name} — {address.addressLine1}</option>)}
                </StudioSelect>
              </StudioField>
            </div>
          </StudioSection>

          <StudioSection title={text("Mặc định hóa đơn", "Invoice defaults")}>
            <div className="grid gap-4 md:grid-cols-2">
              <StudioField label={text("Tiền tố số hóa đơn", "Number prefix")}><StudioInput disabled={!canConfigure} value={draft.numberingPrefix} onChange={(event) => update("numberingPrefix", event.target.value)} /></StudioField>
              <StudioField label={text("Hạn thanh toán (ngày)", "Default due days")}><StudioInput disabled={!canConfigure} type="number" min={0} value={draft.defaultDueDays} onChange={(event) => update("defaultDueDays", Number(event.target.value) || 0)} /></StudioField>
              <StudioField label={text("Tiền tệ mặc định", "Default currency")}><StudioSelect disabled={!canConfigure} value={draft.defaultCurrency} onChange={(event) => update("defaultCurrency", event.target.value)}>{workspace.localeRegion.currencies.enabledCurrencies.map((code) => <option key={code}>{code}</option>)}</StudioSelect></StudioField>
              <StudioField label={text("Tài khoản nhận tiền", "Receiving account")}><StudioSelect disabled={!canConfigure} value={draft.defaultReceivingAccountId ?? ""} onChange={(event) => update("defaultReceivingAccountId", event.target.value || null)}><option value="">—</option>{payment.receivingAccounts.filter((account) => account.active && account.showOnInvoice && account.currency === draft.defaultCurrency).map((account) => <option key={account.id} value={account.id}>{account.nickname || account.bankName} — {account.accountNumber}</option>)}</StudioSelect></StudioField>
              <StudioField label={text("Ghi chú mặc định", "Default notes")} className="md:col-span-2"><StudioTextarea disabled={!canConfigure} value={draft.notes} onChange={(event) => update("notes", event.target.value)} /></StudioField>
            </div>
          </StudioSection>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
          <StudioSection title={text("Xem trước đầu hóa đơn", "Invoice-header preview")}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-600">{draft.numberingPrefix || "INV"}-0001</p>
                  <h3 className="mt-2 break-words text-base font-semibold text-slate-950">{draft.sellerName || text("Tên người bán", "Seller name")}</h3>
                  <p className="mt-1 text-xs text-slate-500">{text("MST", "Tax ID")}: {draft.taxId || "—"}</p>
                </div>
                <StudioStatus tone="info">{draft.defaultCurrency}</StudioStatus>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-xs text-slate-500">{text("Địa chỉ", "Address")}</dt><dd className="mt-1 break-words text-slate-800">{selectedAddress?.addressLine1 || "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">{text("Thanh toán", "Payment")}</dt><dd className="mt-1 break-words text-slate-800">{selectedAccount ? `${selectedAccount.bankName} · ${selectedAccount.accountNumber}` : "—"}</dd></div>
                <div><dt className="text-xs text-slate-500">{text("Điều khoản", "Terms")}</dt><dd className="mt-1 text-slate-800">{text(`Thanh toán trong ${draft.defaultDueDays} ngày`, `Due in ${draft.defaultDueDays} days`)}</dd></div>
              </dl>
            </div>
          </StudioSection>
          <StudioCallout
            title={readinessIssues.length === 0 ? text("Cấu hình hóa đơn đã sẵn sàng", "Invoice configuration is ready") : text("Cần hoàn thiện cấu hình", "Configuration needs attention")}
            description={readinessIssues.length === 0 ? text("Thông tin người bán, địa chỉ và tài khoản nhận tiền đã liên kết.", "Seller identity, address, and receiving account are linked.") : undefined}
            tone={readinessIssues.length === 0 ? "success" : "warning"}
          >
            {readinessIssues.length > 0 ? <ul className="space-y-1.5 text-xs leading-5 text-amber-900">{readinessIssues.map((issue) => <li key={issue}>• {issue}</li>)}</ul> : null}
          </StudioCallout>
        </aside>
      </div>
    </>
  );


  return <StudioPageFrame
    title={text("Thông tin hóa đơn", "Invoice information")}
    description={text("Thiết lập thông tin người bán và các giá trị mặc định cho hóa đơn mới.", "Configure seller identity and defaults for new invoices.")}
   
    locale={locale}
    dirty={dirty}
    revision={source.revision}
    actions={<StudioButton tone="primary" icon={<Save size={15} />} disabled={!canConfigure || !dirty} onClick={save}>{text("Lưu", "Save")}</StudioButton>}
  >
    {content}
    <StudioSaveBar dirty={dirty && canConfigure} saving={false} onSave={save} saveLabel={text("Lưu", "Save")} cleanLabel={text("Đã lưu.", "Saved.")} dirtyLabel={text("Có thay đổi chưa lưu.", "Unsaved changes.")} />
  </StudioPageFrame>;
}
