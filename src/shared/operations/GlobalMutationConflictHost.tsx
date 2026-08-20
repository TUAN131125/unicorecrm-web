import React from "react";
import {
  clearGlobalMutationConflict,
  getGlobalMutationConflictSnapshot,
  subscribeGlobalMutationConflict,
} from "@/shared/application";
import { MutationConflictDialog } from "./MutationConflictDialog";
import { classifyMutationFailure } from "./mutationState";

export function GlobalMutationConflictHost() {
  const conflict = React.useSyncExternalStore(
    subscribeGlobalMutationConflict,
    getGlobalMutationConflictSnapshot,
    getGlobalMutationConflictSnapshot,
  );
  const failure = React.useMemo(
    () => conflict ? classifyMutationFailure(conflict.error) : undefined,
    [conflict],
  );

  return (
    <MutationConflictDialog
      isOpen={Boolean(conflict)}
      failure={failure}
      onClose={clearGlobalMutationConflict}
      onReloadLatest={() => window.location.reload()}
    />
  );
}
