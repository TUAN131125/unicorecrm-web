import type { PaymentConfiguration, ReceivingAccount } from "../../domain/model/paymentConfiguration.types";

export interface PaymentConfigurationPort {
  getSnapshot(): PaymentConfiguration;
  saveConfiguration(value: PaymentConfiguration): PaymentConfiguration;
  saveReceivingAccounts(accounts: ReceivingAccount[]): PaymentConfiguration;
  subscribe(listener: (configuration: PaymentConfiguration) => void): () => void;
}
