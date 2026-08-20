import { createApplicationServiceBinding } from "../applicationServiceBinding";
import type {
  BackendMutationCommand,
  LocalMutationExecutor,
  MutationAuthorityPort,
  MutationCommandMetadata,
  MutationOutcome,
} from "./mutationAuthority";
import { publishGlobalMutationConflict } from "./globalMutationConflict";

const binding = createApplicationServiceBinding<MutationAuthorityPort>("Mutation authority");

export const configureMutationAuthority = binding.configure;
export const getMutationAuthority = binding.get;
export const resetMutationAuthority = binding.reset;

const GLOBAL_CONFLICT_AGGREGATE_TYPES = new Set(["lead", "deal", "quote", "order"]);

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
