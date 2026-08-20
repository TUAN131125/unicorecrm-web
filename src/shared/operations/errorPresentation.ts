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

export function presentApplicationError(error: unknown, options: ErrorPresentationOptions = {}): ErrorPresentation {
  const normalized = normalizeApplicationError(error);
  const locale = options.locale?.toLowerCase().startsWith("vi") ? "vi" : "en";
  const message = normalized.userMessage
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
