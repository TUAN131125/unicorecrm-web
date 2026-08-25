import {
  initializeApplicationComposition,
  type ApplicationRuntimeMode,
  type InitializeApplicationCompositionOptions,
} from "@/app/composition";
import { EmailVerificationApiClient, FetchHttpClient, type AccessTokenProvider } from "@/platform/api";
import { IdentityApiClient } from "@/platform/api/generated/identityApi";
import { WorkspaceBootstrapApiClient } from "@/platform/api/generated/workspaceBootstrapApi";
import { IdentityAuthHttpAdapter } from "@/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter";
import {
  bootstrapAuthSession,
  configureConnectedAuthGateway,
  getConnectedAuthAccessToken,
  refreshAuthSession,
  terminateAuthSession,
} from "@/platform/identity-auth";
import {
  configureConnectedWorkspaceBootstrapGateway,
  getActiveWorkspaceId,
  isConnectedWorkspaceRuntime,
  resetWorkspaceContextSelection,
} from "@/platform/workspace-context";
import { WorkspaceBootstrapHttpAdapter } from "@/platform/workspace-context/infrastructure/WorkspaceBootstrapHttpAdapter";
import { clearAccessGovernance } from "@/platform/access-control/governance";

export interface ApplicationRuntimeEnvironment {
  DEV?: boolean;
  PROD?: boolean;
  MODE?: string;
  VITE_RUNTIME_MODE?: string;
  VITE_ALLOW_PRODUCTION_DEMO?: string;
  VITE_API_BASE_URL?: string;
  VITE_API_TIMEOUT_MS?: string;
  VITE_AUTH_ADAPTER?: string;
}

export interface ConnectedRuntimeTelemetryEvent {
  name: string;
  attributes?: Readonly<Record<string, string | number | boolean | undefined>>;
}

/** Optional host overrides. The built-in Identity runtime is the default authority. */
export interface ConnectedRuntimeBindings {
  getAccessToken?(): string | undefined | Promise<string | undefined>;
  getWorkspaceId?(): string | undefined;
  refreshSession?(): boolean | Promise<boolean>;
  onUnauthorized?(): void | Promise<void>;
  logout?(): void | Promise<void>;
  telemetry?(event: ConnectedRuntimeTelemetryEvent): void | Promise<void>;
}

export interface ApplicationBootstrapPlan {
  mode: ApplicationRuntimeMode;
  composition: InitializeApplicationCompositionOptions;
}

declare global {
  interface Window {
    __UNICORECRM_CONNECTED_RUNTIME__?: ConnectedRuntimeBindings;
  }
}

export function resolveApplicationBootstrapPlan(
  environment: ApplicationRuntimeEnvironment,
  bindings?: ConnectedRuntimeBindings,
): ApplicationBootstrapPlan {
  const mode = resolveRuntimeMode(environment);
  if (mode === "demo") {
    if (environment.PROD === true && environment.VITE_ALLOW_PRODUCTION_DEMO !== "true") {
      throw new Error("Production demo mode requires VITE_ALLOW_PRODUCTION_DEMO=true. Connected mode is the production default.");
    }
    return { mode, composition: { mode } };
  }

  const baseUrl = requireConnectedBaseUrl(environment);
  if (environment.PROD === true && environment.VITE_AUTH_ADAPTER === "development") {
    throw new Error("Connected production runtime cannot use the development authentication adapter.");
  }

  const accessTokenProvider: AccessTokenProvider = {
    getAccessToken: async () => (await bindings?.getAccessToken?.())?.trim() || getConnectedAuthAccessToken(),
  };
  const workspaceIdProvider = {
    getWorkspaceId: () => bindings?.getWorkspaceId?.()?.trim()
      || (isConnectedWorkspaceRuntime() ? getActiveWorkspaceId() : undefined),
  };
  const defaultTimeoutMs = parseTimeout(environment.VITE_API_TIMEOUT_MS);

  return {
    mode,
    composition: {
      mode,
      http: {
        baseUrl,
        accessTokenProvider,
        workspaceIdProvider,
        defaultTimeoutMs,
        onUnauthorized: createUnauthorizedHandler(bindings),
        telemetry: (event) => bindings?.telemetry?.({
          name: event.name,
          attributes: {
            moduleCount: event.moduleCount,
            workflowCount: event.workflowCount,
          },
        }),
      },
    },
  };
}

export async function bootstrapApplicationComposition(
  environment: ApplicationRuntimeEnvironment = readViteEnvironment(),
  bindings: ConnectedRuntimeBindings | undefined = readConnectedRuntimeBindings(),
): Promise<ApplicationRuntimeMode> {
  const mode = resolveRuntimeMode(environment);
  if (mode === "connected") {
    const baseUrl = requireConnectedBaseUrl(environment);
    // The authenticated Identity operations - GET /auth/session and
    // POST /auth/session/logout - are bearer authorized like any other endpoint. The
    // provider reads the runtime the gateway below installs, so it resolves lazily per
    // request rather than at construction time.
    const identityHttp = new FetchHttpClient({
      baseUrl,
      accessTokenProvider: { getAccessToken: () => getConnectedAuthAccessToken() },
      defaultTimeoutMs: parseTimeout(environment.VITE_API_TIMEOUT_MS),
    });
    // The email-verification OTP operations are not described by the pinned OpenAPI
    // document, so they arrive through the semantic extension over the same client.
    configureConnectedAuthGateway(new IdentityAuthHttpAdapter(new IdentityApiClient(identityHttp), new EmailVerificationApiClient(identityHttp)));
    await bootstrapAuthSession();
    const workspaceHttp = new FetchHttpClient({
      baseUrl,
      accessTokenProvider: { getAccessToken: () => getConnectedAuthAccessToken() },
      defaultTimeoutMs: parseTimeout(environment.VITE_API_TIMEOUT_MS),
      onUnauthorized: createUnauthorizedHandler(bindings),
    });
    configureConnectedWorkspaceBootstrapGateway(new WorkspaceBootstrapHttpAdapter(new WorkspaceBootstrapApiClient(workspaceHttp)));
  }

  const plan = resolveApplicationBootstrapPlan(environment, bindings);
  return initializeApplicationComposition(plan.composition);
}

function createUnauthorizedHandler(bindings?: ConnectedRuntimeBindings): () => Promise<boolean> {
  return async () => {
    const internalRefresh = await refreshAuthSession().catch(() => ({ ok: false as const }));
    if (internalRefresh.ok) return true;

    let hostRefreshed = false;
    try {
      hostRefreshed = (await bindings?.refreshSession?.()) === true;
    } catch {
      hostRefreshed = false;
    }
    if (hostRefreshed) return true;

    try {
      await bindings?.onUnauthorized?.();
    } finally {
      resetWorkspaceContextSelection();
      clearAccessGovernance();
      await terminateAuthSession("UNAUTHORIZED");
      await bindings?.logout?.();
    }
    return false;
  };
}

/**
 * The local ApiHost origin. Local development talks to the real backend without
 * requiring an environment file; every other environment must declare its own
 * VITE_API_BASE_URL.
 */
export const LOCAL_DEVELOPMENT_API_BASE_URL = "http://localhost:5080";

function requireConnectedBaseUrl(environment: ApplicationRuntimeEnvironment): string {
  const baseUrl = environment.VITE_API_BASE_URL?.trim();
  if (baseUrl) return baseUrl;
  if (environment.PROD === true) throw new Error("Connected runtime requires VITE_API_BASE_URL.");
  return LOCAL_DEVELOPMENT_API_BASE_URL;
}

function resolveRuntimeMode(environment: ApplicationRuntimeEnvironment): ApplicationRuntimeMode {
  const configured = environment.VITE_RUNTIME_MODE?.trim();
  if (configured && configured !== "demo" && configured !== "connected") {
    throw new Error(`Unsupported VITE_RUNTIME_MODE: ${configured}. Expected demo or connected.`);
  }
  if (configured) return configured as ApplicationRuntimeMode;
  // Connected is the default in every environment. Demo remains available, but only
  // when a deployment asks for it explicitly, so no runtime silently authenticates
  // or resolves workspaces against browser-local state.
  return "connected";
}

function parseTimeout(value: string | undefined): number | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const timeout = Number(normalized);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 120_000) {
    throw new Error("VITE_API_TIMEOUT_MS must be an integer from 1000 to 120000.");
  }
  return timeout;
}

function readViteEnvironment(): ApplicationRuntimeEnvironment {
  return ((import.meta as ImportMeta & { env?: ApplicationRuntimeEnvironment }).env ?? {});
}

function readConnectedRuntimeBindings(): ConnectedRuntimeBindings | undefined {
  return typeof window === "undefined" ? undefined : window.__UNICORECRM_CONNECTED_RUNTIME__;
}
