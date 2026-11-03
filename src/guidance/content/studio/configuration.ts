import { CAPABILITIES } from "@/platform/access-control/domain/capabilityCatalog";
import type { GuidanceLocaleText, ScreenGuidance } from "@/guidance/domain/guidance.types";

type StudioGuidanceSeed = {
  id: string;
  routeKey: string;
  title: GuidanceLocaleText;
  purpose: GuidanceLocaleText;
  task: GuidanceLocaleText;
  mistake: GuidanceLocaleText;
  keywords: GuidanceLocaleText;
};

const seeds: readonly StudioGuidanceSeed[] = [
  {
    id: "studio.connections-overview", routeKey: "SETTINGS_CONNECTIONS",
    title: { vi: "Tổng quan kết nối", en: "Overview" },
    purpose: { vi: "Làm mới dữ liệu đọc. Xem subscriptions và tối đa 200 giao nhận mới nhất; trạng thái cấu hình không xác nhận sức khỏe. Mở Communications theo quyền để xem trạng thái tài khoản.", en: "Refresh read data. Review subscriptions and up to 200 latest deliveries; configuration state does not determine health. Open authorized Communications settings to review account state." },
    task: { vi: "Làm mới dữ liệu đọc. Xem subscriptions và tối đa 200 giao nhận mới nhất; trạng thái cấu hình không xác nhận sức khỏe. Mở Communications theo quyền để xem trạng thái tài khoản.", en: "Refresh read data. Review subscriptions and up to 200 latest deliveries; configuration state does not determine health. Open authorized Communications settings to review account state." },
    mistake: { vi: "Không coi dữ liệu demo hoặc khả năng chưa khả dụng là kết nối thật. Không dùng phiên đăng nhập làm khóa tích hợp.", en: "Do not treat demo data or unavailable capabilities as live connections. Do not use session credentials as integration keys." },
    keywords: { vi: "kết nối api nguồn webhook tổng quan kết nối", en: "connections api sources webhooks overview" },
  },
  {
    id: "studio.connections-inbound", routeKey: "SETTINGS_CONNECTIONS_INBOUND",
    title: { vi: "Nhận dữ liệu", en: "Inbound Sources" },
    purpose: { vi: "Đọc phạm vi nhận Lead có chữ ký qua nguồn được cấp ở máy chủ. Liên hệ quản trị viên về nguồn đã được cấp; quản lý nguồn trong Studio chưa khả dụng.", en: "Review signed Lead intake through server-provisioned sources. Contact your administrator about provisioned sources; Studio source management is unavailable." },
    task: { vi: "Đọc phạm vi nhận Lead có chữ ký qua nguồn được cấp ở máy chủ. Liên hệ quản trị viên về nguồn đã được cấp; quản lý nguồn trong Studio chưa khả dụng.", en: "Review signed Lead intake through server-provisioned sources. Contact your administrator about provisioned sources; Studio source management is unavailable." },
    mistake: { vi: "Không coi dữ liệu demo hoặc khả năng chưa khả dụng là kết nối thật. Không dùng phiên đăng nhập làm khóa tích hợp.", en: "Do not treat demo data or unavailable capabilities as live connections. Do not use session credentials as integration keys." },
    keywords: { vi: "kết nối api nguồn webhook nhận dữ liệu", en: "connections api sources webhooks inbound sources" },
  },
  {
    id: "studio.api-access", routeKey: "SETTINGS_API_ACCESS",
    title: { vi: "Truy cập API", en: "Developer API" },
    purpose: { vi: "Kiểm tra giới hạn truy cập API cho ứng dụng. Cấp, xoay vòng, thu hồi và giới hạn quyền của khóa API chưa khả dụng.", en: "Review application API access limits. Issuing, rotating, revoking and scoping API keys is unavailable." },
    task: { vi: "Kiểm tra giới hạn truy cập API cho ứng dụng. Cấp, xoay vòng, thu hồi và giới hạn quyền của khóa API chưa khả dụng.", en: "Review application API access limits. Issuing, rotating, revoking and scoping API keys is unavailable." },
    mistake: { vi: "Không coi dữ liệu demo hoặc khả năng chưa khả dụng là kết nối thật. Không dùng phiên đăng nhập làm khóa tích hợp.", en: "Do not treat demo data or unavailable capabilities as live connections. Do not use session credentials as integration keys." },
    keywords: { vi: "kết nối api nguồn webhook truy cập api", en: "connections api sources webhooks developer api" },
  },

  {
    id: "studio.communication-channels", routeKey: "SETTINGS_COMMUNICATION_CHANNELS",
    title: { vi: "Communications · Kênh kết nối", en: "Communications · Channel connections" },
    purpose: { vi: "Quản lý nhiều tài khoản trong Workspace theo ChannelAccountId.", en: "Manage multiple Workspace accounts by ChannelAccountId." },
    task: { vi: "Thêm nhiều tài khoản cùng provider. Với Telegram, xem thông tin xác thực, xác minh Bot rồi kích hoạt Inbound khi môi trường được cho phép; kiểm tra polling và lỗi theo từng tài khoản. Có thể dừng, kết nối lại hoặc ngắt kết nối.", en: "Add multiple accounts for the same provider. For Telegram, review credentials, verify the Bot and activate Inbound only in an admitted environment; review polling and errors per account. Deactivate, reconnect or disconnect as needed." },
    mistake: { vi: "Không nhập token thật khi live chưa được cho phép. Đã lưu token hoặc xác minh Bot không có nghĩa polling khỏe. Ngắt kết nối giữ thông tin xác thực được bảo vệ và lịch sử, yêu cầu xác minh lại; xóa cục bộ không thu hồi token Telegram. Khi xung đột, tải lại. Quyền quản lý không cấp quyền đọc hội thoại.", en: "Do not enter real tokens while live access is not admitted. Saving a token or verifying a Bot does not prove healthy polling. Disconnect preserves protected credentials and history and requires verification again; local removal does not revoke the Telegram token. Reload after a conflict. Management permission does not grant conversation access." },
    keywords: { vi: "communications kênh kết nối nhiều tài khoản gmail telegram", en: "communications channels multiple accounts gmail telegram" },
  },
  {
    id: "studio.quick-setup",
    routeKey: "SETTINGS_QUICK_SETUP",
    title: { vi: "Thiết lập nhanh", en: "Quick Setup" },
    purpose: { vi: "Hoàn tất các cấu hình thiết yếu theo luồng tùy chọn. Tự mở ở lần đầu vào Studio của workspace khi có quyền cấu hình; sau khi đóng hoặc hoàn tất, mở lại thủ công từ Studio.", en: "Complete essential configuration through an optional flow. Opens on the first Studio visit for workspace configurators; after closing or completing it, reopen manually from Studio." },
    task: { vi: "Lưu dữ liệu trong biểu mẫu của module rồi đánh dấu bước hoàn tất hoặc bỏ qua. Mô hình workspace có hạn tiếp nhận bàn giao Lead từ 1–168 giờ, mặc định 24.", en: "Save data in the owning module form, then finish or skip the step. The workspace blueprint includes Lead handover acceptance SLA: 1–168 elapsed hours, default 24." },
    mistake: { vi: "Quick Setup chỉ lưu tiến độ; không coi việc đánh dấu hoàn tất là đã lưu biểu mẫu.", en: "Quick Setup stores progress only; finishing a step does not save an unsaved form." },
    keywords: { vi: "thiết lập nhanh tùy chọn tiến độ", en: "quick setup optional progress" },
  },
  {
    id: "studio.business-information",
    routeKey: "SETTINGS_BUSINESS_INFORMATION",
    title: { vi: "Thông tin doanh nghiệp", en: "Business information" },
    purpose: { vi: "Quản lý thông tin nhận diện và pháp lý dùng chung trong workspace.", en: "Manage the shared business identity and legal information for the workspace." },
    task: { vi: "Nhập tên pháp lý/tên hiển thị, một địa chỉ đăng ký và email hoặc điện thoại hợp lệ rồi lưu. Backend kiểm tra lại bên bán khi phát hành Báo giá; thay đổi không sửa PDF cũ.", en: "Save legal/display names, one registered address and a valid email or phone. Backend rechecks seller data on Quote issue; changes do not alter old PDFs." },
    mistake: { vi: "Không nhập thông tin tài khoản nhận tiền tại đây; dùng trang Thông tin thanh toán.", en: "Do not enter receiving account details here; use Payment information." },
    keywords: { vi: "doanh nghiệp pháp lý mã số thuế địa chỉ logo", en: "business legal tax address logo" },
  },
  {
    id: "studio.locale-region",
    routeKey: "SETTINGS_LOCALE_REGION",
    title: { vi: "Ngôn ngữ & khu vực", en: "Language & region" },
    purpose: { vi: "Thiết lập ngôn ngữ, múi giờ, tiền tệ và quy ước hiển thị của workspace.", en: "Configure workspace language, time zone, currency, and display conventions." },
    task: { vi: "Chọn các quy ước phù hợp với doanh nghiệp rồi lưu.", en: "Select the conventions used by the business and save." },
    mistake: { vi: "Thay đổi tiền tệ mặc định không tự chuyển đổi giá trị tiền đã lưu.", en: "Changing the default currency does not convert stored monetary values." },
    keywords: { vi: "ngôn ngữ múi giờ tiền tệ định dạng ngày", en: "language timezone currency date format" },
  },
  {
    id: "studio.feature-usage",
    routeKey: "SETTINGS_FEATURE_USAGE",
    title: { vi: "Tính năng sử dụng", en: "Feature usage" },
    purpose: { vi: "Chọn các module nghiệp vụ được sử dụng trong workspace và lưu một lần sau khi rà soát.", en: "Choose the business modules used in the workspace and save once after review." },
    task: { vi: "Tìm module theo tên hoặc khả năng, dùng công tắc để bật hoặc tắt rồi lưu cấu hình.", en: "Find a module by name or capability, use its switch to enable or disable it, then save the configuration." },
    mistake: { vi: "Không rời màn hình khi thanh trạng thái còn báo có thay đổi chưa lưu; module Khách hàng 360 là nền tảng bắt buộc và không thể tắt.", en: "Do not leave while unsaved changes remain; Customer 360 is a required foundation and cannot be disabled." },
    keywords: { vi: "module tính năng bật tắt workspace", en: "module feature enable disable workspace" },
  },
  {
    id: "studio.pipelines-statuses",
    routeKey: "SETTINGS_PIPELINES_STATUSES",
    title: { vi: "Pipeline & trạng thái", en: "Pipelines & statuses" },
    purpose: { vi: "Tạo nhiều pipeline và chỉnh sửa trực tiếp các giai đoạn của Deal.", en: "Create multiple pipelines and directly edit Deal stages." },
    task: { vi: "Chọn một pipeline, thêm giai đoạn OPEN, đổi tên hoặc sắp xếp, rồi lưu và chờ máy chủ xác nhận. Pipeline mặc định chỉ áp dụng cho cơ hội mới.", en: "Select a pipeline, add OPEN stages, rename or reorder, then save and await server confirmation. The default applies only to new opportunities." },
    mistake: { vi: "Không xóa hoặc vô hiệu hóa giai đoạn đang có Deal. Giữ Thắng/Thua hoạt động; nếu xung đột phiên bản, tải lại để đối chiếu rồi lưu lại.", en: "Do not remove or deactivate stages containing Deals. Keep Won/Lost active; reload and review version conflicts before saving again." },
    keywords: { vi: "pipeline deal giai đoạn thắng thất bại", en: "pipeline deal stage won lost" },
  },
  {
    id: "studio.product-types",
    routeKey: "SETTINGS_PRODUCT_TYPES",
    title: { vi: "Loại sản phẩm", en: "Product types" },
    purpose: { vi: "Quản lý danh mục loại sản phẩm do doanh nghiệp tự định nghĩa.", en: "Manage the product type catalog defined by the business." },
    task: { vi: "Tạo loại mới từ đầu hoặc dùng gợi ý rồi đổi tên theo doanh nghiệp.", en: "Create a type from scratch or start from a suggestion and rename it for the business." },
    mistake: { vi: "Gợi ý không phải loại bắt buộc và có thể bỏ qua, sửa hoặc xóa.", en: "Suggestions are not mandatory and can be skipped, renamed, or removed." },
    keywords: { vi: "loại sản phẩm danh mục tự tạo", en: "product type category custom" },
  },
  {
    id: "studio.information-fields",
    routeKey: "SETTINGS_INFORMATION_FIELDS",
    title: { vi: "Trường thông tin", en: "Information fields" },
    purpose: { vi: "Xem toàn bộ trường backend cung cấp cho từng đối tượng và chỉnh các thuộc tính được phép.", en: "Review every backend-supplied field for each object and edit only permitted properties." },
    task: { vi: "Chọn đối tượng, tìm trường cần thay đổi và làm theo quyền chỉnh sửa backend trả về.", en: "Choose an object, find the field, and follow the edit capabilities returned by the backend." },
    mistake: { vi: "Không suy luận quyền sửa từ frontend; trường hệ thống có thể bị khóa một phần hoặc toàn bộ.", en: "Do not infer edit rights in the frontend; system fields may be partially or fully protected." },
    keywords: { vi: "trường thông tin hệ thống tùy chỉnh lead contact deal", en: "information fields system custom lead contact deal" },
  },
  {
    id: "studio.payment-information",
    routeKey: "SETTINGS_PAYMENT_INFORMATION",
    title: { vi: "Thông tin thanh toán", en: "Payment information" },
    purpose: { vi: "Quản lý tài khoản nhận tiền và hướng dẫn chuyển khoản của doanh nghiệp.", en: "Manage business receiving accounts and transfer instructions." },
    task: { vi: "Thêm tài khoản nhận tiền, chọn tài khoản mặc định và lưu.", en: "Add receiving accounts, choose the default account, and save." },
    mistake: { vi: "Trang này không xác nhận kết nối ngân hàng hoặc xử lý giao dịch thanh toán.", en: "This page does not verify bank connectivity or process payment transactions." },
    keywords: { vi: "ngân hàng tài khoản QR chuyển khoản", en: "bank account QR transfer" },
  },
  {
    id: "studio.invoice-information",
    routeKey: "SETTINGS_INVOICE_INFORMATION",
    title: { vi: "Thông tin hóa đơn", en: "Invoice information" },
    purpose: { vi: "Thiết lập thông tin người bán và nội dung mặc định trên hóa đơn.", en: "Configure seller information and invoice defaults." },
    task: { vi: "Cập nhật người bán, điều khoản mặc định và ghi chú hóa đơn.", en: "Update seller details, default terms, and invoice notes." },
    mistake: { vi: "Kết nối nhà cung cấp hóa đơn điện tử phải được thực hiện trong Tích hợp.", en: "Electronic invoice provider connections belong in Integrations." },
    keywords: { vi: "hóa đơn người bán thuế điều khoản", en: "invoice seller tax terms" },
  },
  {
    id: "studio.integrations",
    routeKey: "SETTINGS_INTEGRATIONS",
    title: { vi: "Ứng dụng & dịch vụ", en: "Apps & Services" },
    purpose: { vi: "Mở Communications theo quyền; quản lý các dịch vụ khác chưa khả dụng.", en: "Open authorized Communications settings; other service management is unavailable." },
    task: { vi: "Mở Communications · Kênh kết nối để quản lý nhiều tài khoản khi có quyền quản lý kênh. Thẻ Communications vẫn hiển thị khi phần cấu hình Studio khác chưa tải được. Mở đúng nhà cung cấp và xem trạng thái backend trả về.", en: "Open Communications · Channel connections to manage multiple accounts when you have channel management permission. The Communications entry remains available if other Studio configuration fails to load. Open the provider and review the status returned by the backend." },
    mistake: { vi: "Không coi cấu hình đã lưu là đã kết nối nếu backend chưa xác nhận.", en: "Do not treat saved configuration as connected until the backend confirms it." },
    keywords: { vi: "gmail zalo vận chuyển thanh toán tích hợp", en: "gmail zalo shipping payment integration" },
  },
  {
    id: "studio.webhooks-api",
    routeKey: "SETTINGS_WEBHOOKS_API",
    title: { vi: "Webhook gửi đi", en: "Outbound Webhooks" },
    purpose: { vi: "Xem đăng ký và giao nhận webhook từ máy chủ trong Workspace hiện tại.", en: "Review server webhook subscriptions and deliveries in the current Workspace." },
    task: { vi: "Xem trạng thái đăng ký và giao nhận. Các thao tác ghi cần quyền cấu hình; replay dựa trên khả năng máy chủ trả về.", en: "Review subscriptions and deliveries. Writes require configuration permission; replay depends on server-reported availability." },
    mistake: { vi: "Không hiển thị secret đầy đủ sau khi tạo và không gửi dữ liệu nhạy cảm ngoài phạm vi cần thiết.", en: "Do not reveal full secrets after creation or send sensitive data beyond the required scope." },
    keywords: { vi: "webhook api endpoint sự kiện secret", en: "webhook api endpoint event secret" },
  },
  {
    id: "studio.ai",
    routeKey: "SETTINGS_AI",
    title: { vi: "Trợ lý AI", en: "AI Assistant" },
    purpose: { vi: "Xem và cấu hình nhà cung cấp AI cho workspace. OpenAI cung cấp GPT-5.6/GPT-6 từ danh sách máy chủ; cấu hình đã lưu không tự đổi model.", en: "Review and configure AI providers for the workspace. OpenAI offers GPT-5.6/GPT-6 from the server catalog; saved configurations never change models automatically." },
    task: { vi: "Chọn OpenAI hoặc Gemini và model (dự án Google mới dùng Gemini 3.8 Flash), lưu bản nháp rồi nhập khóa Workspace và bấm Đặt khóa. Xác nhận máy chủ đã ghi nhận khóa. Kiểm tra kết nối bằng máy chủ, sau đó kích hoạt. Khi đổi nhà cung cấp hoặc khóa, kiểm tra rồi kích hoạt lại. Tắt AI sẽ chặn thực thi trong Workspace.", en: "Choose OpenAI or Gemini and a model (use Gemini 3.8 Flash for a new Google project), save the draft, then enter the Workspace key and select Set key. Confirm that the server has recorded it. Test the connection on the server, then activate. After provider or key changes, test and activate again. Disable blocks AI execution in the Workspace." },
    mistake: { vi: "Khóa đã lưu chưa có nghĩa đã kết nối. Nếu kiểm tra lại thất bại, cần xác minh lại trước khi kích hoạt. Lưu lựa chọn trước khi đặt khóa; không chia sẻ khóa bí mật. Bản active vẫn chạy trong lúc sửa bản nháp; mở hồ sơ Lead, Liên hệ, Tổ chức, Khách hàng, Cơ hội hoặc Công việc rồi mở UniCore AI. Chat chỉ phân tích hồ sơ có quyền đọc và không sửa CRM. Trạng thái chưa kiểm tra không xác nhận provider hoạt động. Lịch sử Connected chỉ nằm trong phiên, không lưu bền vững; Dừng hủy yêu cầu và Thử lại không thêm trùng câu hỏi.", en: "A saved key does not prove connectivity. A failed re-test requires validation again before activation. Save selections before setting a key; do not share secrets. The active configuration keeps serving while a draft is edited; open a Lead, Contact, Organization, Customer, Deal or Task, then open UniCore AI. Chat only analyzes authorized records and cannot change CRM. An unchecked status does not confirm provider availability. Connected history lasts for the session and is not durably saved; Stop cancels the request and Retry does not duplicate the question." },
    keywords: { vi: "AI trợ lý nhà cung cấp cấu hình", en: "AI assistant provider configuration" },
  },
] as const;

const accessGuidanceScreens = new Set(["studio.business-information", "studio.locale-region", "studio.feature-usage", "studio.pipelines-statuses", "studio.product-types", "studio.information-fields", "studio.payment-information", "studio.invoice-information", "studio.integrations"]);

export const STUDIO_SCREEN_GUIDANCE: readonly ScreenGuidance[] = seeds.map((seed) => ({
  id: seed.id,
  routeKey: seed.routeKey,
  productSpace: "studio",
  version: (seed.id === "studio.business-information" ? 3 : seed.id === "studio.pipelines-statuses" ? 4 : seed.id === "studio.ai" ? 7 : ["studio.connections-overview", "studio.connections-inbound", "studio.api-access", "studio.integrations", "studio.webhooks-api"].includes(seed.id) ? 4 : seed.id === "studio.communication-channels" || seed.id === "studio.integrations" || seed.id === "studio.ai" ? 3 : seed.id === "studio.quick-setup" ? 4 : 2) + (accessGuidanceScreens.has(seed.id) ? 2 : 0) + (["studio.business-information", "studio.information-fields", "studio.communication-channels"].includes(seed.id) ? 1 : 0),
  title: seed.title,
  purpose: seed.purpose,
  audience: {
    vi: "Quản trị viên hoặc người được giao cấu hình workspace.",
    en: "Administrators or users responsible for workspace configuration.",
  },
  prerequisites: [
    {
      vi: seed.id === "studio.communication-channels" ? "Cần quyền quản lý kênh riêng trong Workspace hiện tại. Live cần phê duyệt môi trường và bảo vệ thông tin xác thực; bình thường vẫn bị chặn." : seed.id === "studio.ai" ? "Bạn cần quyền xem cấu hình AI; quyền chỉnh sửa được kiểm tra riêng khi lưu." : "Bạn cần quyền xem Studio; quyền chỉnh sửa được kiểm tra riêng khi lưu.",
      en: seed.id === "studio.communication-channels" ? "Explicit channel management permission is required in the current Workspace. Live requires environment admission and credential custody; it remains blocked by default." : seed.id === "studio.ai" ? "You need AI configuration read access; edit permission is checked separately when saving." : "You need Studio read access; edit permission is checked separately when saving.",
    },
  ],
  primaryTasks: [
    {
      id: "configure",
      text: seed.task,
      requiredCapabilities: [seed.id === "studio.communication-channels" ? CAPABILITIES.COMMUNICATIONS_CHANNELS_MANAGE : seed.id === "studio.ai" ? CAPABILITIES.AI_CONFIGURATION_READ : CAPABILITIES.STUDIO_READ],
    },
    {
      id: "review-impact",
      text: {
        vi: "Kiểm tra phạm vi ảnh hưởng và trạng thái lưu trước khi rời màn hình.",
        en: "Review the affected scope and save status before leaving the screen.",
      },
      requiredCapabilities: [seed.id === "studio.communication-channels" ? CAPABILITIES.COMMUNICATIONS_CHANNELS_MANAGE : seed.id === "studio.ai" ? CAPABILITIES.AI_CONFIGURATION_READ : CAPABILITIES.STUDIO_READ],
    },
  ],
  commonMistakes: [seed.mistake],
  steps: seed.id === "studio.communication-channels" ? [{
    id: "telegram-lifecycle", targetId: "communications.telegram-lifecycle", optional: true, expectedAction: "view",
    title: { vi: "Xác minh và vận hành Telegram", en: "Telegram verification and operation" },
    body: { vi: "Trong tài khoản Telegram, kiểm tra quyền môi trường trước khi nhập token được che. Xác minh Bot rồi chủ động kích hoạt; theo dõi lần polling thành công và cập nhật đã lưu. Đổi token hoặc ngắt kết nối yêu cầu xác minh lại. Nếu bị lỗi hoặc xung đột, cập nhật trạng thái trước khi thử lại.", en: "In a Telegram account, check environment admission before entering a masked token. Verify the Bot, then explicitly activate; monitor successful polling and committed updates. Rotation or disconnect requires verification again. After errors or conflicts, refresh the authoritative state before retrying." },
  }] : [],
  requiredCapabilities: [seed.id === "studio.communication-channels" ? CAPABILITIES.COMMUNICATIONS_CHANNELS_MANAGE : seed.id === "studio.ai" ? CAPABILITIES.AI_CONFIGURATION_READ : CAPABILITIES.STUDIO_READ],
  keywords: seed.keywords,
  owner: "product-architecture",
  reviewedAt: seed.id === "studio.ai" ? "2026-10-22" : seed.id === "studio.communication-channels" ? "2026-10-17" : "2026-07-24",
}));
