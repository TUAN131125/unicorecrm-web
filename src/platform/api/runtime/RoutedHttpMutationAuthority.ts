import type {
  BackendMutationCommand,
  ModuleDataAuthorityKey,
  ModuleDataAuthorityRegistry,
  MutationAuthorityPort,
  MutationCommandMetadata,
  MutationOutcome,
  MutationResourceVersion,
} from "@/shared/application";
import { invalidateModuleQueries, MutationCommandError } from "@/shared/application";
import {
  PRODUCTION_COMMAND_CONTRACTS,
  type ProductionCommandContract,
  type ProductionCommandType,
} from "../contracts/generatedProductionCommandRegistry";
import type { HttpClient, HttpMethod } from "../client/HttpClient";
import { projectProductionCommandPayload } from "../contracts/productionCommandPayloadProjection";

export interface RoutedHttpMutationAuthorityOptions {
  onCommitted?(event: ConnectedMutationCommittedEvent): void | Promise<void>;
}

export interface ConnectedMutationCommittedEvent {
  commandType: string;
  aggregateType: string;
  aggregateId: string;
  moduleKeys: readonly ModuleDataAuthorityKey[];
  outcome: MutationOutcome<unknown>;
}

interface AuthoritativeMutationResponse<TResult> {
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: MutationResourceVersion;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED";
  warnings?: string[];
  emittedEventIds?: string[];
  auditEvidenceIds?: string[];
  result: TResult;
}

const MODULE_KEYS = new Set<ModuleDataAuthorityKey>([
  "commercialEvidence",
  "contacts",
  "customers",
  "deals",
  "invoices",
  "leads",
  "orders",
  "organizations",
  "payments",
  "products",
  "quotes",
  "returns",
  "shipping",
  "support",
  "tasks",
]);

/**
 * Connected mutation authority backed exclusively by the OpenAPI command registry.
 *
 * The registry argument is retained only to preserve the composition boundary. It is
 * never used to infer a URL or to fall back to a generic module command adapter.
 */
export class RoutedHttpMutationAuthority implements MutationAuthorityPort {
  private readonly onCommitted: RoutedHttpMutationAuthorityOptions["onCommitted"];

  constructor(
    private readonly client: HttpClient,
    _registry: ModuleDataAuthorityRegistry,
    options: RoutedHttpMutationAuthorityOptions = {},
  ) {
    this.onCommitted = options.onCommitted;
  }

  /**
   * Only a command the generated production registry carries can be routed. Commands
   * owned by a dedicated module or workflow adapter, and BLOCKED commands, are
   * deliberately absent, so a module boundary can refuse them before dispatch instead
   * of reaching `execute` and failing inside the routing layer.
   */
  supports(commandType: string): boolean {
    return isProductionCommandType(commandType);
  }

  async execute<TPayload, TResult>(
    command: BackendMutationCommand<TPayload>,
    metadata: MutationCommandMetadata,
  ): Promise<MutationOutcome<TResult>> {
    const contract = resolveCommandRoute(command.commandType);
    assertRequiredTransportMetadata(contract, command, metadata);

    const path = resolveOpenApiPath(contract, command.aggregateId);
    const requestBody = projectProductionCommandPayload(contract, command.payload);
    const response = await this.client.request<AuthoritativeMutationResponse<TResult>, Record<string, unknown>>({
      operationId: contract.operationId,
      method: contract.method as HttpMethod,
      path,
      body: requestBody,
      retry: contract.idempotencyPolicy === "REQUIRED" ? "idempotent" : "never",
      idempotencyKey: metadata.idempotencyKey,
      ...(metadata.expectedVersion === undefined ? {} : { expectedVersion: metadata.expectedVersion }),
      ...(metadata.correlationId === undefined ? {} : { correlationId: metadata.correlationId }),
      ...(metadata.signal === undefined ? {} : { signal: metadata.signal }),
      auth: "required",
      workspace: "required",
    });

    const outcome = toMutationOutcome(command, metadata, response, contract);
    const moduleKeys = toModuleKeys(contract.affectedModuleKeys, contract.operationId);
    await this.commit(command, outcome, moduleKeys);
    return outcome;
  }

  private async commit<TPayload, TResult>(
    command: BackendMutationCommand<TPayload>,
    outcome: MutationOutcome<TResult>,
    moduleKeys: readonly ModuleDataAuthorityKey[],
  ): Promise<void> {
    const event = {
      commandType: command.commandType,
      aggregateType: command.aggregateType,
      aggregateId: outcome.aggregateId,
      moduleKeys,
      outcome: outcome as MutationOutcome<unknown>,
    } satisfies ConnectedMutationCommittedEvent;
    await invalidateModuleQueries({
      moduleKeys,
      commandType: command.commandType,
      aggregateId: outcome.aggregateId,
      occurredAt: outcome.occurredAt,
    });
    await this.onCommitted?.(event);
  }
}

export function resolveCommandRoute(commandType: string): ProductionCommandContract {
  const contract = (PRODUCTION_COMMAND_CONTRACTS as Readonly<Record<string, ProductionCommandContract>>)[commandType];
  if (!contract) throw blockedCommand(commandType);
  return contract;
}

export function isProductionCommandType(commandType: string): commandType is ProductionCommandType {
  return Object.prototype.hasOwnProperty.call(PRODUCTION_COMMAND_CONTRACTS, commandType);
}

function assertRequiredTransportMetadata<TPayload>(
  contract: ProductionCommandContract,
  command: BackendMutationCommand<TPayload>,
  metadata: MutationCommandMetadata,
): void {
  if (!command.aggregateId.trim()) {
    throw contractViolation(contract.operationId, "aggregateId", "A production command requires a non-empty aggregate identifier.");
  }
  if (contract.idempotencyPolicy === "REQUIRED" && !metadata.idempotencyKey.trim()) {
    throw contractViolation(contract.operationId, "idempotencyKey", "The OpenAPI operation requires Idempotency-Key.");
  }
  if (contract.concurrencyPolicy === "IF_MATCH_REQUIRED" && metadata.expectedVersion === undefined) {
    throw contractViolation(contract.operationId, "expectedVersion", "The OpenAPI operation requires an optimistic concurrency version.");
  }
}

function resolveOpenApiPath(contract: ProductionCommandContract, aggregateId: string): string {
  if (!contract.pathParameter) return contract.pathTemplate;
  const marker = `{${contract.pathParameter}}`;
  if (!contract.pathTemplate.includes(marker)) {
    throw contractViolation(contract.operationId, "pathTemplate", `OpenAPI path is missing ${marker}.`);
  }
  return contract.pathTemplate.replace(marker, encodeURIComponent(aggregateId.trim()));
}

function toMutationOutcome<TPayload, TResult>(
  command: BackendMutationCommand<TPayload>,
  metadata: MutationCommandMetadata,
  response: AuthoritativeMutationResponse<TResult>,
  contract: ProductionCommandContract,
): MutationOutcome<TResult> {
  assertAuthoritativeMutationResponse(response, command, contract);
  return {
    data: response.result,
    commandId: response.commandId,
    commandType: command.commandType,
    aggregateType: response.aggregateType,
    aggregateId: response.aggregateId,
    idempotencyKey: metadata.idempotencyKey,
    correlationId: response.correlationId,
    occurredAt: response.occurredAt,
    version: response.version,
    outcome: response.outcome,
    ...(response.warnings === undefined ? {} : { warnings: response.warnings }),
    emittedEvents: response.emittedEventIds ?? [],
    audit: { authority: "backend", evidenceIds: response.auditEvidenceIds ?? [] },
  };
}

function assertAuthoritativeMutationResponse<TPayload, TResult>(
  response: AuthoritativeMutationResponse<TResult>,
  command: BackendMutationCommand<TPayload>,
  contract: ProductionCommandContract,
): void {
  if (!isRecord(response)) throw contractViolation(contract.operationId, "response", "Mutation response must be an object.");
  for (const field of ["commandId", "correlationId", "aggregateId", "aggregateType", "occurredAt"] as const) {
    if (typeof response[field] !== "string" || response[field].trim().length === 0) {
      throw contractViolation(contract.operationId, field, `Mutation response is missing authoritative ${field}.`);
    }
  }
  if (!("version" in response) || (typeof response.version !== "string" && typeof response.version !== "number")) {
    throw contractViolation(contract.operationId, "version", "Mutation response is missing authoritative aggregate version.");
  }
  if (response.outcome !== "COMMITTED" && response.outcome !== "REPLAYED") {
    throw contractViolation(contract.operationId, "outcome", "Mutation response outcome must be COMMITTED or REPLAYED.");
  }
  if (!("result" in response) || response.result === undefined) {
    throw contractViolation(contract.operationId, "result", "Mutation response is missing its typed domain result.");
  }
  if (contract.aggregateIdPolicy === "MUST_MATCH_TARGET" && response.aggregateId !== command.aggregateId) {
    throw contractViolation(contract.operationId, "aggregateId", "Mutation response aggregateId does not match the command target.");
  }
  if (contract.aggregateIdPolicy === "SERVER_ASSIGNED" && response.aggregateId === command.aggregateId) {
    throw contractViolation(contract.operationId, "aggregateId", "Server-assigned aggregateId must not reuse the client-local creation intent identifier.");
  }
  if (response.aggregateType.trim().toLowerCase() !== command.aggregateType.trim().toLowerCase()) {
    throw contractViolation(contract.operationId, "aggregateType", "Mutation response aggregateType does not match the command target.");
  }
  if (!isUtcDateTime(response.occurredAt)) {
    throw contractViolation(contract.operationId, "occurredAt", "Mutation response occurredAt must be a valid UTC date-time.");
  }
  for (const [field, value] of [["warnings", response.warnings], ["emittedEventIds", response.emittedEventIds], ["auditEvidenceIds", response.auditEvidenceIds]] as const) {
    if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) {
      throw contractViolation(contract.operationId, field, `Mutation response ${field} must contain strings only.`);
    }
  }
}

function toModuleKeys(values: readonly string[], operationId: string): readonly ModuleDataAuthorityKey[] {
  return values.map((value) => {
    if (!MODULE_KEYS.has(value as ModuleDataAuthorityKey)) {
      throw contractViolation(operationId, "affectedModuleKeys", `Unknown module authority key: ${value}.`);
    }
    return value as ModuleDataAuthorityKey;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isUtcDateTime(value: string): boolean {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}

function blockedCommand(commandType: string): MutationCommandError {
  return new MutationCommandError({
    code: "CONNECTED_COMMAND_CONTRACT_BLOCKED",
    message: `Connected command ${commandType} is not classified PRODUCTION_CONTRACT_READY in the canonical command registry.`,
    category: "INFRASTRUCTURE",
    retryable: false,
    details: { commandType, authority: "docs/backend-readiness/command-registry.json" },
  });
}

function contractViolation(operationId: string, field: string, message: string): MutationCommandError {
  return new MutationCommandError({
    code: "CONNECTED_CONTRACT_VIOLATION",
    message,
    category: "INFRASTRUCTURE",
    retryable: false,
    details: { operationId, field, authority: "docs/api/openapi.json" },
  });
}
