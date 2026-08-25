import { normalizeApplicationError } from "@/shared/domain";
import { BACKEND_UNAVAILABLE_CODES, formatApplicationError, unavailableMessages, UNSAFE_FOR_DISPLAY_CODES, type ErrorPresentationOptions } from "./errorPresentation";

export { UNSAFE_FOR_DISPLAY_CODES, isUnsafeForDisplay } from "./errorPresentation";


export function isBackendUnavailableError(error: unknown): boolean {
  const code = normalizeApplicationError(error).code;
  return BACKEND_UNAVAILABLE_CODES.has(code);
}

/** Architecture refusals that are declared centrally; re-exported for callers. */
export function isArchitectureRefusal(error: unknown): boolean {
  return UNSAFE_FOR_DISPLAY_CODES.has(normalizeApplicationError(error).code);
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
      : unavailableMessages.vi;
  }
  return action
    ? `${action} is not available yet: server support for this action has not been released. Nothing was changed.`
    : unavailableMessages.en;
}

/**
 * Product-facing "this feature is not available yet" copy, naming what could not be saved.
 *
 * Deliberately worded in feature terms rather than infrastructure terms: a configuration
 * screen that cannot save yet is a missing feature to the person using it, not a routing
 * or adapter fact. `backendUnavailableMessage` stays for mutation surfaces that already
 * use its wording; this is the shared copy for known-unavailable configuration actions,
 * so the same sentence is not re-typed on every screen.
 */
export function unavailableFeatureMessage(
  what: { readonly vi: string; readonly en: string },
  options: ErrorPresentationOptions = {},
): string {
  const vietnamese = options.locale?.toLowerCase().startsWith("vi") ?? false;
  return vietnamese
    ? `${what.vi}: tính năng này chưa khả dụng. Dữ liệu của bạn chưa được thay đổi.`
    : `${what.en}: this is not available yet. Nothing was changed.`;
}
