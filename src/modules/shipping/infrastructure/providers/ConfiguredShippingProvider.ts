import type { ShippingProvider } from "../../domain/model/shippingProvider";
import type { ShippingProviderSetup } from "../../domain/model/shippingConfiguration.types";
import { compareMoney, isPositiveMoney, money } from "@/shared/money";

const syncCounts = new Map<string, number>();

function connectedAdapterRequired(providerName: string): never {
  throw new Error(`SHIPPING_CONNECTED_PROVIDER_REQUIRED:${providerName}`);
}

export class ConfiguredShippingProvider implements ShippingProvider {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: ShippingProviderSetup["status"];
  readonly environment: ShippingProviderSetup["environment"];
  readonly isDefault: boolean;
  readonly capabilities: ShippingProviderSetup["capabilities"];
  readonly services: ShippingProviderSetup["services"];
  readonly bookingRequirements = {
    serviceCode: true,
    administrativeCodes: false,
    dimensions: false,
    lineAllocations: false,
    declaredValue: false,
    feePayer: false,
    inspectionPolicy: false,
  } as const;

  readonly cancelBooking?: ShippingProvider["cancelBooking"];
  readonly syncBooking?: ShippingProvider["syncBooking"];
  readonly getQuotes?: ShippingProvider["getQuotes"];

  constructor(readonly setup: ShippingProviderSetup) {
    this.id = setup.id;
    this.code = setup.providerCode;
    this.name = setup.name;
    this.status = setup.status;
    this.environment = setup.environment;
    this.isDefault = setup.isDefault;
    this.capabilities = setup.capabilities;
    this.services = setup.services.filter((service) => service.enabled);

    if (setup.capabilities.cancel) this.cancelBooking = async () => setup.environment === "PRODUCTION" ? connectedAdapterRequired(this.name) : undefined;
    if (setup.capabilities.sync) this.syncBooking = async (externalBookingId) => setup.environment === "PRODUCTION" ? connectedAdapterRequired(this.name) : this.simulateSync(externalBookingId);
    if (setup.capabilities.quote) {
      this.getQuotes = async ({ booking }) => setup.environment === "PRODUCTION" ? connectedAdapterRequired(this.name) : this.services.map((service) => ({
        providerId: this.id,
        providerName: this.name,
        serviceCode: service.code,
        serviceName: service.name,
        fee: money(String(Math.max(15_000, Math.round((booking.packageSnapshot.totalWeightGrams || 1_000) / 1_000) * 8_000)), booking.codAmount?.currency ?? "VND"),
        estimatedDays: service.estimatedDays,
      }));
    }
  }

  supportsMode(mode: Parameters<NonNullable<ShippingProvider["supportsMode"]>>[0]): boolean {
    return this.services.some((service) => service.supportedModes.includes(mode));
  }

  async createBooking({ booking }: Parameters<ShippingProvider["createBooking"]>[0]) {
    if (this.environment === "PRODUCTION") connectedAdapterRequired(this.name);
    if (this.status !== "ACTIVE") throw new Error(`Shipping provider ${this.name} is ${this.status.toLowerCase()} and cannot create new bookings.`);
    if (!this.capabilities.booking) throw new Error(`Shipping provider ${this.name} does not support booking.`);
    const service = this.services.find((item) => item.code === booking.serviceCode);
    if (!service) throw new Error(`Shipping service ${booking.serviceCode || "(missing)"} is not enabled for ${this.name}.`);
    if (booking.codAmount && isPositiveMoney(booking.codAmount)) {
      if (!this.capabilities.cod || !service.supportsCod) throw new Error(`Shipping service ${service.name} does not support COD.`);
      if (service.maxCodAmount && compareMoney(booking.codAmount, money(String(service.maxCodAmount), booking.codAmount.currency)) > 0) throw new Error(`COD amount exceeds the configured limit for ${service.name}.`);
    }
    if (service.maxWeightGrams && booking.packageSnapshot.totalWeightGrams > service.maxWeightGrams) throw new Error(`Package weight exceeds the configured limit for ${service.name}.`);
    const externalBookingId = `${this.code}_${booking.id}`;
    syncCounts.set(externalBookingId, 0);
    return {
      externalBookingId,
      trackingCode: `TRK-${booking.code}`,
      externalStatus: "ACCEPTED" as const,
      providerUpdatedAt: new Date().toISOString(),
      externalUrl: undefined,
    };
  }

  private async simulateSync(externalBookingId: string) {
    const nextCount = (syncCounts.get(externalBookingId) ?? 0) + 1;
    syncCounts.set(externalBookingId, nextCount);
    const now = new Date().toISOString();
    if (nextCount >= 3) return { externalStatus: "DELIVERED" as const, deliveredAt: now, providerUpdatedAt: now, trackingCode: externalBookingId.replace(`${this.code}_`, "TRK-") };
    if (nextCount === 2) return { externalStatus: "IN_TRANSIT" as const, providerUpdatedAt: now, trackingCode: externalBookingId.replace(`${this.code}_`, "TRK-") };
    return { externalStatus: "WAITING_PICKUP" as const, providerUpdatedAt: now, trackingCode: externalBookingId.replace(`${this.code}_`, "TRK-") };
  }
}
