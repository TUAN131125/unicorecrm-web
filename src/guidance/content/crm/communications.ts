import { createScreenGuidance } from "@/guidance/content/shared/createScreenGuidance";

export const COMMUNICATIONS_SCREEN_GUIDANCE = [
  { id: "list", routeKey: "COMMUNICATIONS", vi: "Hộp thư", en: "Inbox" },
  { id: "detail", routeKey: "COMMUNICATION_DETAIL", vi: "Chi tiết hội thoại", en: "Conversation detail" },
].map(screen => createScreenGuidance({
  id: `crm.communications.${screen.id}`,
  routeKey: screen.routeKey,
  productSpace: "crm",
  title: { vi: screen.vi, en: screen.en },
  version: 5,
  reviewedAt: "2026-10-16",
  purpose: { vi: "Đọc hội thoại được giao cho bạn trong Workspace hiện tại; hàng chờ chưa phân công chỉ hiển thị thông tin tối thiểu khi có quyền triage.", en: "Read conversations assigned to you in the current Workspace; unassigned triage shows only minimal metadata when permitted." },
  prerequisites: [{ vi: "Cần quyền Giao tiếp được cấp riêng; nội dung còn phụ thuộc người được giao và quyền từng trường.", en: "Explicit Communications access is required; content also depends on the current assignee and field permissions." }],
  primaryTasks: [
    { id: "crm-link", text: { vi: "Tìm Lead/Contact, chọn rồi xác nhận liên kết hoặc hủy. CRM cần quyền riêng; Contact kế nhiệm chỉ là gợi ý, không tự đổi link.", en: "Search Lead/Contact, select and confirm link or unlink. CRM needs separate access; successor Contact is a suggestion requiring confirmation." } },
    { id: "lifecycle", text: { vi: "Sau khi nhận, Bắt đầu xử lý → Chuyển chờ → Tiếp tục → Đóng hoặc Mở lại. Cần quyền đổi trạng thái; Claim không đổi trạng thái. Xem Đang hoạt động/Đã đóng; khi xung đột hãy tải lại.", en: "After Claim, Start → Pending → Resume → Close or Reopen with transition access. Claim preserves status. Use Active/Closed views; reload after a conflict." } },
    { id: "claim", text: { vi: "Trong Chưa phân công, chọn Nhận hội thoại khi có đủ quyền nhận, hàng chờ và đọc. Sau khi nhận, nội dung được tải lại theo quyền hiện tại. Nếu người khác nhận trước, làm mới hàng chờ.", en: "In Unassigned, choose Claim when claim, queue and read access permit it. After claiming, content reloads under current authorization. If another agent claims first, refresh the queue." } },
    { id: "review", text: { vi: "Mở hội thoại được giao cho bạn để đọc lịch sử tin nhắn được phép.", en: "Open an assigned conversation to read its permitted message history." } },
    { id: "page", text: { vi: "Chuyển trang hoặc làm mới; khi mất quyền, nội dung cũ sẽ được loại bỏ.", en: "Load the next page or refresh; old content is removed when access is lost." } },
  ],
  commonMistakes: [{ vi: "Quyền quản trị cấu hình không cấp quyền đọc hoặc nhận hội thoại. Khi lỗi mạng, làm mới rồi thử nhận lại; không phân công lại hoặc gửi Email tại đây.", en: "Configuration administration grants neither content read nor Claim. After a network failure, refresh and retry; reassignment and Email sending are unavailable here." }],
  keywords: { vi: "giao tiếp hộp thư hội thoại được giao chưa phân công", en: "communications inbox conversation assigned unassigned" },
}));
