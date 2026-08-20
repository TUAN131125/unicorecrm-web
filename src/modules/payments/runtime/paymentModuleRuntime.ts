import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { InMemoryPaymentRepository } from "../infrastructure/InMemoryPaymentRepository";
import { INITIAL_PAYMENT_STATE } from "../infrastructure/payment.seed";
import { InMemoryPaymentApiAdapter } from "../infrastructure/InMemoryPaymentApiAdapter";
import type { PaymentApiPort } from "../application/ports/PaymentApiPort";

export const paymentRepository = createWorkspaceScopedRepository({
  resourceKey: "payments",
  createRepository: () => new InMemoryPaymentRepository(structuredClone(INITIAL_PAYMENT_STATE)),
});

export const paymentApi: PaymentApiPort = new InMemoryPaymentApiAdapter(paymentRepository);
