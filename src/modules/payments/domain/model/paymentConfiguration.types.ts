export interface ReceivingAccount {
  id: string;
  nickname: string;
  bankCode: string;
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  swiftCode: string;
  currency: string;
  active: boolean;
  isDefaultForCurrency: boolean;
  showOnQuote: boolean;
  showOnInvoice: boolean;
}

export type ConfiguredPaymentMethodCategory = "BANK_TRANSFER" | "CASH" | "CARD" | "E_WALLET" | "COD" | "EXTERNAL_GATEWAY";

export interface ConfiguredPaymentMethod {
  code: string;
  nameVi: string;
  nameEn: string;
  category: ConfiguredPaymentMethodCategory;
  enabled: boolean;
  supportedChannels: Array<"BANK" | "ONLINE_GATEWAY" | "POS" | "CARRIER" | "OFFLINE" | "EXTERNAL">;
  supportedCurrencies: string[];
  supportsPaymentRequest: boolean;
  supportsManualRecording: boolean;
  supportsRefund: boolean;
  supportsReconciliation: boolean;
  requiresReference: boolean;
  requiresEvidence: boolean;
  requiresPhysicalShipping?: boolean;
  providerId?: string;
  displayOrder: number;
  availability: "ACTIVE" | "HISTORICAL_ONLY";
}

export interface PaymentConfiguration {
  revision: number;
  enabledMethods: ConfiguredPaymentMethodCategory[];
  defaultMethod: ConfiguredPaymentMethodCategory;
  methods: ConfiguredPaymentMethod[];
  receivingAccounts: ReceivingAccount[];
  qrPolicy: {
    enabled: boolean;
    showOnOrderDetail: boolean;
    showOnPrint: boolean;
    showOnQuote: boolean;
    showOnInvoice: boolean;
    amountMode: "ORDER_TOTAL" | "OUTSTANDING" | "EMPTY";
    transferContentTemplate: string;
    accountSelection: "DEFAULT" | "PER_ORDER";
    displayStyle: "QR_ONLY" | "COMPACT" | "PRINT";
  };
  planTemplates: Array<{
    id: string;
    nameVi: string;
    nameEn: string;
    enabled: boolean;
    customerSegments: string[];
    minimumOrderValue?: number;
    maximumOrderValue?: number;
    currency: string;
    approvalRequired: boolean;
    scheduleLines: Array<{
      id: string;
      labelVi: string;
      labelEn: string;
      percentage?: number;
      remainder?: boolean;
      dueRule: "ORDER_CONFIRMED" | "BEFORE_DELIVERY" | "ON_DELIVERY" | "NET_DAYS" | "MILESTONE";
      dueOffsetDays?: number;
      milestoneCode?: string;
      allowedMethodCodes: string[];
      fulfillmentGate: "NONE" | "BEFORE_BOOKING" | "BEFORE_DISPATCH" | "BEFORE_COMPLETION";
    }>;
  }>;
  creditPolicy: {
    enabled: boolean;
    defaultCreditLimit: number;
    maximumOverdueAmount: number;
    maximumOverdueDays: number;
    approvalThreshold: number;
    approverRoleLabel: string;
    requireOverrideReason: boolean;
    creditHoldEnabled: boolean;
  };
}
