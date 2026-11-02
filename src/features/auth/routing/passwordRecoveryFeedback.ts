import { ApplicationError } from "@/shared/domain";
import { formatApplicationError } from "@/shared/operations/errorPresentation";

export function passwordRecoveryFeedback(code: string, locale: string, resetting: boolean): string {
  const vi = locale === "vi";
  if (resetting && code === "TOKEN_EXPIRED") {
    return vi ? "Liên kết đã hết hạn. Hãy yêu cầu liên kết mới." : "This link has expired. Request a new link.";
  }
  if (resetting && code === "TOKEN_INVALID") {
    return vi ? "Liên kết không hợp lệ hoặc đã được sử dụng. Hãy yêu cầu liên kết mới." : "This link is invalid or has already been used. Request a new link.";
  }
  const category = code === "VALIDATION_FAILED" || code === "PASSWORD_POLICY_VIOLATION" ? "VALIDATION"
    : code === "RATE_LIMITED" ? "RATE_LIMIT"
      : "INFRASTRUCTURE";
  return formatApplicationError(new ApplicationError({ code, category, message: "Password recovery was not confirmed." }), { locale });
}
