import { useSubscribableSnapshot } from "@/platform/react";
import { getQuickSetupState, subscribeToQuickSetup } from "../../public/quickSetup";

export function useQuickSetupState() {
  return useSubscribableSnapshot(getQuickSetupState, subscribeToQuickSetup);
}
