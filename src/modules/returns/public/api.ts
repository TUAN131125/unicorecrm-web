import { createMutationMetadata, runBackendProjection, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { approveReturn, closeReturn, completeRepairIntentFromEvidence, completeReturnResolution, configureReturnMethod, confirmReturnedItemsReceived, createReturnRequest, failReturnIntent, inspectReturnedItems, linkReturnIntentExternalReference, linkReturnIntentExternalReferences, markReturnAwaitingItem, rejectReturn, requestCreditNoteResolution, requestRefundResolution, requestRepairResolution, requestReplacementResolution, succeedReturnIntent } from "../application/commands/returnCommands";
import { getReturnStats, queryReturns } from "../application/queries/returnQueries";
import { getReturnApiRuntime, returnRepository } from "../application/composition/returnApplicationServices";
import type { ReturnMutationEvidence, ReturnMutationResult } from "../application/ports/ReturnApiRuntime";
export type * from "../domain/model/return.types";
export { canTransitionReturn,getAllowedReturnTransitions } from "../domain/rules/returnLifecycle";
export type { ReturnRepository } from "../application/ports/ReturnRepository";

export type ReturnLifecycleMutationMetadata = Partial<MutationCommandMetadata>;

export async function createReturnRequestCommand(
  command: Omit<Parameters<typeof createReturnRequest>[1], "workspaceId">,
  metadata: ReturnLifecycleMutationMetadata = {},
): Promise<MutationOutcome<ReturnType<typeof createReturnRequest>>> {
  const options = createMutationMetadata(`return.create:${command.id}`, {
    ...metadata,
    correlationId: metadata.correlationId ?? command.correlationId,
    actor: metadata.actor ?? { id: command.actorId, name: command.actorName },
  });
  const result = await getReturnApiRuntime().commands.create({
    clientLocalId: command.id,
    clientCode: command.code,
    orderId: command.orderId,
    buyerRef: command.buyerRef,
    ownerId: command.ownerId,
    items: command.items,
    reason: command.reason,
    requestedResolution: command.requestedResolution,
    note: command.note,
    deliveredAt: command.deliveredAt,
    deliveryEvidenceShippingBookingId: command.deliveryEvidenceShippingBookingId,
    manualDeliveryEvidence: command.manualDeliveryEvidence,
    returnWindowDays: command.returnWindowDays,
  }, options);
  projectReturn(result.request);
  return returnOutcome("return.create", options, result);
}
const returnMetadata = (returnId: string, prefix: string, input: { actorId?: string; actorName?: string }, metadata: ReturnLifecycleMutationMetadata) => {
  const current = returnRepository.findById(returnId);
  const expectedVersion = metadata.expectedVersion ?? current?.version;
  if (typeof expectedVersion !== "number") throw new Error(`RETURN_RESOURCE_VERSION_REQUIRED:${returnId}:${prefix}`);
  return {
    ...createMutationMetadata(`${prefix}:${returnId}`, { ...metadata, expectedVersion, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } }),
    expectedVersion,
  };
};

export async function approveReturnCommand(returnId: string, input: Parameters<typeof approveReturn>[2], metadata: ReturnLifecycleMutationMetadata = {}): Promise<MutationOutcome<ReturnType<typeof approveReturn>>> {
  const options = returnMetadata(returnId, "return.approve", input, metadata);
  const result = await getReturnApiRuntime().commands.approve(returnId, {
    reason: input.reason,
    overrideReason: input.overrideReason,
    items: input.items,
  }, options);
  projectReturn(result.request);
  return returnOutcome("return.approve", options, result);
}
export async function rejectReturnCommand(returnId: string, input: Parameters<typeof rejectReturn>[2], metadata: ReturnLifecycleMutationMetadata = {}): Promise<MutationOutcome<ReturnType<typeof rejectReturn>>> {
  const options = returnMetadata(returnId, "return.reject", input, metadata);
  const result = await getReturnApiRuntime().commands.reject(returnId, { reason: input.reason }, options);
  projectReturn(result.request);
  return returnOutcome("return.reject", options, result);
}
export async function markReturnAwaitingItemCommand(returnId: string, input: Parameters<typeof markReturnAwaitingItem>[2], metadata: ReturnLifecycleMutationMetadata = {}): Promise<MutationOutcome<ReturnType<typeof markReturnAwaitingItem>>> {
  const options = returnMetadata(returnId, "return.await-item", input, metadata);
  const result = await getReturnApiRuntime().commands.awaitItem(returnId, { shippingBookingId: input.shippingBookingId }, options);
  projectReturn(result.request);
  return returnOutcome("return.await-item", options, result);
}
export async function confirmReturnedItemsReceivedCommand(returnId: string, input: Parameters<typeof confirmReturnedItemsReceived>[2], metadata: ReturnLifecycleMutationMetadata = {}): Promise<MutationOutcome<ReturnType<typeof confirmReturnedItemsReceived>>> {
  const options = returnMetadata(returnId, "return.receive-items", input, metadata);
  const result = await getReturnApiRuntime().commands.receiveItems(returnId, { items: input.items, conditionNote: input.conditionNote }, options);
  projectReturn(result.request);
  return returnOutcome("return.receive-items", options, result);
}
export async function completeReturnResolutionCommand(returnId: string, input: Parameters<typeof completeReturnResolution>[2], metadata: ReturnLifecycleMutationMetadata = {}): Promise<MutationOutcome<ReturnType<typeof completeReturnResolution>>> {
  const options = returnMetadata(returnId, "return.complete-resolution", input, metadata);
  const result = await getReturnApiRuntime().commands.completeResolution(returnId, {
    resolution: input.resolution,
    intentId: input.intentId,
    intentIds: input.intentIds,
  }, options);
  projectReturn(result.request);
  return returnOutcome("return.complete-resolution", options, result);
}
export async function closeReturnCommand(returnId: string, input: Parameters<typeof closeReturn>[2], metadata: ReturnLifecycleMutationMetadata = {}): Promise<MutationOutcome<ReturnType<typeof closeReturn>>> {
  const options = returnMetadata(returnId, "return.close", input, metadata);
  const result = await getReturnApiRuntime().commands.close(returnId, options);
  projectReturn(result.request);
  return returnOutcome("return.close", options, result);
}
export async function configureReturnMethodCommand(returnId: string, input: Parameters<typeof configureReturnMethod>[2], metadata: ReturnLifecycleMutationMetadata = {}): Promise<MutationOutcome<ReturnType<typeof configureReturnMethod>>> {
  const options = returnMetadata(returnId, "return.configure-method", input, metadata);
  const result = await getReturnApiRuntime().commands.configureMethod(returnId, {
    method: input.method,
    shippingBookingId: input.shippingBookingId,
    carrier: input.carrier,
    trackingCode: input.trackingCode,
    dropOffLocation: input.dropOffLocation,
    returnByDate: input.returnByDate,
  }, options);
  projectReturn(result.request);
  return returnOutcome("return.configure-method", options, result);
}

function projectReturn(request: ReturnType<typeof createReturnRequest>): void {
  runBackendProjection("returns", () => {
    const current = returnRepository.snapshot();
    const requests = current.requests.some((item) => item.id === request.id)
      ? current.requests.map((item) => item.id === request.id ? request : item)
      : [...current.requests, request];
    returnRepository.replace({ requests, intents: current.intents });
  });
}

function returnOutcome(commandType: string, options: MutationCommandMetadata, result: ReturnMutationResult): MutationOutcome<ReturnType<typeof createReturnRequest>> {
  return mutationOutcome(commandType, options, result.evidence, result.request);
}

function mutationOutcome(
  commandType: string,
  options: MutationCommandMetadata,
  evidence: ReturnMutationEvidence,
  data: ReturnType<typeof createReturnRequest>,
): MutationOutcome<ReturnType<typeof createReturnRequest>> {
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

export const getReturnsSnapshot=()=>returnRepository.snapshot(); export const getReturnSnapshot=(returnId:string)=>returnRepository.findById(returnId); export const subscribeToReturns=(listener:Parameters<typeof returnRepository.subscribe>[0])=>returnRepository.subscribe(listener);
export const replaceReturnsSnapshot=(snapshot:ReturnType<typeof returnRepository.snapshot>)=>returnRepository.replace(snapshot);
export const createReturnRequestSnapshot=(command:Omit<Parameters<typeof createReturnRequest>[1],"workspaceId">)=>createReturnRequest(returnRepository,{...command,workspaceId:getWorkspaceContextSnapshot().workspaceId});
export const configureReturnMethodSnapshot=(id:string,input:Parameters<typeof configureReturnMethod>[2])=>configureReturnMethod(returnRepository,id,input); export const inspectReturnedItemsSnapshot=(id:string,input:Parameters<typeof inspectReturnedItems>[2])=>inspectReturnedItems(returnRepository,id,input);
export const requestRepairResolutionSnapshot=(id:string,input:Parameters<typeof requestRepairResolution>[2])=>requestRepairResolution(returnRepository,id,input); export const completeRepairIntentFromEvidenceSnapshot=(id:string,input:Parameters<typeof completeRepairIntentFromEvidence>[2])=>completeRepairIntentFromEvidence(returnRepository,id,input);
export const approveReturnRequest=(id:string,input:Parameters<typeof approveReturn>[2])=>approveReturn(returnRepository,id,input); export const rejectReturnRequest=(id:string,input:Parameters<typeof rejectReturn>[2])=>rejectReturn(returnRepository,id,input); export const markReturnAwaitingItemSnapshot=(id:string,input:Parameters<typeof markReturnAwaitingItem>[2])=>markReturnAwaitingItem(returnRepository,id,input); export const confirmReturnedItemsReceivedSnapshot=(id:string,input:Parameters<typeof confirmReturnedItemsReceived>[2])=>confirmReturnedItemsReceived(returnRepository,id,input); export const requestRefundResolutionSnapshot=(id:string,input:Parameters<typeof requestRefundResolution>[2])=>requestRefundResolution(returnRepository,id,input); export const requestReplacementResolutionSnapshot=(id:string,input:Parameters<typeof requestReplacementResolution>[2])=>requestReplacementResolution(returnRepository,id,input); export const linkReturnIntentExternalReferenceSnapshot=(id:string,input:Parameters<typeof linkReturnIntentExternalReference>[2])=>linkReturnIntentExternalReference(returnRepository,id,input); export const linkReturnIntentExternalReferencesSnapshot=(id:string,input:Parameters<typeof linkReturnIntentExternalReferences>[2])=>linkReturnIntentExternalReferences(returnRepository,id,input); export const succeedReturnIntentSnapshot=(id:string,input:Parameters<typeof succeedReturnIntent>[2])=>succeedReturnIntent(returnRepository,id,input); export const completeReturnResolutionSnapshot=(id:string,input:Parameters<typeof completeReturnResolution>[2])=>completeReturnResolution(returnRepository,id,input); export const failReturnIntentSnapshot=(id:string,input:Parameters<typeof failReturnIntent>[2])=>failReturnIntent(returnRepository,id,input); export const closeReturnRequest=(id:string,input:Parameters<typeof closeReturn>[2])=>closeReturn(returnRepository,id,input);
export const requestCreditNoteResolutionSnapshot=(id:string,input:Parameters<typeof requestCreditNoteResolution>[2])=>requestCreditNoteResolution(returnRepository,id,input);
export const queryReturnSnapshot=(input?:Parameters<typeof queryReturns>[1])=>queryReturns(returnRepository,input); export const getReturnStatsSnapshot=()=>getReturnStats(returnRepository);
