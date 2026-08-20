import type { ShippingBooking } from "../../domain/model/shipping.types";
export interface ShippingRepository {
  list(): ShippingBooking[];
  findById(id: string): ShippingBooking | undefined;
  findByIdempotencyKey(key: string): ShippingBooking | undefined;
  save(record: ShippingBooking): ShippingBooking;
  replace(records: ShippingBooking[]): void;
  subscribe(listener: (records: ShippingBooking[]) => void): () => void;
}
