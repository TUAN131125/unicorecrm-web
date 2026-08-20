import { useSubscribableSnapshot } from "@/platform/react";
import { getAuthSessionSnapshot, subscribeToAuthSession } from "../runtime/authRuntime";

export function useAuthSessionSnapshot() {
  return useSubscribableSnapshot(getAuthSessionSnapshot, subscribeToAuthSession);
}
