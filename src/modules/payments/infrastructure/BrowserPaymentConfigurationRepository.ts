import type { StoragePort } from "@/platform/persistence";
import type { PaymentConfigurationPort } from "../application/ports/PaymentConfigurationPort";
import type { PaymentConfiguration, ReceivingAccount } from "../domain/model/paymentConfiguration.types";

const KEY = "payment-configuration";

export const DEFAULT_PAYMENT_CONFIGURATION: PaymentConfiguration = {
  revision: 1,
  enabledMethods: ["BANK_TRANSFER", "COD"],
  defaultMethod: "BANK_TRANSFER",
  methods: [],
  receivingAccounts: [],
  qrPolicy: {
    enabled: true,
    showOnOrderDetail: true,
    showOnPrint: true,
    showOnQuote: true,
    showOnInvoice: true,
    amountMode: "OUTSTANDING",
    transferContentTemplate: "TT {orderNumber}",
    accountSelection: "DEFAULT",
    displayStyle: "COMPACT",
  },
  planTemplates: [],
  creditPolicy: {
    enabled: false,
    defaultCreditLimit: 0,
    maximumOverdueAmount: 0,
    maximumOverdueDays: 0,
    approvalThreshold: 0,
    approverRoleLabel: "Finance Manager",
    requireOverrideReason: true,
    creditHoldEnabled: false,
  },
};

export class BrowserPaymentConfigurationRepository implements PaymentConfigurationPort {
  private readonly listeners = new Set<(configuration: PaymentConfiguration) => void>();
  private current: PaymentConfiguration;

  constructor(private readonly storage: StoragePort) {
    const stored = this.storage.get<PaymentConfiguration>(KEY);
    this.current = stored ? { ...structuredClone(DEFAULT_PAYMENT_CONFIGURATION), ...stored } : structuredClone(DEFAULT_PAYMENT_CONFIGURATION);
  }

  getSnapshot(): PaymentConfiguration { return structuredClone(this.current); }

  saveConfiguration(value: PaymentConfiguration): PaymentConfiguration {
    this.current = { ...structuredClone(value), revision: this.current.revision + 1 };
    return this.persist();
  }

  saveReceivingAccounts(accounts: ReceivingAccount[]): PaymentConfiguration {
    const defaultCurrencies = new Set<string>();
    const normalized = accounts.map((account) => {
      const canBeDefault = account.active && account.isDefaultForCurrency && !defaultCurrencies.has(account.currency);
      if (canBeDefault) defaultCurrencies.add(account.currency);
      return { ...account, isDefaultForCurrency: canBeDefault };
    });
    this.current = { ...this.current, revision: this.current.revision + 1, receivingAccounts: normalized };
    return this.persist();
  }

  subscribe(listener: (configuration: PaymentConfiguration) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private persist(): PaymentConfiguration {
    this.storage.set(KEY, this.current);
    this.listeners.forEach((listener) => listener(this.getSnapshot()));
    return this.getSnapshot();
  }
}
