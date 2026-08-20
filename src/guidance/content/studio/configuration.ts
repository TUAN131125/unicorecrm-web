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
    id: "studio.quick-setup",
    routeKey: "SETTINGS_QUICK_SETUP",
    title: { vi: "Thiết lập nhanh", en: "Quick Setup" },
    purpose: { vi: "Hoàn tất các cấu hình thiết yếu theo luồng tùy chọn và có thể mở lại.", en: "Complete essential configuration through an optional, reopenable flow." },
    task: { vi: "Lưu dữ liệu trong biểu mẫu của module rồi đánh dấu bước hoàn tất hoặc bỏ qua.", en: "Save data in the owning module form, then finish or skip the step." },
    mistake: { vi: "Quick Setup chỉ lưu tiến độ; không coi việc đánh dấu hoàn tất là đã lưu biểu mẫu.", en: "Quick Setup stores progress only; finishing a step does not save an unsaved form." },
    keywords: { vi: "thiết lập nhanh tùy chọn tiến độ", en: "quick setup optional progress" },
  },
  {
    id: "studio.business-information",
    routeKey: "SETTINGS_BUSINESS_INFORMATION",
    title: { vi: "Thông tin doanh nghiệp", en: "Business information" },
    purpose: { vi: "Quản lý thông tin nhận diện và pháp lý dùng chung trong workspace.", en: "Manage the shared business identity and legal information for the workspace." },
    task: { vi: "Cập nhật thông tin doanh nghiệp rồi lưu thay đổi.", en: "Update the business information and save the changes." },
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
    task: { vi: "Tạo pipeline, thêm giai đoạn, sắp xếp và chọn pipeline mặc định.", en: "Create a pipeline, add stages, reorder them, and choose the default pipeline." },
    mistake: { vi: "Không xóa giai đoạn đang có Deal; chọn giai đoạn thay thế trước.", en: "Do not delete a stage containing Deals; choose a replacement stage first." },
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
    title: { vi: "Tích hợp", en: "Integrations" },
    purpose: { vi: "Quản lý cấu hình kết nối email, nhắn tin, vận chuyển, thanh toán và nhà cung cấp ngoài.", en: "Manage connection configuration for email, messaging, shipping, payments, and external providers." },
    task: { vi: "Mở đúng nhà cung cấp, nhập thông tin được yêu cầu và xem trạng thái backend trả về.", en: "Open the provider, enter the required details, and review the status returned by the backend." },
    mistake: { vi: "Không coi cấu hình đã lưu là đã kết nối nếu backend chưa xác nhận.", en: "Do not treat saved configuration as connected until the backend confirms it." },
    keywords: { vi: "gmail zalo vận chuyển thanh toán tích hợp", en: "gmail zalo shipping payment integration" },
  },
  {
    id: "studio.webhooks-api",
    routeKey: "SETTINGS_WEBHOOKS_API",
    title: { vi: "Webhook & API", en: "Webhooks & API" },
    purpose: { vi: "Quản lý endpoint nhận dữ liệu và webhook phát sự kiện của workspace.", en: "Manage inbound endpoints and outbound event webhooks for the workspace." },
    task: { vi: "Tạo endpoint hoặc webhook, chọn sự kiện và lưu cấu hình.", en: "Create an endpoint or webhook, choose events, and save the configuration." },
    mistake: { vi: "Không hiển thị secret đầy đủ sau khi tạo và không gửi dữ liệu nhạy cảm ngoài phạm vi cần thiết.", en: "Do not reveal full secrets after creation or send sensitive data beyond the required scope." },
    keywords: { vi: "webhook api endpoint sự kiện secret", en: "webhook api endpoint event secret" },
  },
] as const;

export const STUDIO_SCREEN_GUIDANCE: readonly ScreenGuidance[] = seeds.map((seed) => ({
  id: seed.id,
  routeKey: seed.routeKey,
  productSpace: "studio",
  version: 2,
  title: seed.title,
  purpose: seed.purpose,
  audience: {
    vi: "Quản trị viên hoặc người được giao cấu hình workspace.",
    en: "Administrators or users responsible for workspace configuration.",
  },
  prerequisites: [
    {
      vi: "Bạn cần quyền xem Studio; quyền chỉnh sửa được kiểm tra riêng khi lưu.",
      en: "You need Studio read access; edit permission is checked separately when saving.",
    },
  ],
  primaryTasks: [
    {
      id: "configure",
      text: seed.task,
      requiredCapabilities: [CAPABILITIES.STUDIO_READ],
    },
    {
      id: "review-impact",
      text: {
        vi: "Kiểm tra phạm vi ảnh hưởng và trạng thái lưu trước khi rời màn hình.",
        en: "Review the affected scope and save status before leaving the screen.",
      },
      requiredCapabilities: [CAPABILITIES.STUDIO_READ],
    },
  ],
  commonMistakes: [seed.mistake],
  steps: [],
  requiredCapabilities: [CAPABILITIES.STUDIO_READ],
  keywords: seed.keywords,
  owner: "product-architecture",
  reviewedAt: "2026-07-24",
}));
