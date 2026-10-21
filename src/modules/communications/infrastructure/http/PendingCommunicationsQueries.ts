import { ApplicationError } from "@/shared/domain";
import type { CommunicationsQueries } from "../../application/CommunicationsQueries";

function unavailable(): never {
  throw new ApplicationError({
    code: "COMMUNICATIONS_UNAVAILABLE",
    category: "AUTHORIZATION",
    message: "Communications connected runtime is unavailable.",
    retryable: false,
  });
}

// Deliberately performs no HTTP request and has no demo fallback.
export const pendingCommunicationsQueries: CommunicationsQueries = {
  list: async () => unavailable(),
  get: async () => unavailable(),
  messages: async () => unavailable(),
};
