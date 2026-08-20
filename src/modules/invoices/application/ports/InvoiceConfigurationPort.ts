import type { InvoiceSellerInformation } from "../../domain/model/invoiceConfiguration.types";

export interface InvoiceConfigurationPort {
  getSellerInformation(): InvoiceSellerInformation;
  saveSellerInformation(value: InvoiceSellerInformation): InvoiceSellerInformation;
  subscribe(listener: (value: InvoiceSellerInformation) => void): () => void;
}
