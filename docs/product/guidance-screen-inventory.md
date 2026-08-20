# Guidance screen inventory

> **Generated from the active route and guidance registries on 2026-07-24.**
> This catalog records the user-facing screens covered by contextual walkthroughs. Access and system screens use inline bilingual instructions because the Guidance Center is not mounted there.

## Coverage summary

| Area | Route entries | Unique guided screens | Detailed VI/EN walkthroughs |
|---|---:|---:|---:|
| CRM | 53 | 51 | 51 |
| Studio | 11 | 11 | 11 |
| People & Access | 3 | 3 | 3 |
| **Total** | **67** | **65** | **65** |

Two compatibility route aliases reuse canonical guides, so 67 contextual route entries map to 65 unique guided screens. Each screen includes purpose, audience, prerequisites, every primary task, completion checks, guardrails, product-space context, and a persistent help entry in Vietnamese and English.

## CRM — 51 screens

| # | Route | Guidance ID | Tiếng Việt | English | Primary tasks | Walkthrough steps |
|---:|---|---|---|---|---:|---:|
| 1 | `/dashboard` | `crm.dashboard.overview` | Tổng quan CRM | CRM overview | 3 | 13 |
| 2 | `/leads` | `crm.leads.list` | Khách hàng tiềm năng | Leads | 3 | 12 |
| 3 | `/deals` | `crm.deals.pipeline` | Cơ hội bán hàng | Sales opportunities | 3 | 13 |
| 4 | `/quotes` | `crm.quotes.list` | Báo giá | Quotes | 4 | 10 |
| 5 | `/orders` | `crm.orders.list` | Đơn hàng | Orders | 3 | 12 |
| 6 | `/orders/new` | `crm.orders.create` | Tạo đơn hàng | Create order | 4 | 14 |
| 7 | `/payments` | `crm.payments.list` | Thanh toán | Payments | 5 | 14 |
| 8 | `/shipping` | `crm.shipping.list` | Vận đơn | Shipping bookings | 3 | 9 |
| 9 | `/returns` | `crm.returns.list` | Đổi / Trả hàng | Returns | 4 | 10 |
| 10 | `/support/cases` | `crm.support.list` | Phiếu hỗ trợ | Support tickets | 3 | 9 |
| 11 | `/reports` | `crm.reports.overview` | Báo cáo | Reports | 6 | 18 |
| 12 | `/my-work` | `crm.my-work.overview` | Công việc của tôi | My work | 3 | 9 |
| 13 | `/calendar` | `crm.calendar.overview` | Lịch công việc | Work calendar | 3 | 9 |
| 14 | `/notifications` | `crm.notifications.center` | Thông báo | Notifications | 3 | 9 |
| 15 | `/tasks` | `crm.tasks.list` | Công việc | Tasks | 3 | 9 |
| 16 | `/tasks/:taskId` | `crm.tasks.detail` | Chi tiết công việc | Task detail | 3 | 9 |
| 17 | `/leads/queue` | `crm.leads.queue` | Hàng đợi khách hàng tiềm năng | Lead queue | 3 | 9 |
| 18 | `/leads/:leadId` | `crm.leads.detail` | Chi tiết khách hàng tiềm năng | Lead detail | 3 | 9 |
| 19 | `/leads/:leadId/qualify` | `crm.leads.qualify` | Xác minh khách hàng tiềm năng | Qualify lead | 3 | 9 |
| 20 | `/leads/:leadId/sell-now` | `crm.leads.sell-now` | Bán trực tiếp từ khách hàng tiềm năng | Sell now from lead | 3 | 9 |
| 21 | `/products` | `crm.products.list` | Sản phẩm | Products | 3 | 9 |
| 22 | `/products/:productId` | `crm.products.detail` | Chi tiết sản phẩm | Product detail | 3 | 9 |
| 23 | `/deals/:dealId` | `crm.deals.detail` | Chi tiết cơ hội | Opportunity detail | 3 | 10 |
| 24 | `/quotes/new` | `crm.quotes.create` | Tạo báo giá | Create quote | 4 | 11 |
| 25 | `/quotes/:quoteId` | `crm.quotes.detail` | Chi tiết báo giá | Quote detail | 4 | 10 |
| 26 | `/quotes/:quoteId/edit` | `crm.quotes.edit` | Chỉnh sửa báo giá | Edit quote | 4 | 10 |
| 27 | `/orders/:orderId` | `crm.orders.detail` | Chi tiết đơn hàng | Order detail | 3 | 9 |
| 28 | `/orders/:orderId/edit` | `crm.orders.edit` | Chỉnh sửa đơn hàng | Edit order | 3 | 9 |
| 29 | `/payments/:paymentId` | `crm.payments.detail` | Chi tiết thanh toán | Payment detail | 3 | 9 |
| 30 | `/invoices` | `crm.invoices.list` | Hóa đơn | Invoices | 3 | 9 |
| 31 | `/invoices/new` | `crm.invoices.create` | Tạo hóa đơn nháp | Create invoice draft | 3 | 9 |
| 32 | `/invoices/:invoiceId` | `crm.invoices.detail` | Chi tiết hóa đơn | Invoice detail | 3 | 9 |
| 33 | `/invoices/:invoiceId/edit` | `crm.invoices.edit` | Chỉnh sửa hóa đơn nháp | Edit invoice draft | 3 | 9 |
| 34 | `/receivables` | `crm.receivables.list` | Công nợ phải thu | Receivables | 3 | 9 |
| 35 | `/receivables/:invoiceId` | `crm.receivables.detail` | Chi tiết công nợ | Receivable detail | 3 | 9 |
| 36 | `/receivables/accounts/:buyerId` | `crm.receivables.statement` | Sao kê công nợ | Account statement | 3 | 9 |
| 37 | `/shipping/new` | `crm.shipping.create` | Tạo vận đơn | Create shipping booking | 3 | 9 |
| 38 | `/shipping/:shippingBookingId` | `crm.shipping.detail` | Chi tiết vận đơn | Shipping detail | 3 | 9 |
| 39 | `/returns/new` | `crm.returns.create` | Tạo yêu cầu đổi / trả | Create return request | 4 | 10 |
| 40 | `/returns/:returnId` | `crm.returns.detail` | Chi tiết đổi / trả | Return detail | 3 | 9 |
| 41 | `/contacts` | `crm.contacts.list` | Liên hệ | Contacts | 3 | 10 |
| 42 | `/contacts/:contactId` | `crm.contacts.detail` | Chi tiết liên hệ | Contact detail | 3 | 9 |
| 43 | `/organizations` | `crm.organizations.list` | Tổ chức | Organizations | 3 | 9 |
| 44 | `/organizations/:organizationId` | `crm.organizations.detail` | Chi tiết tổ chức | Organization detail | 5 | 11 |
| 45 | `/customers` | `crm.customers.list` | Khách hàng | Customers | 3 | 9 |
| 46 | `/customers/:customerId` | `crm.customers.detail` | Hồ sơ khách hàng | Customer profile | 4 | 11 |
| 47 | `/customers/segments` | `crm.customers.segments` | Phân khúc khách hàng | Customer segments | 3 | 9 |
| 48 | `/customers/health` | `crm.customers.health` | Sức khỏe khách hàng | Customer health | 3 | 9 |
| 49 | `/support/cases/new` | `crm.support.create` | Tạo phiếu hỗ trợ | Create support ticket | 3 | 9 |
| 50 | `/support/cases/:caseId` | `crm.support.detail` | Chi tiết phiếu hỗ trợ | Support ticket detail | 3 | 9 |
| 51 | `/support/cases/:caseId/edit` | `crm.support.edit` | Chỉnh sửa phiếu hỗ trợ | Edit support ticket | 3 | 9 |

## Studio — 11 screens

| # | Route | Guidance ID | Tiếng Việt | English | Primary tasks | Walkthrough steps |
|---:|---|---|---|---|---:|---:|
| 1 | `/settings/quick-setup` | `studio.quick-setup` | Thiết lập nhanh | Quick Setup | 2 | 8 |
| 2 | `/settings/business-information` | `studio.business-information` | Thông tin doanh nghiệp | Business information | 2 | 8 |
| 3 | `/settings/locale-region` | `studio.locale-region` | Ngôn ngữ & khu vực | Language & region | 2 | 8 |
| 4 | `/settings/feature-usage` | `studio.feature-usage` | Tính năng sử dụng | Feature usage | 2 | 8 |
| 5 | `/settings/pipelines-statuses` | `studio.pipelines-statuses` | Pipeline & trạng thái | Pipelines & statuses | 2 | 8 |
| 6 | `/settings/product-types` | `studio.product-types` | Loại sản phẩm | Product types | 2 | 8 |
| 7 | `/settings/information-fields` | `studio.information-fields` | Trường thông tin | Information fields | 2 | 8 |
| 8 | `/settings/payment-information` | `studio.payment-information` | Thông tin thanh toán | Payment information | 2 | 8 |
| 9 | `/settings/invoice-information` | `studio.invoice-information` | Thông tin hóa đơn | Invoice information | 2 | 8 |
| 10 | `/settings/integrations` | `studio.integrations` | Tích hợp | Integrations | 2 | 8 |
| 11 | `/settings/webhooks-api` | `studio.webhooks-api` | Webhook & API | Webhooks & API | 2 | 8 |

## People & Access — 3 screens

| # | Route | Guidance ID | Tiếng Việt | English | Primary tasks | Walkthrough steps |
|---:|---|---|---|---|---:|---:|
| 1 | `/settings/users-permissions` | `people.members.access` | Người dùng & quyền truy cập | People & Access | 3 | 11 |
| 2 | `/settings/roles-permissions` | `people.roles.access` | Vai trò & chính sách truy cập | Roles & access policies | 3 | 9 |
| 3 | `/settings/audit-logs` | `people.audit.access` | Nhật ký hoạt động | Activity log | 3 | 9 |

## Access and system screens — 11 screens

These screens provide inline bilingual instructions rather than contextual walkthroughs: Login, MFA verification, Forgot password, Register, Verify email, Reset password, Invitation acceptance, Workspace selection, Session expired, Access denied, and Account suspended.

## Maintenance

The guidance contract compares this inventory with `ROUTE_METADATA`, `SCREEN_GUIDANCE`, and the active Studio/People registries. Add, rename, or retire a row only in the same change that updates the owning route and guidance entry.
