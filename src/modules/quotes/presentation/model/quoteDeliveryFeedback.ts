import { normalizeApplicationError } from "@/shared/domain";
import { formatApplicationError } from "@/shared/operations";

export function quoteDeliveryFailureMessage(error: unknown, locale: string): string {
  const normalized = normalizeApplicationError(error);
  const details = normalized.details;
  const reason = details && typeof details === "object" && "detail" in details && typeof details.detail === "string" ? details.detail : "";
  const vi = locale === "vi";
  if (reason === "QUOTE_EXPIRED") return vi ? "Báo giá đã hết hạn theo múi giờ Workspace." : "The quote has expired in the Workspace timezone.";
  if (reason === "WORKSPACE_TIMEZONE_INVALID") return vi ? "Chưa xác định được múi giờ hợp lệ của Workspace." : "The Workspace timezone is unavailable.";
  if (normalized.code === "VALIDATION_FAILED") return vi ? "Thông tin gửi không hợp lệ. Kiểm tra người nhận phải khớp Báo giá và thời gian khai báo không ở tương lai." : "Invalid delivery details. Check the recipient matches the quote and the reported time is not in the future.";
  return formatApplicationError(error, { locale });
}
