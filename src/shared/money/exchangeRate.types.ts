export interface ExchangeRateRecord {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveAt: string;
  source: "MANUAL" | "CONNECTED_PROVIDER";
  providerConnectionId: string | null;
  status: "ACTIVE" | "EXPIRED" | "PENDING";
  version: number;
}

export interface ExchangeRateSnapshot {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveAt: string;
  source: ExchangeRateRecord["source"];
  rateId: string;
  rateVersion: number;
}
