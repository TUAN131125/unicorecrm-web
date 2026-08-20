import { CAPABILITIES } from "@/platform/access-control/domain/capabilityCatalog";
import type { GuidanceChecklist } from "@/guidance/domain/guidance.types";

export const GUIDANCE_CHECKLISTS: GuidanceChecklist[] = [
  {
    id: "crm.checklist.sales",
    title: { vi: "Checklist nhân viên kinh doanh", en: "Sales checklist" },
    description: { vi: "Làm quen với luồng từ khách hàng tiềm năng đến đơn hàng.", en: "Learn the path from lead to order." },
    requiredAnyCapabilities: [CAPABILITIES.LEADS_READ, CAPABILITIES.DEALS_READ, CAPABILITIES.QUOTES_READ, CAPABILITIES.ORDERS_READ],
    items: [
      { id: "lead", title: { vi: "Tạo và xử lý khách hàng tiềm năng", en: "Create and work a lead" }, description: { vi: "Bổ sung nhu cầu, nguồn và người phụ trách.", en: "Complete need, source, and owner." }, route: "leads", requiredCapabilities: [CAPABILITIES.LEADS_READ] },
      { id: "deal", title: { vi: "Theo dõi một cơ hội", en: "Track an opportunity" }, description: { vi: "Cập nhật giai đoạn và bước tiếp theo.", en: "Update stage and next step." }, route: "deals", requiredCapabilities: [CAPABILITIES.DEALS_READ] },
      { id: "quote", title: { vi: "Lập một báo giá", en: "Prepare a quote" }, description: { vi: "Kiểm tra sản phẩm, giá và điều khoản.", en: "Review products, pricing, and terms." }, route: "quotes", requiredCapabilities: [CAPABILITIES.QUOTES_READ] },
      { id: "order", title: { vi: "Tạo một đơn hàng hợp lệ", en: "Create a valid order" }, description: { vi: "Xác nhận người mua, người nhận và sản phẩm.", en: "Confirm buyer, recipient, and products." }, route: "orders/new", requiredCapabilities: [CAPABILITIES.ORDERS_CREATE] },
    ],
  },
  {
    id: "crm.checklist.operations",
    title: { vi: "Checklist nhân viên vận hành", en: "Operations checklist" },
    description: { vi: "Làm quen với đơn hàng, thanh toán, giao hàng và đổi/trả.", en: "Learn orders, payments, shipping, and returns." },
    requiredAnyCapabilities: [CAPABILITIES.ORDERS_READ, CAPABILITIES.PAYMENTS_READ, CAPABILITIES.SHIPPING_READ, CAPABILITIES.RETURNS_READ],
    items: [
      { id: "orders", title: { vi: "Kiểm tra đơn hàng cần xử lý", en: "Review orders that need work" }, description: { vi: "Mở chi tiết và kiểm tra điều kiện vận hành.", en: "Open details and review operational readiness." }, route: "orders", requiredCapabilities: [CAPABILITIES.ORDERS_READ] },
      { id: "payments", title: { vi: "Ghi nhận hoặc đối soát thanh toán", en: "Record or reconcile payment" }, description: { vi: "Làm việc trên giao dịch thực tế.", en: "Work from actual transaction evidence." }, route: "payments", requiredCapabilities: [CAPABILITIES.PAYMENTS_READ] },
      { id: "shipping", title: { vi: "Tạo và theo dõi vận đơn", en: "Create and track shipping" }, description: { vi: "Chọn nhà vận chuyển và theo dõi trạng thái.", en: "Choose a provider and track status." }, route: "shipping", requiredCapabilities: [CAPABILITIES.SHIPPING_READ] },
      { id: "returns", title: { vi: "Xử lý một yêu cầu đổi/trả", en: "Process a return request" }, description: { vi: "Tách điều kiện, phê duyệt, nhận hàng và phương án xử lý.", en: "Separate eligibility, approval, receipt, and resolution." }, route: "returns", requiredCapabilities: [CAPABILITIES.RETURNS_READ] },
    ],
  },
  {
    id: "crm.checklist.customer-care",
    title: { vi: "Checklist chăm sóc khách hàng", en: "Customer care checklist" },
    description: { vi: "Theo dõi phiếu hỗ trợ và giao công việc xử lý rõ ràng.", en: "Track support tickets and assign clear follow-up tasks." },
    requiredAnyCapabilities: [CAPABILITIES.SUPPORT_READ, CAPABILITIES.TASKS_READ],
    items: [
      { id: "ticket", title: { vi: "Tạo hoặc mở phiếu hỗ trợ", en: "Create or open a support ticket" }, description: { vi: "Liên kết đúng khách hàng và đặt lần hẹn tiếp theo.", en: "Link the correct customer and set the next follow-up." }, route: "support/cases", requiredCapabilities: [CAPABILITIES.SUPPORT_READ] },
      { id: "task", title: { vi: "Giao công việc cụ thể", en: "Assign a concrete task" }, description: { vi: "Ghi rõ hành động, người phụ trách và hạn xử lý.", en: "Set a clear action, assignee, and due time." }, route: "tasks", requiredCapabilities: [CAPABILITIES.TASKS_READ] },
    ],
  },

  {
    id: "crm.checklist.manager",
    title: { vi: "Checklist quản lý vận hành", en: "Operations manager checklist" },
    description: { vi: "Theo dõi khối lượng công việc, pipeline, doanh thu và các điểm nghẽn cần xử lý.", en: "Review workload, pipeline, revenue, and operational bottlenecks that need action." },
    requiredAnyCapabilities: [CAPABILITIES.DASHBOARD_READ, CAPABILITIES.REPORTS_READ, CAPABILITIES.TASKS_READ],
    items: [
      { id: "dashboard", title: { vi: "Rà soát Tổng quan", en: "Review the Dashboard" }, description: { vi: "Xác định hàng đợi và chỉ số cần chú ý trong ngày.", en: "Identify queues and metrics that need attention today." }, route: "dashboard", requiredCapabilities: [CAPABILITIES.DASHBOARD_READ] },
      { id: "reports", title: { vi: "Đọc báo cáo", en: "Review reports" }, description: { vi: "So sánh chỉ số và mở bản ghi nguồn trước khi quyết định.", en: "Compare metrics and open source records before deciding." }, route: "reports", requiredCapabilities: [CAPABILITIES.REPORTS_READ] },
      { id: "work", title: { vi: "Kiểm tra công việc quá hạn", en: "Review overdue work" }, description: { vi: "Ưu tiên công việc cần điều phối hoặc gỡ vướng.", en: "Prioritize work that needs coordination or escalation." }, route: "my-work", requiredCapabilities: [CAPABILITIES.TASKS_READ] },
      { id: "pipeline", title: { vi: "Rà soát pipeline bán hàng", en: "Review the sales pipeline" }, description: { vi: "Kiểm tra giai đoạn, bước tiếp theo và cơ hội không tiến triển.", en: "Review stages, next steps, and stalled opportunities." }, route: "deals", requiredCapabilities: [CAPABILITIES.DEALS_READ] },
    ],
  },
];
