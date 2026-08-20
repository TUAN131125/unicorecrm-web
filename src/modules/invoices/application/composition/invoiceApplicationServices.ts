import { createApplicationServiceBinding } from "@/shared/application";
import type { InvoiceApiPort } from "../ports/InvoiceApiPort";
import type { InvoiceRepository } from "../ports/InvoiceRepository";
import type { ReceivableOperationsPort } from "../ports/ReceivableOperationsPort";
import type { ReceivablesApiPort } from "../ports/ReceivablesApiPort";
import type { InvoiceVerticalSlice } from "../vertical-slice/invoiceVerticalSlice";
import type { InvoiceConfigurationPort } from "../ports/InvoiceConfigurationPort";

export interface InvoiceApplicationServices {
  repository: InvoiceRepository;
  api: InvoiceApiPort;
  receivablesApi?: ReceivablesApiPort;
  receivableOperations: ReceivableOperationsPort;
  verticalSlice: InvoiceVerticalSlice;
  configuration: InvoiceConfigurationPort;
}

const binding = createApplicationServiceBinding<InvoiceApplicationServices>("Invoices");
export const configureInvoiceApplication = binding.configure;
export const getInvoiceApplicationServices = binding.get;
export const resetInvoiceApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const invoiceRepository = createApplicationServiceProxy(() => binding.get().repository);
export const invoiceApi = createApplicationServiceProxy(() => binding.get().api);
export const receivablesApi = () => binding.get().receivablesApi;
export const invoiceVerticalSlice = createApplicationServiceProxy(() => binding.get().verticalSlice);
export const invoiceConfiguration = createApplicationServiceProxy(() => binding.get().configuration);
export const getReceivableCollectionActivities: ReceivableOperationsPort["list"] = (...args) => binding.get().receivableOperations.list(...args);
export const saveReceivableCollectionActivity: ReceivableOperationsPort["save"] = (...args) => binding.get().receivableOperations.save(...args);
export const updateReceivableCollectionActivityState: ReceivableOperationsPort["updateState"] = (...args) => binding.get().receivableOperations.updateState(...args);
export const subscribeToReceivableCollectionActivities: ReceivableOperationsPort["subscribe"] = (...args) => binding.get().receivableOperations.subscribe(...args);
export type { ReceivableCollectionActivity, ReceivableCollectionActivityType } from "../ports/ReceivableOperationsPort";
