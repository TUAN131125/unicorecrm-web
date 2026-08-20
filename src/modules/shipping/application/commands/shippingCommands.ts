import { normalizeApplicationError } from "@/shared/domain";
import { isPositiveMoney } from "@/shared/money";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability, assertRuntimeWorkspaceAccess } from "@/platform/access-control";
import { recordOperationalAudit } from "@/platform/operational-audit";
import type { ShippingProviderRegistry } from "../ports/ShippingProviderRegistry";
import type { ShippingRepository } from "../ports/ShippingRepository";
import type { Money, RecipientSnapshot, ShippingBooking, ShippingPackageSnapshot, ShippingPurpose, ShippingSourceType } from "../../domain/model/shipping.types";
import { assertShippingBookingInput, evaluateShippingBookingReadiness } from "../../domain/rules/shippingRules";

export interface CreateShippingBookingCommand {
  id: string;
  workspaceId: string;
  code: string;
  sourceType: ShippingSourceType;
  sourceId: string;
  purpose: ShippingPurpose;
  transportMode?: ShippingBooking["transportMode"];
  providerId: string;
  serviceCode?: string;
  serviceName?: string;
  pickupLocationSnapshot: NonNullable<ShippingBooking["pickupLocationSnapshot"]>;
  returnLocationSnapshot?: ShippingBooking["returnLocationSnapshot"];
  recipientSnapshot: RecipientSnapshot;
  packageSnapshot: ShippingPackageSnapshot;
  codAmount?: Money;
  shipmentGroupId: string;
  attemptNo?: number;
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

export async function createShippingBooking(repository: ShippingRepository, providers: ShippingProviderRegistry, command: CreateShippingBookingCommand): Promise<ShippingBooking> {
  assertRuntimeWorkspaceAccess(command.workspaceId);
  assertRuntimeCapability(CAPABILITIES.SHIPPING_CREATE);
  const replay = repository.findByIdempotencyKey(command.idempotencyKey);
  if (replay) return replay;
  const provider = providers.get(command.providerId);
  if (!provider) throw new Error(`Shipping provider ${command.providerId} is not configured.`);
  if (provider.status && provider.status !== "ACTIVE") throw new Error(`Shipping provider ${provider.name} is ${provider.status.toLowerCase()} and cannot create new bookings.`);
  if (provider.capabilities?.booking === false) throw new Error(`Shipping provider ${provider.name} does not support booking.`);
  const configuredService = provider.services?.find((service) => service.code === command.serviceCode && service.enabled)
    ?? (!command.serviceCode ? provider.services?.find((service) => service.enabled && (!command.transportMode || service.supportedModes.includes(command.transportMode))) : undefined);
  if (provider.services?.length && !configuredService) throw new Error(`Shipping service ${command.serviceCode || "(missing)"} is not enabled for ${provider.name}.`);
  const effectiveServiceCode = command.serviceCode ?? configuredService?.code;
  const effectiveServiceName = command.serviceName ?? configuredService?.name;
  if (command.codAmount && isPositiveMoney(command.codAmount) && (provider.capabilities?.cod === false || configuredService?.supportsCod === false)) {
    throw new Error(`Shipping provider or service does not support COD for this booking.`);
  }
  const now = command.now ?? new Date().toISOString();
  const shipmentGroupId = command.shipmentGroupId.trim();
  if (!shipmentGroupId) throw new Error("Shipping booking requires a shipmentGroupId.");
  const existingAttempts = repository.list().filter((item) => item.shipmentGroupId === shipmentGroupId);
  const attemptNo = command.attemptNo ?? existingAttempts.length + 1;
  const draft = {
    sourceType: command.sourceType,
    sourceId: command.sourceId,
    purpose: command.purpose,
    providerId: command.providerId,
    serviceCode: effectiveServiceCode,
    pickupLocationSnapshot: command.pickupLocationSnapshot,
    returnLocationSnapshot: command.returnLocationSnapshot,
    recipientSnapshot: command.recipientSnapshot,
    packageSnapshot: command.packageSnapshot,
  };
  assertShippingBookingInput(draft, provider.bookingRequirements);
  const readiness = evaluateShippingBookingReadiness(draft, provider.bookingRequirements, now);

  const pending: ShippingBooking = {
    id: command.id,
    workspaceId: command.workspaceId,
    code: command.code,
    sourceType: command.sourceType,
    sourceId: command.sourceId,
    purpose: command.purpose,
    transportMode: command.transportMode,
    providerId: provider.id,
    providerNameSnapshot: provider.name,
    serviceCode: effectiveServiceCode,
    serviceNameSnapshot: effectiveServiceName,
    bookingStatus: "PENDING",
    externalStatus: "UNKNOWN",
    pickupLocationSnapshot: structuredClone(command.pickupLocationSnapshot),
    returnLocationSnapshot: command.returnLocationSnapshot ? structuredClone(command.returnLocationSnapshot) : undefined,
    recipientSnapshot: structuredClone(command.recipientSnapshot),
    packageSnapshot: structuredClone(command.packageSnapshot),
    codAmount: command.codAmount,
    idempotencyKey: command.idempotencyKey,
    shipmentGroupId,
    attemptNo,
    readiness,
    correlationId: command.correlationId,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  repository.save(pending);
  recordOperationalAudit({ moduleKey: "shipping", recordId: pending.id, action: "ShippingBookingRequested", actorId: command.actorId, actorName: command.actorName, correlationId: command.correlationId, after: pending });
  try {
    const result = await provider.createBooking({ booking: pending });
    const booked = repository.save({ ...pending, bookingStatus: "BOOKED", externalStatus: result.externalStatus, externalBookingId: result.externalBookingId, trackingCode: result.trackingCode, externalUrl: result.externalUrl, shippingFee: result.shippingFee, providerUpdatedAt: result.providerUpdatedAt, lastSyncedAt: now, bookedAt: now, bookedBy: command.actorId, updatedAt: now, version: pending.version + 1 });
    recordOperationalAudit({ moduleKey: "shipping", recordId: booked.id, action: "ShippingBookingBooked", actorId: command.actorId, actorName: command.actorName, correlationId: command.correlationId, before: pending, after: booked });
    return booked;
  } catch (error) {
    const applicationError = normalizeApplicationError(error, {
      fallbackCode: "PROVIDER_CREATE_FAILED",
      fallbackCategory: "INTEGRATION",
      userMessage: "The Shipping provider could not create the booking.",
    });
    const failed = repository.save({
      ...pending,
      bookingStatus: "FAILED",
      lastErrorCode: applicationError.code,
      lastErrorMessage: applicationError.userMessage ?? "The Shipping provider could not create the booking.",
      updatedAt: now,
      version: pending.version + 1,
    });
    recordOperationalAudit({ moduleKey: "shipping", recordId: failed.id, action: "ShippingBookingFailed", actorId: command.actorId, actorName: command.actorName, correlationId: command.correlationId, before: pending, after: failed });
    return failed;
  }
}

export async function cancelShippingBooking(repository: ShippingRepository, providers: ShippingProviderRegistry, bookingId: string, input: { reason: string; actorId: string; actorName?: string; now?: string }): Promise<ShippingBooking> {
  const current = repository.findById(bookingId); if (!current) throw new Error(`Shipping booking ${bookingId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.SHIPPING_CANCEL, "shipping", current);
  if (!["PENDING", "BOOKED", "FAILED"].includes(current.bookingStatus)) throw new Error("Only active or failed bookings can be cancelled.");
  if (!input.reason.trim()) throw new Error("Cancellation reason is required.");
  const provider = providers.get(current.providerId);
  if (current.externalBookingId && provider?.cancelBooking) await provider.cancelBooking({ booking: current, reason: input.reason.trim() });
  const now = input.now ?? new Date().toISOString();
  const saved = repository.save({ ...current, bookingStatus: "CANCELLED", externalStatus: current.externalStatus === "UNKNOWN" ? "CANCELLED" : current.externalStatus, cancellationReason: input.reason.trim(), cancelledAt: now, updatedAt: now, version: current.version + 1 });
  recordOperationalAudit({ moduleKey: "shipping", recordId: saved.id, action: "ShippingBookingCancelled", actorId: input.actorId, actorName: input.actorName, reason: input.reason, before: current, after: saved });
  return saved;
}

export async function syncShippingBooking(repository: ShippingRepository, providers: ShippingProviderRegistry, bookingId: string, input: { actorId: string; actorName?: string; now?: string }): Promise<ShippingBooking> {
  const current = repository.findById(bookingId); if (!current) throw new Error(`Shipping booking ${bookingId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.SHIPPING_SYNC, "shipping", current);
  if (!current.externalBookingId) throw new Error("Booking has no external reference to sync.");
  const provider = providers.get(current.providerId); if (!provider?.syncBooking) throw new Error("Provider does not support sync.");
  const snapshot = await provider.syncBooking(current.externalBookingId);
  const now = input.now ?? new Date().toISOString();
  const saved = repository.save({ ...current, externalStatus: snapshot.externalStatus, deliveredAt: snapshot.deliveredAt ?? current.deliveredAt, providerUpdatedAt: snapshot.providerUpdatedAt, trackingCode: snapshot.trackingCode ?? current.trackingCode, externalUrl: snapshot.externalUrl ?? current.externalUrl, codCollectedAmount: snapshot.codCollectedAmount ?? current.codCollectedAmount, codCollectedAt: snapshot.codCollectedAt ?? current.codCollectedAt, lastSyncedAt: now, lastErrorCode: undefined, lastErrorMessage: undefined, updatedAt: now, version: current.version + 1 });
  recordOperationalAudit({ moduleKey: "shipping", recordId: saved.id, action: "ShippingBookingSynced", actorId: input.actorId, actorName: input.actorName, before: current, after: saved });
  return saved;
}

export async function retryShippingBooking(repository: ShippingRepository, providers: ShippingProviderRegistry, bookingId: string, input: { id: string; code: string; providerId?: string; actorId: string; actorName?: string; now?: string }): Promise<ShippingBooking> {
  const current = repository.findById(bookingId); if (!current) throw new Error(`Shipping booking ${bookingId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.SHIPPING_RETRY, "shipping", current);
  if (current.bookingStatus !== "FAILED") throw new Error("Only failed bookings can be retried.");
  const shipmentGroupId = current.shipmentGroupId?.trim();
  if (!shipmentGroupId) throw new Error("Shipping booking has no authoritative shipment group and cannot be retried.");
  if (!current.workspaceId || !current.correlationId) throw new Error("Shipping retry requires workspace and correlation evidence.");
  return createShippingBooking(repository, providers, { ...current, workspaceId: current.workspaceId, correlationId: current.correlationId, id: input.id, code: input.code, providerId: input.providerId ?? current.providerId, shipmentGroupId, attemptNo: undefined, idempotencyKey: `shipping-booking:${shipmentGroupId}:attempt:${input.id}`, actorId: input.actorId, actorName: input.actorName, now: input.now });
}

export async function changeShippingProvider(repository: ShippingRepository, providers: ShippingProviderRegistry, bookingId: string, input: { id: string; code: string; providerId: string; actorId: string; actorName?: string; now?: string }): Promise<ShippingBooking> {
  const current = repository.findById(bookingId); if (!current) throw new Error(`Shipping booking ${bookingId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.SHIPPING_RETRY, "shipping", current);
  if (current.bookingStatus === "BOOKED") throw new Error("Booked shipping cannot change provider in place. Cancel first when policy allows, then create a new booking.");
  const shipmentGroupId = current.shipmentGroupId?.trim();
  if (!shipmentGroupId) throw new Error("Shipping booking has no authoritative shipment group and cannot change provider.");
  if (!current.workspaceId || !current.correlationId) throw new Error("Shipping provider change requires workspace and correlation evidence.");
  return createShippingBooking(repository, providers, { ...current, workspaceId: current.workspaceId, correlationId: current.correlationId, id: input.id, code: input.code, providerId: input.providerId, shipmentGroupId, attemptNo: undefined, idempotencyKey: `shipping-booking:${shipmentGroupId}:provider:${input.providerId}:attempt:${input.id}`, actorId: input.actorId, actorName: input.actorName, now: input.now });
}
