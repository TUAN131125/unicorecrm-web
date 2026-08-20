export type WorkspaceLocale = "vi" | "en";

export interface LocalizedText {
  vi: string;
  en: string;
}

export type BusinessAddressPurpose =
  | "REGISTERED"
  | "OPERATING"
  | "INVOICE"
  | "PICKUP"
  | "RETURN";

export interface BusinessAddress {
  id: string;
  name: string;
  purposes: BusinessAddressPurpose[];
  addressLine1: string;
  addressLine2: string;
  countryCode: string;
  provinceCode: string;
  districtCode: string;
  wardCode: string;
  postalCode: string;
  contactName: string;
  contactPhone: string;
  active: boolean;
}

export interface WorkspaceBusinessInformation {
  displayName: string;
  tradingName: string;
  legalName: string;
  registrationNumber: string;
  taxId: string;
  industry: string;
  representativeName: string;
  email: string;
  supportEmail: string;
  billingEmail: string;
  phone: string;
  website: string;
  logoReference: string;
}

export interface CurrencyConfiguration {
  baseCurrency: string;
  enabledCurrencies: string[];
  displayMode: "FULL" | "COMPACT";
  exchangeRateMode: "MANUAL" | "CONNECTED_PROVIDER";
  exchangeRateProviderConnectionId: string | null;
}

export type ExchangeRate = ExchangeRateRecord;
export type ExchangeRateSnapshot = MoneyExchangeRateSnapshot;

export interface WorkspaceLocaleRegionConfiguration {
  supportedLocales: WorkspaceLocale[];
  defaultLocale: WorkspaceLocale;
  timezone: string;
  countryCode: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  weekStartsOn: 0 | 1;
  currencies: CurrencyConfiguration;
  exchangeRates: ExchangeRate[];
}

export interface WorkspaceOperationalConfiguration {
  revision: number;
  businessInformation: WorkspaceBusinessInformation;
  addresses: BusinessAddress[];
  localeRegion: WorkspaceLocaleRegionConfiguration;
  updatedAt: string;
}
import type { ExchangeRateRecord, ExchangeRateSnapshot as MoneyExchangeRateSnapshot } from "@/shared/money";
