import { createApplicationServiceBinding } from "@/shared/application";
import type { CustomerConversionPort } from "../ports/CustomerConversionPort";

const binding = createApplicationServiceBinding<CustomerConversionPort>("Customer Conversion workflow");
export const configureCustomerConversionApplication = binding.configure;
export const reconcileCustomerConversionRuntime: CustomerConversionPort["reconcile"] = (...args) => binding.get().reconcile(...args);
export const startCustomerConversionRuntime: CustomerConversionPort["start"] = () => binding.get().start();
export type { CustomerConversionReconciliationResult } from "../ports/CustomerConversionPort";
