# Guidance screen inventory

> Generated from active route and guidance registries by scripts/generate-guidance-inventory.mts.

The repository defines **80 total route definitions**, **12 access/system routes**, **68 canonical route entries**, and **66 guided screens**. The inventory contains **51 CRM screens**, **12 Studio screens**, and **3 People & Access screens**, with **2 compatibility route aliases**. Access/system routes use inline guidance outside the authenticated shell.

| Area | Route entries | Unique guided screens | Detailed VI/EN walkthroughs |
|---|---:|---:|---:|
| CRM | 53 | 51 | 51 |
| Studio | 12 | 12 | 12 |
| People & Access | 3 | 3 | 3 |
| **Total** | **68** | **66** | **66** |

## CRM — 51 screens

| Route | Guidance ID | Tiếng Việt | English | Primary tasks | Walkthrough steps |
|---|---|---|---|---:|---:|
| `/dashboard` | `crm.dashboard.overview` | Tổng quan CRM | CRM overview | 3 | 13 |
| `/leads` | `crm.leads.list` | Khách hàng tiềm năng | Leads | 3 | 14 |
| `/deals` | `crm.deals.pipeline` | Cơ hội bán hàng | Sales opportunities | 3 | 13 |
| `/quotes` | `crm.quotes.list` | Báo giá | Quotes | 4 | 10 |
| `/orders` | `crm.orders.list` | Đơn hàng | Orders | 3 | 12 |
| `/orders/new` | `crm.orders.create` | Tạo đơn hàng | Create order | 4 | 14 |
| `/payments` | `crm.payments.list` | Thanh toán | Payments | 5 | 14 |
| `/shipping` | `crm.shipping.list` | Vận đơn | Shipping bookings | 3 | 9 |
| `/returns` | `crm.returns.list` | Đổi / Trả hàng | Returns | 4 | 10 |
| `/support/cases` | `crm.support.list` | Phiếu hỗ trợ | Support tickets | 3 | 9 |
| `/reports` | `crm.reports.overview` | Báo cáo | Reports | 6 | 18 |
| `/my-work` | `crm.my-work.overview` | Công việc của tôi | My work | 3 | 9 |
| `/calendar` | `crm.calendar.overview` | Lịch công việc | Work calendar | 3 | 9 |
| `/notifications` | `crm.notifications.center` | Thông báo | Notifications | 3 | 9 |
| `/tasks` | `crm.tasks.list` | Công việc | Tasks | 3 | 9 |
| `/tasks/:taskId` | `crm.tasks.detail` | Chi tiết công việc | Task detail | 3 | 9 |
| `/leads/queue` | `crm.leads.queue` | Hàng đợi khách hàng tiềm năng | Lead queue | 3 | 9 |
| `/leads/:leadId` | `crm.leads.detail` | Chi tiết khách hàng tiềm năng | Lead detail | 5 | 12 |
| `/leads/:leadId/qualify` | `crm.leads.qualify` | Xác minh khách hàng tiềm năng | Qualify lead | 3 | 9 |
| `/leads/:leadId/sell-now` | `crm.leads.sell-now` | Bán trực tiếp từ khách hàng tiềm năng | Sell now from lead | 3 | 9 |
| `/products` | `crm.products.list` | Sản phẩm | Products | 3 | 9 |
| `/products/:productId` | `crm.products.detail` | Chi tiết sản phẩm | Product detail | 3 | 9 |
| `/deals/:dealId` | `crm.deals.detail` | Chi tiết cơ hội | Opportunity detail | 3 | 10 |
| `/quotes/new` | `crm.quotes.create` | Tạo báo giá | Create quote | 4 | 11 |
| `/quotes/:quoteId` | `crm.quotes.detail` | Chi tiết báo giá | Quote detail | 4 | 10 |
| `/quotes/:quoteId/edit` | `crm.quotes.edit` | Chỉnh sửa báo giá | Edit quote | 4 | 10 |
| `/orders/:orderId` | `crm.orders.detail` | Chi tiết đơn hàng | Order detail | 3 | 9 |
| `/orders/:orderId/edit` | `crm.orders.edit` | Chỉnh sửa đơn hàng | Edit order | 3 | 9 |
| `/payments/:paymentId` | `crm.payments.detail` | Chi tiết thanh toán | Payment detail | 3 | 9 |
| `/invoices` | `crm.invoices.list` | Hóa đơn | Invoices | 3 | 9 |
| `/invoices/new` | `crm.invoices.create` | Tạo hóa đơn nháp | Create invoice draft | 3 | 9 |
| `/invoices/:invoiceId` | `crm.invoices.detail` | Chi tiết hóa đơn | Invoice detail | 3 | 9 |
| `/invoices/:invoiceId/edit` | `crm.invoices.edit` | Chỉnh sửa hóa đơn nháp | Edit invoice draft | 3 | 9 |
| `/receivables` | `crm.receivables.list` | Công nợ phải thu | Receivables | 3 | 9 |
| `/receivables/:invoiceId` | `crm.receivables.detail` | Chi tiết công nợ | Receivable detail | 3 | 9 |
| `/receivables/accounts/:buyerId` | `crm.receivables.statement` | Sao kê công nợ | Account statement | 3 | 9 |
| `/shipping/new` | `crm.shipping.create` | Tạo vận đơn | Create shipping booking | 3 | 9 |
| `/shipping/:shippingBookingId` | `crm.shipping.detail` | Chi tiết vận đơn | Shipping detail | 3 | 9 |
| `/returns/new` | `crm.returns.create` | Tạo yêu cầu đổi / trả | Create return request | 4 | 10 |
| `/returns/:returnId` | `crm.returns.detail` | Chi tiết đổi / trả | Return detail | 3 | 9 |
| `/contacts` | `crm.contacts.list` | Liên hệ | Contacts | 3 | 10 |
| `/contacts/:contactId` | `crm.contacts.detail` | Chi tiết liên hệ | Contact detail | 3 | 9 |
| `/organizations` | `crm.organizations.list` | Tổ chức | Organizations | 3 | 9 |
| `/organizations/:organizationId` | `crm.organizations.detail` | Chi tiết tổ chức | Organization detail | 5 | 11 |
| `/customers` | `crm.customers.list` | Khách hàng | Customers | 3 | 9 |
| `/customers/:customerId` | `crm.customers.detail` | Hồ sơ khách hàng | Customer profile | 4 | 11 |
| `/customers/segments` | `crm.customers.segments` | Phân khúc khách hàng | Customer segments | 3 | 9 |
| `/customers/health` | `crm.customers.health` | Sức khỏe khách hàng | Customer health | 3 | 9 |
| `/support/cases/new` | `crm.support.create` | Tạo phiếu hỗ trợ | Create support ticket | 3 | 9 |
| `/support/cases/:caseId` | `crm.support.detail` | Chi tiết phiếu hỗ trợ | Support ticket detail | 3 | 9 |
| `/support/cases/:caseId/edit` | `crm.support.edit` | Chỉnh sửa phiếu hỗ trợ | Edit support ticket | 3 | 9 |

## Studio — 12 screens

| Route | Guidance ID | Tiếng Việt | English | Primary tasks | Walkthrough steps |
|---|---|---|---|---:|---:|
| `/settings/quick-setup` | `studio.quick-setup` | Thiết lập nhanh | Quick Setup | 2 | 8 |
| `/settings/business-information` | `studio.business-information` | Thông tin doanh nghiệp | Business information | 2 | 8 |
| `/settings/locale-region` | `studio.locale-region` | Ngôn ngữ & khu vực | Language & region | 2 | 8 |
| `/settings/feature-usage` | `studio.feature-usage` | Tính năng sử dụng | Feature usage | 2 | 8 |
| `/settings/pipelines-statuses` | `studio.pipelines-statuses` | Pipeline & trạng thái | Pipelines & statuses | 2 | 8 |
| `/settings/product-types` | `studio.product-types` | Loại sản phẩm | Product types | 2 | 8 |
| `/settings/information-fields` | `studio.information-fields` | Trường thông tin | Information fields | 2 | 8 |
| `/settings/payment-information` | `studio.payment-information` | Thông tin thanh toán | Payment information | 2 | 8 |
| `/settings/invoice-information` | `studio.invoice-information` | Thông tin hóa đơn | Invoice information | 2 | 8 |
| `/settings/integrations` | `studio.integrations` | Tích hợp | Integrations | 2 | 8 |
| `/settings/webhooks-api` | `studio.webhooks-api` | Webhook & API | Webhooks & API | 2 | 8 |
| `/settings/ai` | `studio.ai` | Trợ lý AI | AI Assistant | 2 | 8 |

## People & Access — 3 screens

| Route | Guidance ID | Tiếng Việt | English | Primary tasks | Walkthrough steps |
|---|---|---|---|---:|---:|
| `/settings/users-permissions` | `people.members.access` | Người dùng & quyền truy cập | People & Access | 3 | 11 |
| `/settings/roles-permissions` | `people.roles.access` | Vai trò & chính sách truy cập | Roles & access policies | 3 | 9 |
| `/settings/audit-logs` | `people.audit.access` | Nhật ký hoạt động | Activity log | 3 | 9 |
