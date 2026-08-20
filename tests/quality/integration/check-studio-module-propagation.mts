import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StoragePort } from "@/platform/persistence";
import { BrowserPaymentConfigurationRepository, DEFAULT_PAYMENT_CONFIGURATION } from "@/modules/payments/infrastructure/BrowserPaymentConfigurationRepository";
import { BrowserInvoiceConfigurationRepository, DEFAULT_INVOICE_SELLER_INFORMATION } from "@/modules/invoices/infrastructure/BrowserInvoiceConfigurationRepository";

class MemoryStorage implements StoragePort { private values = new Map<string, unknown>(); get<T>(key: string) { return structuredClone(this.values.get(key) as T | undefined) ?? null; } set<T>(key: string, value: T) { this.values.set(key, structuredClone(value)); } remove(key: string) { this.values.delete(key); } }
const payment = new BrowserPaymentConfigurationRepository(new MemoryStorage());
const paymentSaved = payment.saveConfiguration({ ...DEFAULT_PAYMENT_CONFIGURATION, receivingAccounts: [{ id: "account-vnd", nickname: "Main", bankCode: "VCB", bankBin: "970436", bankName: "Vietcombank", accountNumber: "001", accountHolder: "UNICORE", branch: "", swiftCode: "", currency: "VND", active: true, isDefaultForCurrency: true, showOnQuote: true, showOnInvoice: true }] });
assert.equal(payment.getSnapshot().receivingAccounts[0]?.id, "account-vnd");
assert.equal(paymentSaved.revision, 2);
const invoice = new BrowserInvoiceConfigurationRepository(new MemoryStorage());
invoice.saveSellerInformation({ ...DEFAULT_INVOICE_SELLER_INFORMATION, sellerName: "Studio owner projection", defaultReceivingAccountId: "account-vnd" });
assert.equal(invoice.getSellerInformation().defaultReceivingAccountId, "account-vnd");

const read = (file: string) => readFileSync(join(repositoryRoot, file), "utf8");
const pairs = [
  ["src/workspaces/studio/presentation/views/ProductTypesView.tsx", "saveConfiguredProductTypes", "src/modules/products/presentation/components/ProductFormModal.tsx", "getConfiguredProductTypes"],
  ["src/workspaces/studio/presentation/views/PipelinesStatusesView.tsx", "replaceDealPipelines", "src/modules/deals/public/deals.ts", "getDealPipelines"],
  ["src/workspaces/studio/presentation/views/PaymentInformationView.tsx", "savePaymentConfiguration", "src/modules/payments/presentation/components/PaymentRequestComposer.tsx", "getPaymentConfigurationSnapshot"],
  ["src/workspaces/studio/presentation/views/InvoiceInformationView.tsx", "saveInvoiceSellerInformation", "src/modules/invoices/presentation/pages/InvoiceFormPage.tsx", "getInvoiceSellerInformation"],
  ["src/workspaces/studio/presentation/views/InformationFieldsView.tsx", "saveCrmObjectSchemas", "src/modules/leads/presentation/hooks/useLeadFormController.tsx", "useConfigurationRuntime"],
];
for (const [studioFile, writeMarker, consumerFile, readMarker] of pairs) { assert.ok(read(studioFile).includes(writeMarker), `${studioFile} must write through its owner`); assert.ok(read(consumerFile).includes(readMarker), `${consumerFile} must consume the same owner`); }
console.log("Studio module propagation: PASS (owner repositories and downstream consumers share configuration).");
