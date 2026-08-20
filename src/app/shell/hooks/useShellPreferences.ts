import { useState } from "react";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";

const preferences = new PreferenceStore(new BrowserStorageAdapter(), "");
const SIDEBAR_COLLAPSED_KEY = "centrix_sidebar_collapsed";

export const useShellPreferences = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState<boolean>(() =>
    preferences.get(SIDEBAR_COLLAPSED_KEY, false),
  );

  const setIsSidebarCollapsed = (value: boolean) => {
    preferences.set(SIDEBAR_COLLAPSED_KEY, value);
    setIsSidebarCollapsedState(value);
  };

  return { isSidebarCollapsed, setIsSidebarCollapsed };
};
