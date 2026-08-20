import type { StoragePort } from "@/platform/persistence";
import type { IntegrationConfigurationRepository } from "./IntegrationConfigurationRepository";
import type { IntegrationConfiguration, IntegrationConnection, IntegrationProvider } from "./integrationConfiguration.types";

const KEY = "integration-configuration";
const providers: IntegrationProvider[] = [
  { code: "email", category: "EMAIL", name: "Email", descriptionVi: "Gửi email giao dịch và chăm sóc.", descriptionEn: "Send transactional and relationship email." },
  { code: "zalo", category: "MESSAGING", name: "Zalo", descriptionVi: "Gửi tin nhắn qua Zalo OA.", descriptionEn: "Send messages through Zalo OA." },
  { code: "shipping", category: "SHIPPING", name: "Shipping provider", descriptionVi: "Đặt và theo dõi vận chuyển.", descriptionEn: "Book and track shipments." },
  { code: "payment", category: "PAYMENT", name: "Payment provider", descriptionVi: "Tạo yêu cầu thanh toán.", descriptionEn: "Create payment requests." },
  { code: "e-invoice", category: "E_INVOICE", name: "E-invoice", descriptionVi: "Phát hành hóa đơn điện tử.", descriptionEn: "Issue electronic invoices." },
  { code: "exchange-rate", category: "EXCHANGE_RATE", name: "Exchange-rate provider", descriptionVi: "Cung cấp tỷ giá đã xác minh.", descriptionEn: "Provide verified exchange rates." },
];

export class BrowserIntegrationConfigurationRepository implements IntegrationConfigurationRepository {
  private readonly listeners = new Set<(value: IntegrationConfiguration) => void>();
  private current: IntegrationConfiguration;

  constructor(private readonly storage: StoragePort) {
    this.current = this.storage.get<IntegrationConfiguration>(KEY) ?? { revision: 1, providers, connections: [] };
  }

  getSnapshot(): IntegrationConfiguration { return structuredClone(this.current); }

  saveConnection(value: IntegrationConnection): IntegrationConfiguration {
    const saved = { ...structuredClone(value), status: "PENDING_VERIFICATION" as const, version: value.version + 1 };
    this.current = { revision: this.current.revision + 1, providers, connections: [...this.current.connections.filter((item) => item.id !== value.id), saved] };
    return this.persist();
  }

  verifyConnection(connectionId: string): IntegrationConfiguration {
    this.current = {
      ...this.current,
      revision: this.current.revision + 1,
      connections: this.current.connections.map((item) => item.id === connectionId
        ? { ...item, status: "CONNECTED", lastVerifiedAt: new Date().toISOString(), version: item.version + 1 }
        : item),
    };
    return this.persist();
  }

  disconnect(connectionId: string): IntegrationConfiguration {
    this.current = {
      ...this.current,
      revision: this.current.revision + 1,
      connections: this.current.connections.map((item) => item.id === connectionId
        ? { ...item, status: "DISCONNECTED", version: item.version + 1 }
        : item),
    };
    return this.persist();
  }

  subscribe(listener: (value: IntegrationConfiguration) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private persist(): IntegrationConfiguration {
    this.storage.set(KEY, this.current);
    this.listeners.forEach((listener) => listener(this.getSnapshot()));
    return this.getSnapshot();
  }
}
