import type { ExternalShippingSnapshot } from "../../../domain/model/shipping.types";
import type { ShippingProvider } from "../../../domain/model/shippingProvider";

const snapshots = new Map<string, ExternalShippingSnapshot>();

/** Manual provider never fabricates carrier progress. Operations must record
 * externally verified status through an authoritative backend/manual-evidence flow. */
export class ManualShippingProvider implements ShippingProvider {
  readonly id = "manual";
  readonly name = "Manual Provider";
  readonly bookingRequirements = { serviceCode: false, administrativeCodes: false, dimensions: false, lineAllocations: false, declaredValue: false, feePayer: false, inspectionPolicy: false } as const;

  async createBooking({ booking }: Parameters<ShippingProvider["createBooking"]>[0]) {
    const externalBookingId = `manual_${booking.id}`;
    const snapshot: ExternalShippingSnapshot = {
      externalStatus: "ACCEPTED",
      providerUpdatedAt: new Date().toISOString(),
      trackingCode: `MANUAL-${booking.code}`,
    };
    snapshots.set(externalBookingId, snapshot);
    return { externalBookingId, ...snapshot };
  }

  async cancelBooking(): Promise<void> { return; }

  async syncBooking(externalBookingId: string) {
    const snapshot = snapshots.get(externalBookingId);
    if (!snapshot) throw new Error("MANUAL_SHIPPING_EVIDENCE_NOT_FOUND");
    return structuredClone(snapshot);
  }

  static recordVerifiedSnapshot(externalBookingId: string, snapshot: ExternalShippingSnapshot): void {
    snapshots.set(externalBookingId, structuredClone(snapshot));
  }
}
