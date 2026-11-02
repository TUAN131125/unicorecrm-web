export function quoteDocumentBlocker(code: string, vi: boolean): string {
  const labels: Record<string, [string, string]> = {
    SELLER_CONFIGURATION_MISSING: ["Chưa có cấu hình bên bán.", "Seller configuration is missing."],
    SELLER_LEGAL_NAME_REQUIRED: ["Cần tên pháp lý của bên bán.", "Seller legal name is required."],
    SELLER_DISPLAY_NAME_REQUIRED: ["Cần tên hiển thị của bên bán.", "Seller display name is required."],
    SELLER_REGISTERED_ADDRESS_REQUIRED_OR_AMBIGUOUS: ["Cần đúng một địa chỉ đăng ký đang hoạt động.", "Exactly one active registered address is required."],
    SELLER_CONTACT_REQUIRED: ["Cần email hoặc số điện thoại hợp lệ của bên bán.", "A valid seller email or phone is required."],
    SELLER_EMAIL_INVALID: ["Email bên bán chưa hợp lệ.", "Seller email is invalid."],
    SELLER_PHONE_INVALID: ["Số điện thoại bên bán chưa hợp lệ.", "Seller phone is invalid."],
    BLOCKED_CONTRACT_LOGO_ASSET: ["Logo chưa có nguồn tài nguyên được xác minh.", "The configured logo has no trusted asset source."],
    APPROVAL_BINDING_STALE: ["Cần đánh giá hoặc phê duyệt lại nội dung theo chính sách hiện hành.", "Current content needs a fresh approval assessment."],
    INDEPENDENT_APPROVAL_REQUIRED: ["Cần phê duyệt độc lập; yêu cầu đang chờ chưa thể phát hành.", "Independent approval is required; pending requests cannot issue."],
    APPROVAL_ASSESSMENT_REQUIRED: ["Cần đánh giá phê duyệt trước khi phát hành.", "Approval assessment is required before issue."],
    DOCUMENT_ALREADY_ISSUED: ["Nội dung này đã có tài liệu được phát hành; xem hoặc tải bản đã lưu.", "This content already has an issued document; view or download it."],
    QUOTE_EXPIRED: ["Báo giá đã quá hạn theo ngày Workspace.", "The Quote is overdue in Workspace time."],
    WORKSPACE_TIMEZONE_UNAVAILABLE: ["Chưa xác minh được múi giờ Workspace.", "Workspace timezone is unavailable."],
    QUOTE_STATE_INVALID: ["Trạng thái hiện tại không cho phép phát hành mới.", "The current state does not allow new issuance."],
    ACCESS_DENIED: ["Bạn chưa có đủ quyền phát hành hoặc đọc các trường chứng từ.", "Issuance or document field access is denied."],
  };
  return labels[code]?.[vi ? 0 : 1] ?? (vi ? "Chưa đủ điều kiện phát hành tài liệu." : "Document issuance requirements are not met.");
}
