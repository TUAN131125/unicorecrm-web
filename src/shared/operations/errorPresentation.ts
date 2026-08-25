import {
  normalizeApplicationError,
  type ApplicationError,
  type ApplicationErrorCategory,
} from "@/shared/domain";

export type ErrorPresentationSurface = "FIELD" | "INLINE" | "TOAST" | "DIALOG" | "PAGE" | "SILENT";
export type ErrorRecoveryAction = "NONE" | "RETRY" | "REFRESH" | "SIGN_IN" | "GO_BACK" | "CONTACT_SUPPORT";

export interface ErrorPresentation {
  error: ApplicationError;
  message: string;
  surface: ErrorPresentationSurface;
  action: ErrorRecoveryAction;
  retryable: boolean;
  correlationId?: string;
}

export interface ErrorPresentationOptions {
  locale?: string;
  fallbackMessage?: string;
}

const englishMessages: Record<ApplicationErrorCategory, string> = {
  VALIDATION: "Review the highlighted information and try again.",
  AUTHENTICATION: "Your session is no longer valid. Sign in again to continue.",
  AUTHORIZATION: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested record could not be found or is no longer available.",
  CONFLICT: "This record changed elsewhere. Refresh the latest version before trying again.",
  BUSINESS_RULE: "This action is blocked by a business rule.",
  RATE_LIMIT: "Too many requests were sent. Try again shortly.",
  TIMEOUT: "The request took too long. Try again.",
  CANCELLED: "The operation was cancelled.",
  NETWORK: "The service could not be reached. Check your connection and try again.",
  INTEGRATION: "An external service could not complete the operation.",
  INFRASTRUCTURE: "The service is temporarily unavailable. Try again later.",
  UNKNOWN: "An unexpected error occurred. Your changes were not confirmed.",
};

const vietnameseMessages: Record<ApplicationErrorCategory, string> = {
  VALIDATION: "Hãy kiểm tra thông tin được đánh dấu và thử lại.",
  AUTHENTICATION: "Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại để tiếp tục.",
  AUTHORIZATION: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy bản ghi hoặc bản ghi không còn khả dụng.",
  CONFLICT: "Bản ghi đã được cập nhật ở nơi khác. Hãy tải lại phiên bản mới nhất trước khi thử lại.",
  BUSINESS_RULE: "Thao tác đang bị chặn bởi quy tắc nghiệp vụ.",
  RATE_LIMIT: "Có quá nhiều yêu cầu. Hãy thử lại sau ít phút.",
  TIMEOUT: "Yêu cầu mất quá nhiều thời gian. Hãy thử lại.",
  CANCELLED: "Thao tác đã bị hủy.",
  NETWORK: "Không thể kết nối dịch vụ. Hãy kiểm tra kết nối và thử lại.",
  INTEGRATION: "Dịch vụ tích hợp bên ngoài không thể hoàn tất thao tác.",
  INFRASTRUCTURE: "Dịch vụ tạm thời không khả dụng. Hãy thử lại sau.",
  UNKNOWN: "Đã xảy ra lỗi không mong muốn. Thay đổi chưa được xác nhận.",
};

/**
 * Architecture codes raised when connected mode refuses a business mutation because
 * the backend contract for it is not production-ready.
 *
 * These are fail-closed guards, not transient infrastructure faults: retrying cannot
 * succeed until the backend contract ships. Their raw messages name internal
 * registries, decision ids and command classifications, so presentation must never
 * show them to an end user.
 */
export const BACKEND_UNAVAILABLE_CODES: ReadonlySet<string> = new Set([
  "CONNECTED_LOCAL_WRITE_FORBIDDEN",
  "CONNECTED_OPERATION_REQUIRES_BACKEND",
  "CONNECTED_COMMAND_CONTRACT_BLOCKED",
  "CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY",
]);

/**
 * Every architecture refusal code whose internal message must never reach a user.
 *
 * These messages are diagnostics: they name workflow ids, command types, OpenAPI operation
 * ids, adapter requirements and resource-version plumbing. They stay on the error for logs
 * and tests; presentation maps the code to safe copy instead of rendering them.
 *
 * This is the single declaration — `presentApplicationError` and
 * `formatOperationUnavailableError` both read it, so a refusal cannot be safe in one path
 * and leaky in the other.
 */
export const UNSAFE_FOR_DISPLAY_CODES: ReadonlySet<string> = new Set([
  ...BACKEND_UNAVAILABLE_CODES,
  // Connected-mode contract and routing refusals.
  "CONNECTED_CONTRACT_VIOLATION",
  "CONNECTED_COMMAND_VARIANT_BLOCKED",
  "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
  // Demo/local authority plumbing.
  "LOCAL_MUTATION_EXECUTOR_REQUIRED",
  "IDEMPOTENCY_KEY_REUSED",
  // Module-level "needs a backend contract" refusals.
  "DEAL_EXPORT_BACKEND_REQUIRED",
  "ORDER_CONNECTED_MUTATION_REQUIRES_API",
  "QUOTE_CONNECTED_MUTATION_REQUIRES_API",
  "PRODUCT_CONNECTED_OPERATION_REQUIRES_BACKEND_CONTRACT",
  "LEAD_CONNECTED_OPERATION_NOT_IMPLEMENTED",
  "LEAD_QUALIFICATION_BACKEND_NOT_IMPLEMENTED",
  // Optimistic-concurrency plumbing: the user cannot act on a missing resource version.
  "DEAL_RESOURCE_VERSION_REQUIRED",
  "ORDER_RESOURCE_VERSION_REQUIRED",
  "QUOTE_RESOURCE_VERSION_REQUIRED",
  "TASK_RESOURCE_VERSION_REQUIRED",
  "PRODUCT_RESOURCE_VERSION_REQUIRED",
  "SUPPORT_CASE_RESOURCE_VERSION_REQUIRED",
]);

/**
 * Copy for an architecture refusal. It says the action is unavailable and that nothing
 * changed, because these refusals are fail-closed guards raised before any mutation.
 */
export const unavailableMessages = {
  en: "This action is not available yet: server support has not been released. Nothing was changed.",
  vi: "Thao tác này chưa khả dụng: hệ thống máy chủ chưa hỗ trợ. Dữ liệu của bạn chưa được thay đổi.",
} as const;

/** True when this error's own message is an internal diagnostic, not product copy. */
export function isUnsafeForDisplay(code: string): boolean {
  return UNSAFE_FOR_DISPLAY_CODES.has(code);
}

export function presentApplicationError(error: unknown, options: ErrorPresentationOptions = {}): ErrorPresentation {
  const normalized = normalizeApplicationError(error);
  const locale = options.locale?.toLowerCase().startsWith("vi") ? "vi" : "en";
  // An architecture refusal carries an internal diagnostic. Even if something set a
  // `userMessage` on it, it is not product copy — map the code to the safe unavailable
  // sentence instead. The diagnostic stays on the returned error for logs and tests.
  const unavailable = isUnsafeForDisplay(normalized.code);
  const message = unavailable
    ? (locale === "vi" ? unavailableMessages.vi : unavailableMessages.en)
    : normalized.userMessage
      ?? options.fallbackMessage
      ?? (locale === "vi" ? vietnameseMessages[normalized.category] : englishMessages[normalized.category]);
  const behavior = behaviorForCategory(normalized.category);
  return {
    error: normalized,
    message,
    surface: behavior.surface,
    action: behavior.action,
    retryable: normalized.retryable,
    ...(normalized.correlationId === undefined ? {} : { correlationId: normalized.correlationId }),
  };
}

export function formatApplicationError(error: unknown, options: ErrorPresentationOptions = {}): string {
  return presentApplicationError(error, options).message;
}

function behaviorForCategory(category: ApplicationErrorCategory): {
  surface: ErrorPresentationSurface;
  action: ErrorRecoveryAction;
} {
  switch (category) {
    case "VALIDATION": return { surface: "FIELD", action: "NONE" };
    case "AUTHENTICATION": return { surface: "PAGE", action: "SIGN_IN" };
    case "AUTHORIZATION": return { surface: "INLINE", action: "GO_BACK" };
    case "NOT_FOUND": return { surface: "PAGE", action: "GO_BACK" };
    case "CONFLICT": return { surface: "DIALOG", action: "REFRESH" };
    case "BUSINESS_RULE": return { surface: "INLINE", action: "NONE" };
    case "CANCELLED": return { surface: "SILENT", action: "NONE" };
    case "RATE_LIMIT":
    case "TIMEOUT":
    case "NETWORK":
    case "INTEGRATION":
    case "INFRASTRUCTURE": return { surface: "TOAST", action: "RETRY" };
    case "UNKNOWN": return { surface: "TOAST", action: "CONTACT_SUPPORT" };
  }
}
