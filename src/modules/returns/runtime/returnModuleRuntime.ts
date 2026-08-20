import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { InMemoryReturnRepository } from "../infrastructure/InMemoryReturnRepository";
import { RETURN_SEED } from "../infrastructure/return.seed";

export const returnRepository = createWorkspaceScopedRepository({
  resourceKey: "returns",
  createRepository: () => new InMemoryReturnRepository(structuredClone(RETURN_SEED)),
});
