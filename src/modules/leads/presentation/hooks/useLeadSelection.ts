import { useState, useCallback, useLayoutEffect, type SetStateAction } from "react";

export const useLeadSelection = (scopeKey = "local") => {
  const [state, setState] = useState({ scopeKey, ids: [] as string[] });
  const selectedLeadIds = state.scopeKey === scopeKey ? state.ids : [];
  useLayoutEffect(() => {
    if (state.scopeKey !== scopeKey) setState({ scopeKey, ids: [] });
  }, [scopeKey, state.scopeKey]);
  const setSelectedLeadIds = useCallback((update: SetStateAction<string[]>) => {
    setState(current => ({ scopeKey, ids: typeof update === "function"
      ? update(current.scopeKey === scopeKey ? current.ids : []) : update }));
  }, [scopeKey]);

  const toggleSelection = useCallback((id: string, checked: boolean) => {
    setSelectedLeadIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      } else {
        return prev.filter((item) => item !== id);
      }
    });
  }, [setSelectedLeadIds]);

  const selectAll = useCallback((ids: string[], checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(ids);
    } else {
      setSelectedLeadIds([]);
    }
  }, [setSelectedLeadIds]);

  const clearSelection = useCallback(() => {
    setSelectedLeadIds([]);
  }, [setSelectedLeadIds]);

  const isSelected = useCallback(
    (id: string) => {
      return selectedLeadIds.includes(id);
    },
    [selectedLeadIds]
  );

  return {
    selectedLeadIds,
    setSelectedLeadIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
  };
};
