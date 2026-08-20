import type { StoragePort } from "@/platform/persistence";
import type { WorkspaceOperationalConfigurationRepository, WorkspaceOperationalConfigurationListener } from "./WorkspaceOperationalConfigurationRepository";
import type { WorkspaceOperationalConfiguration } from "./workspaceOperationalConfiguration.types";

const STORAGE_KEY = "workspace-operational-configuration";

export function createDefaultWorkspaceOperationalConfiguration(): WorkspaceOperationalConfiguration {
  return {
    revision: 1,
    businessInformation: {
      displayName: "Unicore Vietnam",
      tradingName: "Unicore",
      legalName: "Công ty TNHH Unicore Việt Nam",
      registrationNumber: "",
      taxId: "",
      industry: "Phần mềm doanh nghiệp",
      representativeName: "",
      email: "hello@unicore.vn",
      supportEmail: "support@unicore.vn",
      billingEmail: "billing@unicore.vn",
      phone: "",
      website: "https://unicore.vn",
      logoReference: "",
    },
    addresses: [{
      id: "address-main",
      name: "Văn phòng chính",
      purposes: ["REGISTERED", "OPERATING", "INVOICE", "PICKUP", "RETURN"],
      addressLine1: "",
      addressLine2: "",
      countryCode: "VN",
      provinceCode: "",
      districtCode: "",
      wardCode: "",
      postalCode: "",
      contactName: "",
      contactPhone: "",
      active: true,
    }],
    localeRegion: {
      supportedLocales: ["vi", "en"],
      defaultLocale: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      countryCode: "VN",
      dateFormat: "DD/MM/YYYY",
      weekStartsOn: 1,
      currencies: {
        baseCurrency: "VND",
        enabledCurrencies: ["VND"],
        displayMode: "FULL",
        exchangeRateMode: "MANUAL",
        exchangeRateProviderConnectionId: null,
      },
      exchangeRates: [],
    },
    updatedAt: "2026-07-22T00:00:00.000Z",
  };
}

export class BrowserWorkspaceOperationalConfigurationRepository implements WorkspaceOperationalConfigurationRepository {
  private readonly listeners = new Set<WorkspaceOperationalConfigurationListener>();
  private current: WorkspaceOperationalConfiguration;

  constructor(private readonly storage: StoragePort) {
    this.current = this.storage.get<WorkspaceOperationalConfiguration>(STORAGE_KEY)
      ?? createDefaultWorkspaceOperationalConfiguration();
  }

  getSnapshot(): WorkspaceOperationalConfiguration {
    return structuredClone(this.current);
  }

  update(updater: (current: WorkspaceOperationalConfiguration) => WorkspaceOperationalConfiguration): WorkspaceOperationalConfiguration {
    const value = updater(this.getSnapshot());
    this.current = {
      ...structuredClone(value),
      revision: this.current.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.storage.set(STORAGE_KEY, this.current);
    this.listeners.forEach((listener) => listener(this.getSnapshot()));
    return this.getSnapshot();
  }

  subscribe(listener: WorkspaceOperationalConfigurationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
