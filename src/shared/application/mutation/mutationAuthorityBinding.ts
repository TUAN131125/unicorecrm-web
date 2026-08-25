import { createApplicationServiceBinding } from "../applicationServiceBinding";
import type {
  BackendMutationCommand,
  LocalMutationExecutor,
  MutationAuthorityPort,
  MutationCommandMetadata,
  MutationOutcome,
} from "./mutationAuthority";
import { publishGlobalMutationConflict } from "./globalMutationConflict";
import { MutationCommandError } from "./mutationAuthority";

const binding = createApplicationServiceBinding<MutationAuthorityPort>("Mutation authority");

export const configureMutationAuthority = binding.configure;
export const getMutationAuthority = binding.get;
export const resetMutationAuthority = binding.reset;

const GLOBAL_CONFLICT_AGGREGATE_TYPES = new Set(["lead", "deal", "quote", "order"]);

/**
 * Whether the active mutation authority can carry this canonical command.
 *
 * The connected authority answers from the generated production command registry, which
 * `scripts/api/openapi/render.mjs` builds from `docs/backend-readiness/command-registry.json`:
 * a BLOCKED command, and a READY command owned by a dedicated module or workflow adapter,
 * is deliberately absent from it. Asking here lets a module boundary refuse before the
 * command is dispatched, instead of discovering it inside the routed authority.
 *
 * Demo authorities declare no support table and execute every command locally, so this
 * returns `true` for them and demo behaviour is unchanged.
 */
export function isMutationCommandSupported(commandType: string): boolean {
  let authority: MutationAuthorityPort;
  try {
    authority = binding.get();
  } catch {
    // No authority is configured yet (module import time, tests before composition).
    // Availability is unknown, so nothing is refused on that basis.
    return true;
  }
  return authority.supports?.(commandType) ?? true;
}

/** True when the active authority cannot carry this command at all. */
export function isMutationCommandUnavailable(commandType: string): boolean {
  return !isMutationCommandSupported(commandType);
}

/**
 * Fail-closed guard for a command boundary whose canonical contract is not routable in
 * the active runtime. Refuses before `executeMutationCommand`, so a command that the
 * canonical registry does not carry never reaches the mutation authority, is never
 * partially applied and never falls back to a local write in connected mode.
 */
export function assertMutationCommandSupported(commandType: string, operation: string): void {
  if (isMutationCommandSupported(commandType)) return;
  throw new MutationCommandError({
    code: "CONNECTED_COMMAND_CONTRACT_BLOCKED",
    message: `${operation} cannot run in connected mode: ${commandType} is not a routable production command contract.`,
    category: "INFRASTRUCTURE",
    retryable: false,
    details: { commandType, operation, authority: "docs/backend-readiness/command-registry.json" },
  });
}

export async function executeMutationCommand<TPayload, TResult>(
  command: BackendMutationCommand<TPayload>,
  metadata: MutationCommandMetadata,
  localExecutor?: LocalMutationExecutor<TResult>,
): Promise<MutationOutcome<TResult>> {
  try {
    return await binding.get().execute(command, metadata, localExecutor);
  } catch (error) {
    if (GLOBAL_CONFLICT_AGGREGATE_TYPES.has(command.aggregateType)) publishGlobalMutationConflict(command, error);
    throw error;
  }
}
