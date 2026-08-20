import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";

export const organizationPresentationPreferences = new PreferenceStore(new BrowserStorageAdapter(), "");
