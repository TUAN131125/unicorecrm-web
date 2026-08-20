import React from "react";

export function useUnsavedChangesGuard(onDiscard: () => void) {
  const [isDirty, setIsDirty] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

  const requestClose = React.useCallback(() => {
    if (isDirty) {
      setIsConfirmOpen(true);
      return;
    }
    onDiscard();
  }, [isDirty, onDiscard]);

  const confirmDiscard = React.useCallback(() => {
    setIsConfirmOpen(false);
    setIsDirty(false);
    onDiscard();
  }, [onDiscard]);

  return {
    isDirty,
    setIsDirty,
    isConfirmOpen,
    setIsConfirmOpen,
    requestClose,
    confirmDiscard,
  };
}
