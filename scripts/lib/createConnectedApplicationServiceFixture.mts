import type { ApplicationServiceBundle } from "../../src/app/composition/applicationServiceBundle";
import { createDemoApplicationServiceBundle } from "../../src/app/composition/demoApplicationServiceBundle";
import type { InvoiceApiPort } from "../../src/modules/invoices/application/ports/InvoiceApiPort";
import type { ReceivablesApiPort } from "../../src/modules/invoices/application/ports/ReceivablesApiPort";
import { createInvoiceVerticalSlice } from "../../src/modules/invoices/application/vertical-slice/invoiceVerticalSlice";
import type { PaymentApiPort } from "../../src/modules/payments/application/ports/PaymentApiPort";
import { createPaymentVerticalSlice } from "../../src/modules/payments/application/vertical-slice/paymentVerticalSlice";

export function createConnectedApplicationServiceFixture(input: {
  paymentApi?: PaymentApiPort;
  invoiceApi?: InvoiceApiPort;
  receivablesApi?: ReceivablesApiPort;
} = {}): ApplicationServiceBundle {
  const services = createDemoApplicationServiceBundle();
  const paymentApi = input.paymentApi ?? services.modules.payments.api;
  const invoiceApi = input.invoiceApi ?? services.modules.invoices.api;
  const receivablesApi = input.receivablesApi ?? services.modules.invoices.receivablesApi;
  if (!receivablesApi) throw new Error("Connected application service fixture requires a Receivables API.");

  services.modules.payments = {
    ...services.modules.payments,
    api: paymentApi,
    verticalSlice: createPaymentVerticalSlice(paymentApi),
  };
  services.modules.invoices = {
    ...services.modules.invoices,
    api: invoiceApi,
    receivablesApi,
    verticalSlice: createInvoiceVerticalSlice(invoiceApi, receivablesApi, paymentApi),
  };
  return services;
}
