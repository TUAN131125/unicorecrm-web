import { createMutationMetadata, runBackendProjection, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { cancelShippingBooking, changeShippingProvider, createShippingBooking, retryShippingBooking, syncShippingBooking } from "../application/commands/shippingCommands";
import { getShippingBookingsForSource, getShippingKpis, queryShippingBookings } from "../application/queries/shippingQueries";
import { getShippingApiRuntime, shippingProviderRegistry, shippingRepository } from "../application/composition/shippingApplicationServices";
import type { ShippingMutationEvidence, ShippingMutationResult } from "../application/ports/ShippingApiRuntime";
export type * from "../domain/model/shipping.types";
export type { ShippingProvider } from "../domain/model/shippingProvider";
export const getShippingSnapshot = () => shippingRepository.list();
export const replaceShippingSnapshot = (records: ReturnType<typeof shippingRepository.list>) => shippingRepository.replace(records);
export const getShippingBookingSnapshot = (id: string) => shippingRepository.findById(id);
export const subscribeToShipping = (listener: Parameters<typeof shippingRepository.subscribe>[0]) => shippingRepository.subscribe(listener);
export const getShippingBookingsForSourceSnapshot = (sourceType: string, sourceId: string) => getShippingBookingsForSource(shippingRepository, sourceType, sourceId);
export const queryShippingSnapshot = (input?: Parameters<typeof queryShippingBookings>[1]) => queryShippingBookings(shippingRepository, input);
export const getShippingKpisSnapshot = () => getShippingKpis(shippingRepository);
export const listShippingProviders = () => shippingProviderRegistry.list();
export const getShippingProviderSnapshot = (providerId: string) => shippingProviderRegistry.get(providerId);
export { getShippingApiRuntime } from "../application/composition/shippingApplicationServices";

export type ShippingLifecycleMutationMetadata = Partial<MutationCommandMetadata>;

export async function createShippingBookingCommandBoundary(command: Omit<Parameters<typeof createShippingBooking>[2], "workspaceId">, metadata: ShippingLifecycleMutationMetadata = {}): Promise<MutationOutcome<Awaited<ReturnType<typeof createShippingBooking>>>> {
  const options = createMutationMetadata(`shipping.create-booking:${command.id}`, {
    ...metadata,
    idempotencyKey: metadata.idempotencyKey ?? command.idempotencyKey,
    correlationId: metadata.correlationId ?? command.correlationId,
  });
  const result = await getShippingApiRuntime().commands.createBooking({
    clientLocalId: command.id,
    clientCode: command.code,
    sourceType: command.sourceType,
    sourceId: command.sourceId,
    purpose: command.purpose,
    transportMode: command.transportMode,
    providerId: command.providerId,
    serviceCode: command.serviceCode,
    serviceName: command.serviceName,
    pickupLocationSnapshot: command.pickupLocationSnapshot,
    returnLocationSnapshot: command.returnLocationSnapshot,
    recipientSnapshot: command.recipientSnapshot,
    packageSnapshot: command.packageSnapshot,
    codAmount: command.codAmount,
    shipmentGroupId: command.shipmentGroupId,
  }, options);
  projectBooking(result.booking);
  return shippingOutcome("shipping.create-booking", options, result);
}

export async function cancelShippingBookingCommandBoundary(id: string, input: Parameters<typeof cancelShippingBooking>[3], metadata: ShippingLifecycleMutationMetadata = {}): Promise<MutationOutcome<Awaited<ReturnType<typeof cancelShippingBooking>>>> {
  const current = getShippingBookingSnapshot(id);
  const options = versionedOptions(id, "cancel-booking", current?.version, metadata, input);
  const result = await getShippingApiRuntime().commands.cancelBooking(id, { reason: input.reason }, options);
  projectBooking(result.booking);
  return shippingOutcome("shipping.cancel-booking", options, result);
}

export async function syncShippingBookingCommandBoundary(id: string, input: Parameters<typeof syncShippingBooking>[3], metadata: ShippingLifecycleMutationMetadata = {}): Promise<MutationOutcome<Awaited<ReturnType<typeof syncShippingBooking>>>> {
  const current = getShippingBookingSnapshot(id);
  const options = versionedOptions(id, "sync-booking", current?.version, metadata, input);
  const result = await getShippingApiRuntime().commands.syncBooking(id, options);
  projectBooking(result.booking);
  return shippingOutcome("shipping.sync-booking", options, result);
}

export async function retryShippingBookingCommandBoundary(id: string, input: Parameters<typeof retryShippingBooking>[3], metadata: ShippingLifecycleMutationMetadata = {}): Promise<MutationOutcome<Awaited<ReturnType<typeof retryShippingBooking>>>> {
  const current = getShippingBookingSnapshot(id);
  const options = versionedOptions(id, "retry-booking", current?.version, metadata, input);
  const result = await getShippingApiRuntime().commands.retryBooking(id, {
    providerId: input.providerId,
    clientLocalId: input.id,
    clientCode: input.code,
  }, options);
  projectBooking(result.booking);
  return shippingOutcome("shipping.retry-booking", options, result);
}

export async function changeShippingProviderCommandBoundary(id: string, input: Parameters<typeof changeShippingProvider>[3], metadata: ShippingLifecycleMutationMetadata = {}): Promise<MutationOutcome<Awaited<ReturnType<typeof changeShippingProvider>>>> {
  const current = getShippingBookingSnapshot(id);
  const options = versionedOptions(id, "change-provider", current?.version, metadata, input);
  const result = await getShippingApiRuntime().commands.changeProvider(id, {
    providerId: input.providerId,
    clientLocalId: input.id,
    clientCode: input.code,
  }, options);
  projectBooking(result.booking);
  return shippingOutcome("shipping.change-provider", options, result);
}

function versionedOptions(
  id: string,
  operation: string,
  currentVersion: number | undefined,
  metadata: ShippingLifecycleMutationMetadata,
  actor: { actorId?: string; actorName?: string },
) {
  const expectedVersion = metadata.expectedVersion ?? currentVersion;
  if (typeof expectedVersion !== "number") throw new Error(`SHIPPING_BOOKING_RESOURCE_VERSION_REQUIRED:${id}:${operation}`);
  return {
    ...createMutationMetadata(`shipping.${operation}:${id}`, {
      ...metadata,
      expectedVersion,
      actor: metadata.actor ?? { id: actor.actorId, name: actor.actorName },
    }),
    expectedVersion,
  };
}

function projectBooking(booking: Awaited<ReturnType<typeof createShippingBooking>>): void {
  runBackendProjection("shipping", () => {
    const current = shippingRepository.list();
    shippingRepository.replace(current.some((item) => item.id === booking.id)
      ? current.map((item) => item.id === booking.id ? booking : item)
      : [...current, booking]);
  });
}

function shippingOutcome(commandType: string, options: MutationCommandMetadata, result: ShippingMutationResult): MutationOutcome<Awaited<ReturnType<typeof createShippingBooking>>> {
  return mutationOutcome(commandType, options, result.evidence, result.booking);
}

function mutationOutcome(
  commandType: string,
  options: MutationCommandMetadata,
  evidence: ShippingMutationEvidence,
  data: Awaited<ReturnType<typeof createShippingBooking>>,
): MutationOutcome<Awaited<ReturnType<typeof createShippingBooking>>> {
  return {
    data,
    commandId: evidence.commandId,
    commandType,
    aggregateType: evidence.aggregateType,
    aggregateId: evidence.aggregateId,
    idempotencyKey: options.idempotencyKey,
    correlationId: evidence.correlationId,
    occurredAt: evidence.occurredAt,
    version: evidence.version,
    outcome: evidence.outcome,
    warnings: [...evidence.warnings],
    emittedEvents: [...evidence.emittedEventIds],
    audit: { authority: evidence.authority === "backend" ? "backend" : "demo", evidenceIds: [...evidence.auditEvidenceIds] },
  };
}

export const createShippingBookingSnapshot = (command: Omit<Parameters<typeof createShippingBooking>[2], "workspaceId">) => createShippingBooking(shippingRepository, shippingProviderRegistry, { ...command, workspaceId: getWorkspaceContextSnapshot().workspaceId });
export const cancelShippingBookingSnapshot = (id: string, input: Parameters<typeof cancelShippingBooking>[3]) => cancelShippingBooking(shippingRepository, shippingProviderRegistry, id, input);
export const syncShippingBookingSnapshot = (id: string, input: Parameters<typeof syncShippingBooking>[3]) => syncShippingBooking(shippingRepository, shippingProviderRegistry, id, input);
export const retryShippingBookingSnapshot = (id: string, input: Parameters<typeof retryShippingBooking>[3]) => retryShippingBooking(shippingRepository, shippingProviderRegistry, id, input);
export const changeShippingProviderSnapshot = (id: string, input: Parameters<typeof changeShippingProvider>[3]) => changeShippingProvider(shippingRepository, shippingProviderRegistry, id, input);
export type { PickupLocationConfiguration, ShippingProviderSetup, ShippingProviderCapabilities, ShippingProviderEnvironment, ShippingProviderStatus, ShippingServiceConfig } from "../domain/model/shippingConfiguration.types";
export {
  getPickupLocations,
  getReturnLocations,
  getShippingProviderConfigurations,
  saveShippingProviderConfigurations,
} from "../application/composition/shippingApplicationServices";

export { evaluateShippingBookingReadiness, getShippingRequirementGroup, isDeliveredShippingEvidence, isTerminalShippingFailureEvidence } from "../domain/rules/shippingRules";
