import { normalizeApplicationError } from "@/shared/domain";
import { formatApplicationError, type ErrorPresentationOptions } from "./errorPresentation";

/**
 * Architecture codes raised when connected mode refuses a business mutation because
 * the backend contract for it is not production-ready.
 *
 * These are fail-closed guards, not transient infrastructure faults: retrying cannot
 * succeed until the backend contract ships. Their raw messages name internal
 * registries, decision ids and command classifications, so presentation must never
 * show them to an end user.
 */
const BACKEND_UNAVAILABLE_CODES: ReadonlySet<string> = new Set([
  "CONNECTED_LOCAL_WRITE_FORBIDDEN",
  "CONNECTED_OPERATION_REQUIRES_BACKEND",
  "CONNECTED_COMMAND_CONTRACT_BLOCKED",
  "CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY",
]);

export function isBackendUnavailableError(error: unknown): boolean {
  const code = normalizeApplicationError(error).code;
  return BACKEND_UNAVAILABLE_CODES.has(code);
}

export interface OperationUnavailableOptions extends ErrorPresentationOptions {
  /** Human-readable action name, already localized by the caller. */
  action?: string;
}

/**
 * Formats a failed business mutation for an end user.
 *
 * A backend-unavailable refusal becomes a plain "not available yet" sentence that
 * names the action and never leaks an error code, decision id or registry path.
 * Every other failure keeps the standard product error presentation.
 */
export function formatOperationUnavailableError(
  error: unknown,
  options: OperationUnavailableOptions = {},
): string {
  if (!isBackendUnavailableError(error)) return formatApplicationError(error, options);
  return backendUnavailableMessage(options);
}

/**
 * Localized "this action needs backend support that has not shipped" copy.
 *
 * Use when the block is known before invocation, so no error object is constructed
 * and no internal message string exists to leak.
 */
export function backendUnavailableMessage(options: OperationUnavailableOptions = {}): string {
  const vietnamese = options.locale?.toLowerCase().startsWith("vi") ?? false;
  const action = options.action?.trim();
  if (vietnamese) {
    return action
      ? `${action} chưa khả dụng: hệ thống máy chủ chưa hỗ trợ thao tác này. Dữ liệu của bạn chưa được thay đổi.`
      : "Thao tác này chưa khả dụng: hệ thống máy chủ chưa hỗ trợ. Dữ liệu của bạn chưa được thay đổi.";
  }
  return action
    ? `${action} is not available yet: server support for this action has not been released. Nothing was changed.`
    : "This action is not available yet: server support has not been released. Nothing was changed.";
}
