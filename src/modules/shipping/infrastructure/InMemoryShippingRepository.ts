import type { ShippingRepository } from "../application/ports/ShippingRepository";
import type { ShippingBooking } from "../domain/model/shipping.types";
import { normalizeShippingBookingSnapshot, normalizeShippingBookingSnapshots } from "./shippingBookingSnapshot";

type ShippingBookingSeed = Parameters<typeof normalizeShippingBookingSnapshot>[0];

export class InMemoryShippingRepository implements ShippingRepository {
  private records: ShippingBooking[];
  private readonly listeners = new Set<(records: ShippingBooking[]) => void>();

  constructor(seed: readonly ShippingBookingSeed[] = []) {
    this.records = normalizeShippingBookingSnapshots(seed);
  }

  list(): ShippingBooking[] {
    return structuredClone(this.records);
  }

  findById(id: string): ShippingBooking | undefined {
    const found = this.records.find((item) => item.id === id);
    return found ? structuredClone(found) : undefined;
  }

  findByIdempotencyKey(key: string): ShippingBooking | undefined {
    const found = this.records.find((item) => item.idempotencyKey === key);
    return found ? structuredClone(found) : undefined;
  }

  save(record: ShippingBooking): ShippingBooking {
    const normalized = normalizeShippingBookingSnapshot(record);
    this.records = [normalized, ...this.records.filter((item) => item.id !== normalized.id)];
    this.emit();
    return structuredClone(normalized);
  }

  replace(records: ShippingBooking[]): void {
    this.records = normalizeShippingBookingSnapshots(records);
    this.emit();
  }

  subscribe(listener: (records: ShippingBooking[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.list();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
