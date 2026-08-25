import { ApplicationError, type ApplicationErrorCategory } from "@/shared/domain";

export type MutationResourceVersion = number | string;

export interface MutationActor {
  id?: string;
  name?: string;
}

export interface MutationCommandMetadata {
  idempotencyKey: string;
  expectedVersion?: MutationResourceVersion;
  correlationId?: string;
  actor?: MutationActor;
  requestedAt?: string;
  signal?: AbortSignal;
}

export interface BackendMutationCommand<TPayload = unknown> {
  commandType: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
}

export interface MutationAuditEvidence {
  authority: "backend" | "demo";
  evidenceIds: string[];
}

export interface MutationOutcome<TResult> {
  data: TResult;
  commandId: string;
  commandType: string;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  correlationId: string;
  occurredAt: string;
  version?: MutationResourceVersion;
  outcome?: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED";
  warnings?: string[];
  emittedEvents: string[];
  audit: MutationAuditEvidence;
}

export interface MutationCommandErrorOptions {
  code: string;
  message: string;
  category?: ApplicationErrorCategory;
  blockers?: string[];
  fieldErrors?: Record<string, string[]>;
  correlationId?: string;
  retryable?: boolean;
  userMessage?: string;
  details?: unknown;
  cause?: unknown;
}

/**
 * A failed authoritative mutation.
 *
 * `message` is the internal diagnostic: it names command types, workflow ids, operation
 * ids and version requirements, which is exactly what logs and tests need. It is
 * deliberately NOT promoted to `userMessage` — an architecture refusal would otherwise be
 * rendered verbatim by the central formatter. A throw site that genuinely has product-safe
 * copy passes `userMessage` explicitly; everything else is mapped from its stable code by
 * `presentApplicationError`.
 */
export class MutationCommandError extends ApplicationError {
  constructor(options: MutationCommandErrorOptions) {
    super({
      code: options.code,
      message: options.message,
      ...(options.category === undefined ? {} : { category: options.category }),
      ...(options.blockers === undefined ? {} : { blockers: options.blockers }),
      ...(options.fieldErrors === undefined ? {} : { fieldErrors: options.fieldErrors }),
      ...(options.correlationId === undefined ? {} : { correlationId: options.correlationId }),
      ...(options.retryable === undefined ? {} : { retryable: options.retryable }),
      ...(options.userMessage === undefined ? {} : { userMessage: options.userMessage }),
      ...(options.details === undefined ? {} : { details: options.details }),
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    });
    this.name = "MutationCommandError";
  }
}

export type LocalMutationExecutor<TResult> = () => TResult | Promise<TResult>;

export interface MutationAuthorityPort {
  execute<TPayload, TResult>(
    command: BackendMutationCommand<TPayload>,
    metadata: MutationCommandMetadata,
    localExecutor?: LocalMutationExecutor<TResult>,
  ): Promise<MutationOutcome<TResult>>;
  /**
   * Whether this authority can carry the canonical command at all. A connected
   * authority answers from the generated production command registry, so a command the
   * canonical registry does not classify as a routable production contract can be
   * refused at the module boundary instead of failing inside transport. An authority
   * that omits this (the demo authority) executes every command locally.
   */
  supports?(commandType: string): boolean;
}

export function createMutationMetadata(
  prefix: string,
  input: Omit<MutationCommandMetadata, "idempotencyKey" | "correlationId"> & {
    idempotencyKey?: string;
    correlationId?: string;
  } = {},
): MutationCommandMetadata {
  const random = crypto.randomUUID();
  return {
    ...input,
    idempotencyKey: input.idempotencyKey ?? `${prefix}:${random}`,
    correlationId: input.correlationId ?? `corr_${random}`,
    requestedAt: input.requestedAt ?? new Date().toISOString(),
  };
}

export function readMutationVersion(value: unknown): MutationResourceVersion | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { version?: unknown; updatedAt?: unknown };
  if (typeof candidate.version === "number" || typeof candidate.version === "string") return candidate.version;
  if (typeof candidate.updatedAt === "string") return candidate.updatedAt;
  return undefined;
}
