import type { ShippingBooking } from "../domain/model/shipping.types";

type StoredShippingBooking = Omit<ShippingBooking, "shipmentGroupId"> & {
  shipmentGroupId?: string;
  attemptGroup?: string;
};

function resolveShipmentGroupId(record: StoredShippingBooking): string {
  const explicit = record.shipmentGroupId?.trim();
  if (explicit) return explicit;

  const legacy = record.attemptGroup?.trim();
  if (legacy) return legacy.split(":provider-change")[0] || legacy;

  return `shipment:${record.sourceType}:${record.sourceId}:${record.id}`;
}

export function normalizeShippingBookingSnapshot(record: StoredShippingBooking): ShippingBooking {
  const { attemptGroup: _legacyAttemptGroup, ...canonical } = record;
  return {
    ...structuredClone(canonical),
    shipmentGroupId: resolveShipmentGroupId(record),
  };
}

export function normalizeShippingBookingSnapshots(records: readonly StoredShippingBooking[]): ShippingBooking[] {
  return records.map(normalizeShippingBookingSnapshot);
}
