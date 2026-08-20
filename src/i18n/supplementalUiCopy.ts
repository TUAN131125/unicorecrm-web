export interface SupplementalUiCopyEntry {
  vi: string;
  en: string;
  sources?: readonly string[];
}

export interface SupplementalUiCopyTemplate {
  viPattern: RegExp;
  enPattern: RegExp;
  vi: string;
  en: string;
}

/**
 * Audited user-facing copy discovered outside JSX text nodes: toast/error
 * messages, operation metadata, accessibility labels, and historical mixed-language
 * surfaces. Sources are alternate literals emitted by earlier UI code; vi/en are the
 * normalized copies presented to users.
 */
export const supplementalUiCopyEntries: SupplementalUiCopyEntry[] = [
  { vi: "Bạn không có quyền truy cập khu vực nào trong không gian làm việc này.", en: "You do not have access to any area in this workspace." },
  { vi: "Thiết lập cá nhân chưa khả dụng. Hãy thử lại sau.", en: "Personal preferences are unavailable. Please try again later." },

  { vi: "Vận hành quan hệ khách hàng trong một không gian tin cậy.", en: "Operate customer relationships inside a trusted workspace." },
  { vi: "Bắt đầu gọn gàng. Mở rộng quyền truy cập đúng lúc.", en: "Start clean. Expand access only when it is needed." },
  { vi: "Biến tín hiệu thành quan hệ thương mại có lịch sử liên tục.", en: "Turn every signal into a continuous commercial relationship." },

  { vi: "Vui lòng nhập lý do cụ thể!", en: "Please enter a specific reason." },
  { vi: "Đã lưu trạng thái Không phù hợp.", en: "Disqualified status saved.", sources: ["Đã lưu trạng thái Không đạt."] },
  { vi: "Vui lòng nhập tiêu đề cuộc gọi!", en: "Please enter a call subject." },
  { vi: "Đã ghi nhận cuộc gọi thành công!", en: "Call logged successfully!", sources: ["Đăng cuộc gọi thành công!"] },
  { vi: "Vui lòng nhập tên công việc!", en: "Please enter a task title.", sources: ["Vui lòng điền tên công việc!"] },
  { vi: "Vui lòng nhập tiêu đề cuộc hẹn!", en: "Please enter a meeting title.", sources: ["Vui lòng điền tiêu đề cuộc hẹn!"] },
  { vi: "Đã lên lịch cuộc hẹn!", en: "Meeting scheduled!" },
  { vi: "Tiêu đề và nội dung email không được để trống!", en: "Email subject and body are required!", sources: ["Tiêu đề và nội dung Email không được để trống!"] },
  { vi: "Nội dung tin nhắn không được để trống!", en: "Message content is required!" },
  { vi: "Nội dung ghi chú không được để trống!", en: "Note content is required!", sources: ["Nội dung ghi chú trống!"] },
  { vi: "Ghi chú đã được lưu!", en: "Note saved!", sources: ["Ghi chú được lưu trữ!"] },

  { vi: "Ngày chốt dự kiến", en: "Close date", sources: ["Close Date"] },
  { vi: "Điểm (%)", en: "Score (%)" },
  { vi: "Ghi chú đã bị gỡ khỏi hệ thống.", en: "The note was removed from the system." },
  { vi: "CẬP NHẬT TRẠNG THÁI HÀNG LOẠT", en: "BULK STATUS UPDATE" },

  { vi: "Tên tổ chức là bắt buộc.", en: "Organization name is required." },
  { vi: "Họ tên cá nhân là bắt buộc.", en: "Representative name is required." },
  { vi: "Cần có số điện thoại hoặc email.", en: "A phone number or email address is required." },
  { vi: "Tổ chức B2B phải có ít nhất một cá nhân đại diện.", en: "A B2B organization must have at least one representative." },
  { vi: "Cá nhân đại diện cần có số điện thoại hoặc email để duy trì liên hệ.", en: "The representative needs a phone number or email address for ongoing contact." },
  { vi: "Thiếu người đại diện chính", en: "Primary representative missing", sources: ["Thiếu Contact đại diện chính"] },
  { vi: "Phạm vi dữ liệu tài khoản", en: "Account data coverage", sources: ["Phạm vi dữ liệu account"] },
  { vi: "Liên hệ được liên kết", en: "Linked contacts", sources: ["Contact liên kết"] },
  { vi: "Công việc đang mở", en: "Open tasks", sources: ["Công việc mở"] },
  { vi: "Dữ liệu thương mại", en: "Commercial data" },
  { vi: "Chưa có người đại diện chính", en: "No primary representative", sources: ["Chưa có đại diện chính"] },
  { vi: "Thiếu định danh doanh nghiệp tin cậy", en: "Strong business identity missing", sources: ["Thiếu định danh doanh nghiệp mạnh"] },
  { vi: "Khoảng trống và điểm cần theo dõi", en: "Gaps and follow-up points" },
  { vi: "Nhận định từ dữ liệu hiện tại", en: "Insights from current data" },
  { vi: "Cơ hội đang mở", en: "Open opportunities", sources: ["Pipeline mở"] },
  { vi: "Độ phủ dữ liệu", en: "Data coverage" },
  { vi: "Thêm tổ chức", en: "Add organization" },
  { vi: "Lọc trạng thái", en: "Filter by status" },
  { vi: "Lọc người đại diện", en: "Filter by representative" },
  { vi: "Lọc ngành", en: "Filter by industry" },
  { vi: "Lọc quy mô", en: "Filter by size" },
  { vi: "Dữ liệu tổ chức đã được làm mới từ nguồn dữ liệu hiện tại.", en: "Organization data was refreshed from the current data source." },

  { vi: "Thanh toán toàn bộ", en: "Pay in full" },
  { vi: "Chiết khấu trực tiếp", en: "Direct discount" },
  { vi: "Chiết khấu / Phí mới", en: "New discount / fee", sources: ["Chiết khấu/Phí mới"] },

  { vi: "Địa chỉ lấy hàng trả", en: "Return pickup address" },
  { vi: "Hàng yêu cầu", en: "Requested items" },
  { vi: "Thu hồi & nhận hàng", en: "Collection & receipt", sources: ["Thu hồi & Nhận hàng"] },
  { vi: "Xử lý", en: "Resolution" },
  { vi: "Bước vận hành tiếp theo", en: "Next operational step" },
  { vi: "Đánh giá & ra quyết định", en: "Assess & decide" },
  { vi: "Kiểm tra điều kiện, số lượng được duyệt và lý do ngoại lệ nếu có.", en: "Review eligibility, approved quantities, and any exception reason.", sources: ["Kiểm tra eligibility, approved quantity và lý do override nếu có."] },
  { vi: "Thiết lập cách thu hồi", en: "Configure collection" },
  { vi: "Chọn đơn vị lấy hàng, khách tự gửi, điểm nhận hoặc không cần hoàn hàng.", en: "Choose carrier pickup, customer self-ship, drop-off, or no return shipment.", sources: ["Chọn carrier pickup, self-ship, drop-off hoặc không cần hoàn hàng."] },
  { vi: "Ghi nhận hàng thực nhận", en: "Record received items" },
  { vi: "Nhập số lượng thực tế từng dòng, không tự mặc định nhận đủ.", en: "Enter the actual quantity for each line; do not assume everything was received.", sources: ["Nhập số lượng thực tế từng line, không tự mặc định nhận đủ."] },
  { vi: "Hoàn tất kiểm tra hàng", en: "Complete inspection", sources: ["Hoàn tất inspection"] },
  { vi: "Chốt số lượng chấp nhận, từ chối và bằng chứng tình trạng hàng.", en: "Finalize accepted and rejected quantities with condition evidence.", sources: ["Chốt accepted/rejected quantity và condition evidence."] },
  { vi: "Thực hiện phương án xử lý", en: "Execute resolution", sources: ["Thực hiện resolution"] },
  { vi: "Hoàn tiền, gửi hàng thay thế, đổi hàng hoặc sửa chữa phải chờ đủ bằng chứng liên quan.", en: "Refund, replacement, exchange, or repair must wait for the required downstream evidence.", sources: ["Refund, replacement, exchange hoặc repair phải chờ đúng downstream evidence."] },
  { vi: "Kiểm tra bằng chứng cuối cùng rồi chuyển hồ sơ sang ĐÃ ĐÓNG.", en: "Review the final evidence, then move the case to CLOSED.", sources: ["Kiểm tra evidence cuối cùng rồi chuyển hồ sơ sang CLOSED."] },
  { vi: "Xem hoạt động", en: "View activity" },
  { vi: "Hồ sơ hiện không có hành động vận hành bắt buộc.", en: "This case currently has no required operational action." },
  { vi: "Yêu cầu được tạo", en: "Request created" },
  { vi: "Điều kiện & quyết định", en: "Eligibility & decision", sources: ["Eligibility & quyết định"] },
  { vi: "Cách thu hồi hàng", en: "Collection method" },
  { vi: "Nhận hàng thực tế", en: "Actual receipt" },
  { vi: "Bằng chứng xử lý", en: "Resolution evidence", sources: ["Resolution evidence"] },
  { vi: "Các phần chi tiết đổi / trả", en: "Return detail sections", sources: ["Return detail sections"] },
  { vi: "Tiến độ nhận hàng", en: "Receiving progress", sources: ["Receive progress"] },
  { vi: "NGHIỆP VỤ", en: "OPERATIONS" },
  { vi: "Đã đóng yêu cầu đổi / trả. Kết quả kiểm tra hàng và toàn bộ lịch sử xử lý vẫn được lưu.", en: "The return request was closed. Inspection results and the complete handling history remain available." },
  { vi: "Tổng hồ sơ", en: "Total cases" },
  { vi: "Tất cả hồ sơ đổi / trả đang lưu", en: "All stored return cases", sources: ["Mọi Return case đang lưu"] },
  { vi: "Cần xử lý", en: "Needs attention" },
  { vi: "Hồ sơ đang chờ quyết định", en: "Cases awaiting a decision", sources: ["Case đang chờ quyết định"] },
  { vi: "Điều kiện và phê duyệt", en: "Eligibility and approval", sources: ["Eligibility và approval"] },
  { vi: "Đang chờ hàng", en: "Awaiting items" },
  { vi: "Thu hồi hoặc chờ nhận", en: "Collection or receipt pending" },
  { vi: "Kiểm tra hàng hoặc xử lý", en: "Inspection or resolution", sources: ["Inspection hoặc resolution"] },
  { vi: "Đã có đủ bằng chứng", en: "Evidence complete", sources: ["Đã có đủ evidence"] },

  { vi: "Tạo lần giao mới", en: "Create a new attempt", sources: ["Tạo attempt mới"] },
  { vi: "Thử lại trong cùng nhóm giao hàng để giữ đúng yêu cầu và toàn bộ lịch sử.", en: "Retry within the same shipment group to preserve the requirement and full history.", sources: ["Retry trong cùng shipment group để giữ lịch sử và requirement đúng."] },
  { vi: "Đồng bộ đơn vị vận chuyển", en: "Sync carrier", sources: ["Đồng bộ carrier"] },
  { vi: "Cập nhật hành trình và chuyển bằng chứng COD sang Thanh toán nếu có.", en: "Update the journey and pass COD evidence to Payments when available.", sources: ["Cập nhật hành trình và chuyển COD evidence sang Payment nếu có."] },
  { vi: "Mở nguồn liên quan", en: "Open related source" },
  { vi: "Xem đơn hàng hoặc yêu cầu đổi / trả đã tạo yêu cầu giao hàng này.", en: "Open the order or return request that created this shipment requirement.", sources: ["Xem Order hoặc Return đã tạo shipment requirement này."] },
  { vi: "Đặt vận chuyển", en: "Carrier booking", sources: ["Carrier booking"] },
  { vi: "Lấy hàng", en: "Pickup" },
  { vi: "Đang vận chuyển", en: "In transit" },
  { vi: "Giao thành công", en: "Delivered" },
  { vi: "Người gửi & nhận", en: "Sender & recipient" },
  { vi: "Kiện hàng", en: "Package" },
  { vi: "Hành trình", en: "Journey" },
  { vi: "Lần thử & hoạt động", en: "Attempts & activity", sources: ["Attempts & hoạt động"] },
  { vi: "Các phần chi tiết vận đơn", en: "Shipping detail sections", sources: ["Shipping detail sections"] },
  { vi: "Đã hủy giao hàng. Hồ sơ vận đơn và lịch sử các lần thử vẫn được giữ nguyên.", en: "Shipping was cancelled. The shipment record and attempt history remain intact.", sources: ["Đã hủy booking. Shipment record và lịch sử attempt được giữ nguyên."] },
  { vi: "Tổng vận đơn", en: "Total shipments" },
  { vi: "Tất cả các lần giao hàng", en: "All shipment attempts", sources: ["Tất cả shipment attempts"] },
  { vi: "Hàng đợi ưu tiên", en: "Priority work queue", sources: ["Work queue ưu tiên"] },
  { vi: "Thiếu dữ liệu", en: "Missing data" },
  { vi: "Thiếu thông tin bắt buộc", en: "Required information missing" },
  { vi: "Đã lấy hàng hoặc đang vận chuyển", en: "Picked up or in transit", sources: ["Đã pickup hoặc in transit"] },
  { vi: "Giao hôm nay", en: "Delivered today" },
  { vi: "Có bằng chứng thời điểm giao", en: "Delivery timestamp available", sources: ["Có deliveredAt evidence"] },
  { vi: "COD cần đối soát", en: "COD reconciliation", sources: ["COD đối soát"] },
  { vi: "Đơn vị vận chuyển đã thu, đang chờ xử lý", en: "Carrier collected the COD amount; processing is pending.", sources: ["Carrier đã thu, chờ xử lý"] },

  { vi: "Các phần chi tiết thanh toán", en: "Payment detail sections", sources: ["Payment detail sections"] },
  { vi: "Lead đã đóng: Không phù hợp", en: "Lead closed: Disqualified", sources: ["Lead closed: Disqualified"] },
  { vi: "Theo dõi tiếp", en: "Follow up", sources: ["Follow up"] },
];

/**
 * Exact templates for historical dynamic copy. Captures keep record data intact and
 * only translate the audited surrounding UI language.
 */
export const supplementalUiCopyTemplates: SupplementalUiCopyTemplate[] = [
  { viPattern: /^Cơ hội \[(.+)] chuyển từ \[(.+)] sang \[(.+)]$/, enPattern: /^Opportunity \[(.+)] moved from \[(.+)] to \[(.+)]$/, vi: "Cơ hội [{{1}}] chuyển từ [{{2}}] sang [{{3}}]", en: "Opportunity [{{1}}] moved from [{{2}}] to [{{3}}]" },
  { viPattern: /^Đã đưa liên hệ vào chiến dịch: (.+) \(Kênh: (.+)\)$/, enPattern: /^Contact was added to campaign: (.+) \(Channel: (.+)\)$/, vi: "Đã đưa liên hệ vào chiến dịch: {{1}} (Kênh: {{2}})", en: "Contact was added to campaign: {{1}} (Channel: {{2}})" },
  { viPattern: /^Tạo thẻ tư vấn: (.+) \| Cố vấn phụ trách: (.+)$/, enPattern: /^Advisory card created: (.+) \| Advisor: (.+)$/, vi: "Tạo thẻ tư vấn: {{1}} | Cố vấn phụ trách: {{2}}", en: "Advisory card created: {{1}} | Advisor: {{2}}" },
  { viPattern: /^Trạng thái được cập nhật thành: (.+)$/, enPattern: /^Status updated to: (.+)$/, vi: "Trạng thái được cập nhật thành: {{1}}", en: "Status updated to: {{1}}" },
  { viPattern: /^Đại diện chính: (.+)$/, enPattern: /^Primary representative: (.+)$/, vi: "Đại diện chính: {{1}}", en: "Primary representative: {{1}}" },
  { viPattern: /^(\d+) phiếu hỗ trợ liên quan$/, enPattern: /^(\d+) related support tickets?$/, vi: "{{1}} phiếu hỗ trợ liên quan", en: "{{1}} related support tickets" },
  { viPattern: /^(\d+) cơ hội đang mở$/, enPattern: /^(\d+) open opportunities$/, vi: "{{1}} cơ hội đang mở", en: "{{1}} open opportunities" },
  { viPattern: /^(\d+) hỗ trợ cần theo dõi$/, enPattern: /^(\d+) support tickets need follow-up$/, vi: "{{1}} hỗ trợ cần theo dõi", en: "{{1}} support tickets need follow-up" },
  { viPattern: /^(\d+) công việc đang mở$/, enPattern: /^(\d+) open tasks$/, vi: "{{1}} công việc đang mở", en: "{{1}} open tasks" },
  { viPattern: /^Đã xuất (\d+) tổ chức B2B\.$/, enPattern: /^Exported (\d+) B2B organizations\.$/, vi: "Đã xuất {{1}} tổ chức B2B.", en: "Exported {{1}} B2B organizations." },
  { viPattern: /^Đã tạo tổ chức (.+) cùng cá nhân đại diện chính\.$/, enPattern: /^Created organization (.+) with its primary representative\.$/, vi: "Đã tạo tổ chức {{1}} cùng cá nhân đại diện chính.", en: "Created organization {{1}} with its primary representative." },
  { viPattern: /^Tạo Refund Intent authoritative cho (.+)\. Khoản đã phân bổ phải được đảo trước khi hoàn\.$/, enPattern: /^Create an authoritative Refund Intent for (.+)\. Allocations must be reversed before the refund\.$/, vi: "Tạo yêu cầu hoàn tiền có thẩm quyền cho {{1}}. Khoản đã phân bổ phải được đảo trước khi hoàn.", en: "Create an authoritative Refund Intent for {{1}}. Allocations must be reversed before the refund." },
  { viPattern: /^Đợt (\d+)$/, enPattern: /^Installment (\d+)$/, vi: "Đợt {{1}}", en: "Installment {{1}}" },
  { viPattern: /^(\d+)\/(\d+) đơn vị$/, enPattern: /^(\d+)\/(\d+) units$/, vi: "{{1}}/{{2}} đơn vị", en: "{{1}}/{{2}} units" },
  { viPattern: /^(\d+)\/(\d+) intent thành công$/, enPattern: /^(\d+)\/(\d+) intents succeeded$/, vi: "{{1}}/{{2}} yêu cầu thành công", en: "{{1}}/{{2}} intents succeeded" },
  { viPattern: /^Số lượng duyệt (.+)$/, enPattern: /^Approved quantity for (.+)$/, vi: "Số lượng duyệt {{1}}", en: "Approved quantity for {{1}}" },
  { viPattern: /^Thao tác với yêu cầu (.+)$/, enPattern: /^Actions for return request (.+)$/, vi: "Thao tác với yêu cầu {{1}}", en: "Actions for return request {{1}}" },
  { viPattern: /^Thao tác vận đơn (.+)$/, enPattern: /^Actions for shipment (.+)$/, vi: "Thao tác vận đơn {{1}}", en: "Actions for shipment {{1}}" },
  { viPattern: /^Lần giao hàng (.+) sẽ ngừng xử lý\. Đơn hàng và toàn bộ lịch sử giao hàng vẫn được giữ lại\.$/, enPattern: /^Shipment (.+) will stop processing\. The order and complete shipping history remain available\.$/, vi: "Lần giao hàng {{1}} sẽ ngừng xử lý. Đơn hàng và toàn bộ lịch sử giao hàng vẫn được giữ lại.", en: "Shipment {{1}} will stop processing. The order and complete shipping history remain available." },
  { viPattern: /^Phiên bản v(.+)$/, enPattern: /^Revision v(.+)$/, vi: "Phiên bản v{{1}}", en: "Revision v{{1}}" },
  { viPattern: /^Tín hiệu thu hút từ (.+)$/, enPattern: /^Acquisition signal from (.+)$/, vi: "Tín hiệu thu hút từ {{1}}", en: "Acquisition signal from {{1}}" },
  { viPattern: /^Lead (.+) đã lưu nguồn gốc tín hiệu\.$/, enPattern: /^Lead (.+) preserved source lineage\.$/, vi: "Lead {{1}} đã lưu nguồn gốc tín hiệu.", en: "Lead {{1}} preserved source lineage." },
  { viPattern: /^Lead đã đóng: (.+)$/, enPattern: /^Lead closed: (.+)$/, vi: "Lead đã đóng: {{1}}", en: "Lead closed: {{1}}" },
  { viPattern: /^Đã tạo cơ hội: (.+)$/, enPattern: /^Deal created: (.+)$/, vi: "Đã tạo cơ hội: {{1}}", en: "Deal created: {{1}}" },
  { viPattern: /^Báo giá (.+): (.+)$/, enPattern: /^Quote (.+): (.+)$/, vi: "Báo giá {{1}}: {{2}}", en: "Quote {{1}}: {{2}}" },
  { viPattern: /^Đơn hàng (.+): (.+)$/, enPattern: /^Order (.+): (.+)$/, vi: "Đơn hàng {{1}}: {{2}}", en: "Order {{1}}: {{2}}" },
  { viPattern: /^Vận đơn (.+): (.+)$/, enPattern: /^Shipment (.+): (.+)$/, vi: "Vận đơn {{1}}: {{2}}", en: "Shipment {{1}}: {{2}}" },
  { viPattern: /^Chạy thử đã kiểm tra (\d+) bản ghi và khớp (\d+); không có dữ liệu nào được ghi\.$/, enPattern: /^Dry-run inspected (\d+) records and matched (\d+); no writes were performed\.$/, vi: "Chạy thử đã kiểm tra {{1}} bản ghi và khớp {{2}}; không có dữ liệu nào được ghi.", en: "Dry-run inspected {{1}} records and matched {{2}}; no writes were performed." },
];
