/**
 * Availability of browser-persisted platform configuration in the active runtime.
 *
 * Integration connections, developer webhooks and CRM object schemas are persisted by
 * `BrowserStorageAdapter` repositories that have no runtime-mode awareness at all: they
 * write to workspace-scoped browser storage identically in demo and connected mode.
 *
 * That is legitimate demo behaviour and an MA-01 violation in connected mode. OpenAPI
 * publishes `listIntegrationConnections` and `listCrmObjectSchemas` as
 * PRODUCTION_CONTRACT_READY reads while every corresponding write —
 * `createIntegrationConnection`, `updateIntegrationConnection`,
 * `disconnectIntegrationConnection`, `verifyIntegrationConnection`,
 * `createCrmObjectField`, `updateCrmObjectField`, `deleteCrmObjectField` — is BLOCKED. A
 * backend read paired with a browser write presented as workspace configuration is exactly
 * the shape MA-01 forbids. Developer webhooks have no backend contract in either direction,
 * so connected mode has no authority to write them either.
 *
 * These repositories are platform singletons rather than module application services, so
 * there is no port for the connected composition to bind. The composition declares the
 * operations here instead, the same way it declares a workflow that owns no ports, and the
 * runtime and its Studio view read the predicates below. A demo composition declares
 * nothing, so demo behaviour is unchanged.
 */
import { isBusinessOperationUnavailable } from "@/shared/application";

export const INTEGRATION_CONNECTION_SAVE_OPERATION = "Integration connection save";
export const INTEGRATION_CONNECTION_DISCONNECT_OPERATION = "Integration connection disconnect";
export const INTEGRATION_CONNECTION_VERIFY_OPERATION = "Integration connection verify";
export const DEVELOPER_WEBHOOK_SAVE_OPERATION = "Developer webhook configuration save";
export const CRM_OBJECT_SCHEMA_SAVE_OPERATION = "CRM object schema save";

/** Every platform configuration write the connected runtime cannot perform authoritatively. */
export const CONNECTED_UNAVAILABLE_CONFIGURATION_OPERATIONS = [
  INTEGRATION_CONNECTION_SAVE_OPERATION,
  INTEGRATION_CONNECTION_DISCONNECT_OPERATION,
  INTEGRATION_CONNECTION_VERIFY_OPERATION,
  DEVELOPER_WEBHOOK_SAVE_OPERATION,
  CRM_OBJECT_SCHEMA_SAVE_OPERATION,
] as const;

/**
 * Raised when a browser-persisted configuration write is attempted in connected mode.
 *
 * The code is the shared `CONNECTED_OPERATION_REQUIRES_BACKEND`, so `presentApplicationError`
 * already maps it to safe unavailable copy and the diagnostic stays for logs and tests.
 */
export class ConnectedConfigurationUnavailableError extends Error {
  readonly code = "CONNECTED_OPERATION_REQUIRES_BACKEND";

  constructor(operation: string) {
    super(`${operation} is unavailable as a local operation in connected mode. Use the backend configuration API.`);
    this.name = "ConnectedConfigurationUnavailableError";
  }
}

/** True when the active runtime cannot perform this configuration write authoritatively. */
export function isConfigurationOperationUnavailable(operation: string): boolean {
  return isBusinessOperationUnavailable(operation);
}

/** Fails closed for a configuration write the active runtime does not own. */
export function assertConfigurationOperationAvailable(operation: string): void {
  if (isBusinessOperationUnavailable(operation)) throw new ConnectedConfigurationUnavailableError(operation);
}

/** True when integration connections cannot be written authoritatively. */
export function isIntegrationConfigurationWriteUnavailable(): boolean {
  return isConfigurationOperationUnavailable(INTEGRATION_CONNECTION_SAVE_OPERATION)
    || isConfigurationOperationUnavailable(INTEGRATION_CONNECTION_DISCONNECT_OPERATION)
    || isConfigurationOperationUnavailable(INTEGRATION_CONNECTION_VERIFY_OPERATION);
}

/** True when developer webhook configuration cannot be written authoritatively. */
export function isDeveloperWebhookSaveUnavailable(): boolean {
  return isConfigurationOperationUnavailable(DEVELOPER_WEBHOOK_SAVE_OPERATION);
}

/** True when CRM object schemas cannot be written authoritatively. */
export function isCrmObjectSchemaSaveUnavailable(): boolean {
  return isConfigurationOperationUnavailable(CRM_OBJECT_SCHEMA_SAVE_OPERATION);
}
