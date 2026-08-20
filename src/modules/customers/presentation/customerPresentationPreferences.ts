import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";

/**
 * Temporary presentation-only preferences for the Customer View visual adapter.
 * This boundary deliberately owns no Customer business repository or write path.
 */
export const customerPresentationPreferences = new PreferenceStore(new BrowserStorageAdapter(), "");
