import type { CustomerOrder } from "@/modules/orders";

/** Only the Order owner's persisted state can establish confirmation. */
export function quoteOrderStateLabel(order: Pick<CustomerOrder, "state">, vi: boolean): string {
  const labels: Record<CustomerOrder["state"], [string, string]> = {
    DRAFT: ["Nháp", "Draft"],
    CONFIRMED: ["Đã xác nhận", "Confirmed"],
    CANCELLED: ["Đã hủy", "Cancelled"],
    COMPLETED: ["Hoàn tất", "Completed"],
  };
  return labels[order.state][vi ? 0 : 1];
}

export function quoteConversionBlocker(code: string, vi: boolean): string {
  const labels: Record<string, [string, string]> = {
    AUTO_CONFIRM_POLICY_DISABLED: ["Chưa bật xác nhận đơn hàng tự động. Liên hệ quản trị viên.", "Automatic Order confirmation is not enabled. Contact your administrator."],
    AUTO_CONFIRM_RISK_LIMIT_EXCEEDED: ["Giá trị báo giá vượt hạn mức xác nhận tự động. Cần kiểm tra chính sách bán hàng.", "Quote value exceeds the automatic confirmation limit. Review the sales policy."],
    AUTO_CONFIRM_PRODUCT_TYPE_BLOCKED: ["Loại sản phẩm cần kiểm tra điều kiện thực hiện trước khi xác nhận đơn hàng.", "This product type needs a fulfillment review before Order confirmation."],
    OPERATIONAL_APPROVAL_REQUIRED: ["Cần hoàn tất điều kiện duyệt vận hành theo chính sách hiện hành.", "Complete the operational approval required by the current policy."],
    CREDIT_APPROVAL_REQUIRED: ["Điều khoản trả sau cần phê duyệt tín dụng hợp lệ.", "Postpaid terms require valid credit approval."],
    VERIFIED_SIGNER_AUTHORITY_REQUIRED: ["Cần xác minh người đại diện trước khi xác nhận đơn hàng.", "Verify signing authority before Order confirmation."],
    FULFILLMENT_INFORMATION_REQUIRED: ["Cần bổ sung thông tin người nhận và giao hàng.", "Recipient and delivery information is required."],
    BUYER_BINDING_INVALID: ["Thông tin người mua cần được kiểm tra lại.", "Buyer information needs review."],
    PAYMENT_ACCOUNT_AUTHORITY_REQUIRED: ["Chưa có chỉ dẫn thanh toán hợp lệ.", "Valid payment instructions are required."],
    QUOTE_EXPIRED_OR_TIMEZONE_UNAVAILABLE: ["Cần kiểm tra hiệu lực báo giá và múi giờ trước khi tạo đơn hàng.", "Review Quote validity and timezone before creating the Order."],
  };
  return labels[code]?.[vi ? 0 : 1] ?? (vi ? "Chưa thể xác nhận đơn hàng. Liên hệ người phụ trách để kiểm tra điều kiện; hệ thống sẽ thử lại." : "Order confirmation is incomplete. Ask the responsible person to review the requirements; processing will retry.");
}
