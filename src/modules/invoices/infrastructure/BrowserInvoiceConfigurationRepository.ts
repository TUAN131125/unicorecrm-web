import type { StoragePort } from "@/platform/persistence";
import type { InvoiceConfigurationPort } from "../application/ports/InvoiceConfigurationPort";
import type { InvoiceSellerInformation } from "../domain/model/invoiceConfiguration.types";

const KEY = "invoice-seller-information";

export const DEFAULT_INVOICE_SELLER_INFORMATION: InvoiceSellerInformation = {
  revision: 1,
  sellerName: "Unicore Vietnam",
  taxId: "",
  invoiceAddressId: "address-main",
  email: "billing@unicore.vn",
  phone: "",
  numberingPrefix: "INV",
  defaultDueDays: 30,
  notes: "",
  defaultReceivingAccountId: null,
  defaultCurrency: "VND",
};

export class BrowserInvoiceConfigurationRepository implements InvoiceConfigurationPort {
  private readonly listeners = new Set<(value: InvoiceSellerInformation) => void>();
  private current: InvoiceSellerInformation;

  constructor(private readonly storage: StoragePort) {
    this.current = this.storage.get<InvoiceSellerInformation>(KEY) ?? structuredClone(DEFAULT_INVOICE_SELLER_INFORMATION);
  }

  getSellerInformation(): InvoiceSellerInformation { return structuredClone(this.current); }

  saveSellerInformation(value: InvoiceSellerInformation): InvoiceSellerInformation {
    this.current = { ...structuredClone(value), revision: this.current.revision + 1 };
    this.storage.set(KEY, this.current);
    this.listeners.forEach((listener) => listener(this.getSellerInformation()));
    return this.getSellerInformation();
  }

  subscribe(listener: (value: InvoiceSellerInformation) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
