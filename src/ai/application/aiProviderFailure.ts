import { normalizeApplicationError } from "@/shared/domain";

/** Safe, contract-compatible provider reasons; never render provider diagnostics. */
export function presentAiProviderFailure(error: unknown, locale: "vi" | "en", surface: "USER" | "ADMIN" = "USER"): string | undefined {
  const normalized = normalizeApplicationError(error);
  if (normalized.code !== "AI_PROVIDER_UNAVAILABLE") return undefined;
  if (surface === "USER") return locale === "vi"
    ? "Dịch vụ AI chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ quản trị viên."
    : "The AI service is unavailable. Try again later or contact your administrator.";
  const reason = normalized.fieldErrors?.provider?.[0];
  if (reason === "WORKSPACE_AI_INACTIVE") return locale === "vi"
    ? "AI của Workspace đang tắt hoặc chưa kích hoạt. Hãy kiểm tra cấu hình AI trong Studio."
    : "Workspace AI is disabled or awaiting activation. Check AI settings in Studio.";
  if (reason === "CREDENTIAL_REJECTED") return locale === "vi"
    ? "Nhà cung cấp từ chối API key. Hãy cập nhật khóa trong Studio, kiểm tra rồi kích hoạt lại."
    : "The provider rejected the API key. Update it in Studio, test, then activate again.";
  if (reason === "CREDENTIAL_MISSING") return locale === "vi"
    ? "Máy chủ chưa có API key cho cấu hình này. Hãy lưu bản nháp, nhập khóa rồi bấm Đặt khóa."
    : "The server has no API key for this configuration. Save the draft, enter the key, then select Set key.";
  if (reason === "CREDENTIAL_UNREADABLE") return locale === "vi"
    ? "Máy chủ không đọc được API key đã lưu. Hãy nhập và lưu lại khóa trong Studio."
    : "The server cannot read the saved API key. Enter and save the key again in Studio.";
  if (reason === "CREDENTIAL_MISSING_OR_UNREADABLE") return locale === "vi"
    ? "API key chưa được lưu hoặc máy chủ không đọc được. Hãy nhập và lưu lại khóa trong Studio."
    : "The API key is missing or unreadable. Enter and save the key again in Studio.";
  if (reason === "PROVIDER_PERMISSION_DENIED") return locale === "vi"
    ? "Nhà cung cấp từ chối quyền truy cập. Hãy kiểm tra quyền của API key và dự án Google AI."
    : "The provider denied access. Check the API key permissions and Google AI project.";
  if (reason === "MODEL_UNAVAILABLE") return locale === "vi"
    ? "Model hoặc endpoint không khả dụng với cấu hình này. Hãy kiểm tra model trong Studio."
    : "The model or endpoint is unavailable for this configuration. Check the model in Studio.";
  if (reason === "PROVIDER_ACCOUNT_NOT_READY") return locale === "vi"
    ? "Dự án AI chưa đáp ứng điều kiện sử dụng. Hãy kiểm tra billing, số dư và khu vực của dự án."
    : "The AI project does not meet the provider prerequisites. Check project billing, credits and region.";
  if (reason === "PROVIDER_REQUEST_REJECTED") return locale === "vi"
    ? "Nhà cung cấp từ chối định dạng yêu cầu của hệ thống. Cần kiểm tra tích hợp AI."
    : "The provider rejected the system request format. The AI integration needs review.";
  if (reason === "PROVIDER_NETWORK_FAILURE") return locale === "vi"
    ? "Máy chủ không kết nối được tới nhà cung cấp AI. Hãy kiểm tra kết nối mạng và thử lại."
    : "The server could not reach the AI provider. Check network connectivity and try again.";
  if (reason === "PROVIDER_REQUEST_CANCELLED") return locale === "vi"
    ? "Yêu cầu kiểm tra đã bị hủy trước khi hoàn tất. Cấu hình chưa được xác minh; hãy tải lại trạng thái trước khi thử lại."
    : "The test request was cancelled before completion. The configuration is unverified; reload its status before trying again.";
  return undefined;
}
