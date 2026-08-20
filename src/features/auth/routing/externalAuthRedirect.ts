import type { ExternalAuthProvider } from "../components/AuthProviderButtons";

interface ExternalAuthStartResult {
  ok: boolean;
}

const providerEnvironmentKeys: Record<ExternalAuthProvider, string> = {
  google: "VITE_AUTH_GOOGLE_URL",
  microsoft: "VITE_AUTH_MICROSOFT_URL",
};

export function startExternalAuth(provider: ExternalAuthProvider, redirect?: string | null): ExternalAuthStartResult {
  if (typeof window === "undefined") return { ok: false };

  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  const configuredUrl = env?.[providerEnvironmentKeys[provider]];
  if (typeof configuredUrl !== "string" || !configuredUrl.trim()) return { ok: false };

  const destination = new URL(configuredUrl, window.location.origin);
  if (redirect) destination.searchParams.set("redirect", redirect);
  window.location.assign(destination.toString());
  return { ok: true };
}
