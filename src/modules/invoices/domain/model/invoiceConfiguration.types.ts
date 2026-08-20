export interface InvoiceSellerInformation {
  revision: number;
  sellerName: string;
  taxId: string;
  invoiceAddressId: string | null;
  email: string;
  phone: string;
  numberingPrefix: string;
  defaultDueDays: number;
  notes: string;
  defaultReceivingAccountId: string | null;
  defaultCurrency: string;
}
