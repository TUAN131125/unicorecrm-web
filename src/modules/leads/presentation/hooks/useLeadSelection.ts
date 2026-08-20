import { useState, useCallback } from "react";

export const useLeadSelection = () => {
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const toggleSelection = useCallback((id: string, checked: boolean) => {
    setSelectedLeadIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      } else {
        return prev.filter((item) => item !== id);
      }
    });
  }, []);

  const selectAll = useCallback((ids: string[], checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(ids);
    } else {
      setSelectedLeadIds([]);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLeadIds([]);
  }, []);

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
