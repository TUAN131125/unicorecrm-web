export type IntegrationStatus = "NOT_CONFIGURED" | "PENDING_VERIFICATION" | "CONNECTED" | "ERROR" | "DISCONNECTED";
export type IntegrationCategory = "EMAIL" | "MESSAGING" | "SHIPPING" | "PAYMENT" | "E_INVOICE" | "EXCHANGE_RATE";

export interface IntegrationProvider {
  code: string;
  category: IntegrationCategory;
  name: string;
  descriptionVi: string;
  descriptionEn: string;
}

export interface IntegrationConnection {
  id: string;
  providerCode: string;
  displayName: string;
  credentialReference: string;
  status: IntegrationStatus;
  lastVerifiedAt: string | null;
  version: number;
}

export interface IntegrationConfiguration {
  revision: number;
  providers: IntegrationProvider[];
  connections: IntegrationConnection[];
}
