import { createApplicationServiceBinding } from "@/shared/application";
import type { PaymentApiPort } from "../ports/PaymentApiPort";
import type { PaymentRepository } from "../ports/PaymentRepository";
import type { PaymentVerticalSlice } from "../vertical-slice/paymentVerticalSlice";
import type { PaymentConfigurationPort } from "../ports/PaymentConfigurationPort";

export interface PaymentApplicationServices {
  repository: PaymentRepository;
  api: PaymentApiPort;
  verticalSlice: PaymentVerticalSlice;
  configuration: PaymentConfigurationPort;
}

const binding = createApplicationServiceBinding<PaymentApplicationServices>("Payments");
export const configurePaymentApplication = binding.configure;
export const getPaymentApplicationServices = binding.get;
export const resetPaymentApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const paymentRepository = createApplicationServiceProxy(() => binding.get().repository);
export const paymentApi = createApplicationServiceProxy(() => binding.get().api);
export const paymentVerticalSlice = createApplicationServiceProxy(() => binding.get().verticalSlice);
export const paymentConfiguration = createApplicationServiceProxy(() => binding.get().configuration);
