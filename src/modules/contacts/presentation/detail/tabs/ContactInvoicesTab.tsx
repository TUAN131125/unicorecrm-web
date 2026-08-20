import React from "react";
import { FileSpreadsheet } from "lucide-react";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";
import { useI18n } from "@/i18n";
import type { Invoice, ReceivableEntry } from "@/modules/invoices";
import { formatMoneyDto } from "@/shared/money";

interface ContactInvoicesTabProps {
  invoices: Invoice[];
  receivables: ReceivableEntry[];
  onOpenInvoice(id: string): void;
  onOpenReceivable(id: string): void;
  onOpenModule(): void;
  onCreateInvoice(): void;
}

export const ContactInvoicesTab: React.FC<ContactInvoicesTabProps> = ({
  invoices,
  receivables,
  onOpenInvoice,
  onOpenReceivable,
  onOpenModule,
  onCreateInvoice,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  return (
    <div id="contact-invoices-tab" className="space-y-4 text-left text-[11px] text-slate-700">
      <RelationshipWorkspaceHeader
        title={text("Hóa đơn liên quan", "Related invoices")}
        actions={<RelationshipModuleActions secondaryLabel={text("Mở module Hóa đơn", "Open Invoices")} primaryLabel={text("Tạo hóa đơn", "Create invoice")} onSecondary={onOpenModule} onPrimary={onCreateInvoice} />}
      />
      {invoices.length === 0 ? (
        <div className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
          <FileSpreadsheet size={24} className="text-slate-300" />
          <span className="mt-3 block font-medium text-slate-700">{text("Chưa có hóa đơn chính thức cho quan hệ này.", "No authoritative invoice exists for this relationship.")}</span>
          <p className="mt-1 max-w-lg text-[10px] leading-relaxed text-slate-500">{text("Hóa đơn được lấy trực tiếp từ module Hóa đơn theo Customer 360, tổ chức hoặc đơn hàng liên quan.", "Invoices are resolved directly from the Invoice module through Customer 360, organization, or related orders.")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => {
            const receivable = receivables.find((item) => item.invoiceId === invoice.id);
            return (
              <div key={invoice.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                <button type="button" className="min-w-0 text-left" onClick={() => onOpenInvoice(invoice.id)}>
                  <span className="block crm-text-wrap text-xs font-semibold text-slate-900">{invoice.invoiceNumber ?? text("Hóa đơn nháp", "Draft invoice")}</span>
                  <span className="mt-1 block text-[10px] font-medium text-slate-500">{invoice.lifecycleState} · {invoice.issueDate ?? invoice.createdAt}</span>
                </button>
                <div className="text-left sm:text-right">
                  <div className="font-semibold text-slate-900">{formatMoneyDto(invoice.totals.grandTotal, isVi ? "vi-VN" : "en-US")}</div>
                  {receivable ? <button type="button" onClick={() => onOpenReceivable(receivable.invoiceId)} className="mt-1 text-[10px] font-medium text-violet-700 hover:underline">{text("Còn phải thu", "Outstanding")}: {formatMoneyDto(receivable.outstandingAmount, isVi ? "vi-VN" : "en-US")}</button> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
