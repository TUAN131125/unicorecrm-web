import React from "react";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { unavailableFeatureMessage } from "@/shared/operations";
import { getPaymentConfigurationSnapshot, isPaymentConfigurationSaveUnavailable, savePaymentConfiguration, subscribeToPaymentConfiguration, type PaymentConfiguration, type ReceivingAccount } from "@/modules/payments";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import {
  StudioButton,
  StudioCheckbox,
  StudioDialog,
  StudioField,
  StudioInput,
  StudioPageFrame,
  StudioSaveBar,
  StudioSection,
  StudioSelect,
  StudioStatus,
} from "../components/StudioPrimitives";

function emptyAccount(currency: string): ReceivingAccount {
  return { id: `account_${crypto.randomUUID()}`, nickname: "", bankCode: "", bankBin: "", bankName: "", accountNumber: "", accountHolder: "", branch: "", swiftCode: "", currency, active: true, isDefaultForCurrency: false, showOnQuote: true, showOnInvoice: true };
}

export function PaymentInformationView() {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const [unavailableNotice, setUnavailableNotice] = React.useState<string | null>(null);
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const source = useSubscribableSnapshot(getPaymentConfigurationSnapshot, subscribeToPaymentConfiguration);
  const workspace = useWorkspaceOperationalConfiguration();
  const currencies = workspace.localeRegion.currencies.enabledCurrencies;
  const [draft, setDraft] = React.useState<PaymentConfiguration>(source);
  const [account, setAccount] = React.useState<ReceivingAccount | null>(null);
  React.useEffect(() => setDraft(source), [source]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);
  const save = () => {
    // Payment configuration has no authoritative owner in this runtime: the receiving-account
    // write operation is BLOCKED and nothing else persists it. Refuse rather than keep a local
    // copy that would look like committed configuration.
    if (isPaymentConfigurationSaveUnavailable()) {
      setUnavailableNotice(unavailableFeatureMessage({ vi: "Chưa thể lưu cấu hình thanh toán", en: "The payment configuration cannot be saved yet" }, { locale }));
      return;
    }
    setDraft(savePaymentConfiguration(draft));
  };
  const saveAccount = () => { if (!account?.bankName.trim() || !account.accountNumber.trim()) return; setDraft((current) => ({ ...current, receivingAccounts: current.receivingAccounts.some((item) => item.id === account.id) ? current.receivingAccounts.map((item) => item.id === account.id ? account : item) : [...current.receivingAccounts, account] })); setAccount(null); };


  const content = (
    <>
      {unavailableNotice ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{unavailableNotice}</p> : null}
            {!canConfigure ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{text("Bạn chỉ có quyền xem cấu hình.", "You have read-only access to configuration.")}</p> : null}
      <div className="space-y-5">
        <StudioSection title={text("Tài khoản nhận tiền", "Receiving accounts")} actions={<StudioButton tone="accent" size="sm" icon={<Plus size={14} />} disabled={!canConfigure} onClick={() => setAccount(emptyAccount(workspace.localeRegion.currencies.baseCurrency))}>{text("Thêm tài khoản", "Add account")}</StudioButton>}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {draft.receivingAccounts.map((item) => (
              <article key={item.id} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-950 [overflow-wrap:anywhere]">{item.nickname || item.bankName}</h3>
                    <p className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">{item.bankName}</p>
                  </div>
                  <StudioStatus tone={item.active ? "success" : "neutral"}>{item.active ? text("Đang dùng", "Active") : text("Tạm ẩn", "Inactive")}</StudioStatus>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div><dt className="text-xs text-slate-500">{text("Số tài khoản", "Account number")}</dt><dd className="mt-0.5 break-all font-medium text-slate-900">{item.accountNumber || "—"}</dd></div>
                  <div><dt className="text-xs text-slate-500">{text("Chủ tài khoản", "Account holder")}</dt><dd className="mt-0.5 [overflow-wrap:anywhere] text-slate-700">{item.accountHolder || "—"}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StudioStatus tone="info">{item.currency}</StudioStatus>
                  {item.isDefaultForCurrency ? <StudioStatus tone="success">{text("Mặc định", "Default")}</StudioStatus> : null}
                  {item.showOnQuote ? <StudioStatus>{text("Báo giá", "Quotes")}</StudioStatus> : null}
                  {item.showOnInvoice ? <StudioStatus>{text("Hóa đơn", "Invoices")}</StudioStatus> : null}
                </div>
                <div className="mt-4 flex gap-2 border-t border-slate-200/80 pt-3">
                  <StudioButton size="sm" icon={<Pencil size={13} />} disabled={!canConfigure} onClick={() => setAccount({ ...item })}>{text("Sửa", "Edit")}</StudioButton>
                  <StudioButton size="sm" tone="danger" icon={<Trash2 size={13} />} disabled={!canConfigure} onClick={() => setDraft((current) => ({ ...current, receivingAccounts: current.receivingAccounts.filter((entry) => entry.id !== item.id) }))}>{text("Xóa", "Delete")}</StudioButton>
                </div>
              </article>
            ))}
            {draft.receivingAccounts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">{text("Chưa có tài khoản nhận tiền.", "No receiving accounts yet.")}</div> : null}
          </div>
        </StudioSection>
        <StudioSection title="VietQR"><div className="grid gap-4 md:grid-cols-2"><StudioCheckbox disabled={!canConfigure} checked={draft.qrPolicy.enabled} onChange={(enabled) => setDraft({ ...draft, qrPolicy: { ...draft.qrPolicy, enabled } })} label={text("Bật VietQR", "Enable VietQR")} /><StudioCheckbox disabled={!canConfigure} checked={draft.qrPolicy.showOnInvoice} onChange={(showOnInvoice) => setDraft({ ...draft, qrPolicy: { ...draft.qrPolicy, showOnInvoice } })} label={text("Hiển thị trên hóa đơn", "Show on invoices")} /><StudioField label={text("Mẫu nội dung chuyển khoản", "Transfer content template")} className="md:col-span-2"><StudioInput disabled={!canConfigure} value={draft.qrPolicy.transferContentTemplate} onChange={(event) => setDraft({ ...draft, qrPolicy: { ...draft.qrPolicy, transferContentTemplate: event.target.value } })} /></StudioField></div></StudioSection>
        <StudioSection title={text("Chính sách tín dụng", "Credit policy")}><div className="grid gap-4 md:grid-cols-3"><StudioCheckbox disabled={!canConfigure} checked={draft.creditPolicy.enabled} onChange={(enabled) => setDraft({ ...draft, creditPolicy: { ...draft.creditPolicy, enabled } })} label={text("Cho phép tín dụng", "Enable credit")} /><StudioField label={text("Hạn mức mặc định", "Default limit")}><StudioInput disabled={!canConfigure} type="number" min={0} value={draft.creditPolicy.defaultCreditLimit} onChange={(event) => setDraft({ ...draft, creditPolicy: { ...draft.creditPolicy, defaultCreditLimit: Number(event.target.value) || 0 } })} /></StudioField><StudioField label={text("Số ngày quá hạn tối đa", "Maximum overdue days")}><StudioInput disabled={!canConfigure} type="number" min={0} value={draft.creditPolicy.maximumOverdueDays} onChange={(event) => setDraft({ ...draft, creditPolicy: { ...draft.creditPolicy, maximumOverdueDays: Number(event.target.value) || 0 } })} /></StudioField></div></StudioSection>
      </div>
      <StudioDialog open={account !== null} onClose={() => setAccount(null)} title={text("Tài khoản nhận tiền", "Receiving account")} size="md" footer={<><StudioButton onClick={() => setAccount(null)}>{text("Hủy", "Cancel")}</StudioButton><StudioButton tone="primary" onClick={saveAccount}>{text("Lưu", "Save")}</StudioButton></>}>{account ? <div className="grid gap-4 md:grid-cols-2"><StudioField label={text("Tên gợi nhớ", "Nickname")}><StudioInput value={account.nickname} onChange={(event) => setAccount({ ...account, nickname: event.target.value })} /></StudioField><StudioField label={text("Ngân hàng", "Bank")}><StudioInput autoFocus value={account.bankName} onChange={(event) => setAccount({ ...account, bankName: event.target.value })} /></StudioField><StudioField label={text("Mã ngân hàng", "Bank code")}><StudioInput value={account.bankCode} onChange={(event) => setAccount({ ...account, bankCode: event.target.value })} /></StudioField><StudioField label="BIN"><StudioInput value={account.bankBin} onChange={(event) => setAccount({ ...account, bankBin: event.target.value })} /></StudioField><StudioField label={text("Số tài khoản", "Account number")}><StudioInput value={account.accountNumber} onChange={(event) => setAccount({ ...account, accountNumber: event.target.value })} /></StudioField><StudioField label={text("Chủ tài khoản", "Account holder")}><StudioInput value={account.accountHolder} onChange={(event) => setAccount({ ...account, accountHolder: event.target.value })} /></StudioField><StudioField label={text("Tiền tệ", "Currency")}><StudioSelect value={account.currency} onChange={(event) => setAccount({ ...account, currency: event.target.value })}>{currencies.map((code) => <option key={code}>{code}</option>)}</StudioSelect></StudioField><div className="space-y-3"><StudioCheckbox checked={account.isDefaultForCurrency} onChange={(isDefaultForCurrency) => setAccount({ ...account, isDefaultForCurrency })} label={text("Mặc định cho tiền tệ", "Default for currency")} /><StudioCheckbox checked={account.showOnQuote} onChange={(showOnQuote) => setAccount({ ...account, showOnQuote })} label={text("Hiện trên báo giá", "Show on quotes")} /><StudioCheckbox checked={account.showOnInvoice} onChange={(showOnInvoice) => setAccount({ ...account, showOnInvoice })} label={text("Hiện trên hóa đơn", "Show on invoices")} /></div></div> : null}</StudioDialog>
    </>
  );


  return <StudioPageFrame title={text("Thông tin thanh toán", "Payment information")} description={text("Quản lý tài khoản nhận tiền, VietQR và chính sách tín dụng dùng trong giao dịch.", "Manage receiving accounts, VietQR, and credit policy used in transactions.")} locale={locale} dirty={dirty} revision={source.revision} actions={<StudioButton tone="primary" icon={<Save size={15} />} disabled={!canConfigure || !dirty} onClick={save}>{text("Lưu", "Save")}</StudioButton>}>
    {content}
    <StudioSaveBar dirty={dirty && canConfigure} saving={false} onSave={save} saveLabel={text("Lưu", "Save")} cleanLabel={text("Đã lưu.", "Saved.")} dirtyLabel={text("Có thay đổi chưa lưu.", "Unsaved changes.")} />
  </StudioPageFrame>;
}
