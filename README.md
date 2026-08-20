Unicore CRM Web

Workspace frontend và các hợp đồng OpenAPI trung lập về công nghệ cho Unicore CRM. Ứng dụng là một ứng dụng trang đơn (SPA) sử dụng React 19 + TypeScript, với ba không gian sản phẩm được giới hạn theo workspace:

CRM dành cho công việc hằng ngày về quan hệ khách hàng, bán hàng, vận hành đơn hàng, hỗ trợ và tác vụ;

Studio dùng để điều phối cấu hình thuộc quyền sở hữu của các boundary Workspace, CRM, Products, Finance, Integrations và Platform Developer;

People & Access dành cho thành viên, vai trò, quyền hạn và các giao diện kiểm tra/audit.

Repository được tổ chức xoay quanh quyền sở hữu module rõ ràng, workflow liên module, read model theo workspace và quyền truy cập shell dựa trên capability. Các nhật ký bàn giao lịch sử chủ ý không nằm trong source package; hành vi hiện tại được tài liệu hóa theo trách nhiệm trong ARCHITECTURE.md và docs/.

Studio hiện cung cấp một route Quick Setup tùy chọn, luôn có thể mở lại, cùng với mười màn hình thiết lập chi tiết. Quick Setup chỉ lưu metadata về tiến độ; mọi câu trả lời được ghi trực tiếp vào repository cấu hình của owner tương ứng. Studio snapshot/gateway tổng hợp trước đây và storage key của nó đã được loại bỏ. Phạm vi canonical và các quy tắc authority được định nghĩa trong docs/product/studio-rebuild-roadmap.md.

Định danh contract candidate

Archive này tự định danh là unicorecrm-web@0.23.20-contract.0. Nó bao gồm frontend React, OpenAPI 3.1 contract candidate, các TypeScript client được sinh theo cách xác định (deterministic), hệ thống tự động hóa kiểm tra chất lượng GitHub Actions có thứ tự và bộ công cụ tạo bằng chứng source-release theo cách xác định. Archive này chủ ý không chứa implementation backend production có thể chạy được. Connected HTTP host vẫn chỉ dùng cho test; kết quả từ fixture cục bộ không phải là bằng chứng cho backend hoặc database production. Production target đã chọn là ASP.NET Core Modular Monolith + Clean Architecture + CQRS/MediatR + FluentValidation + SQL Server. Xem docs/quality/release-identity.md, .NET/SQL Server target, ADRs và compatibility ledger.

Yêu cầu

Node.js tương thích với lockfile và toolchain Vite 6;

npm;

trình duyệt hiện đại.

Cài đặt và chạy

npm ci
npm run dev

Development server chạy trên cổng 3000 và lắng nghe tại 0.0.0.0.

Chế độ runtime

Môi trường phát triển cục bộ mặc định sử dụng demo runtime chạy trên trình duyệt. Production mặc định sử dụng connected mode và sẽ fail closed nếu thiếu binding cho API và identity. Sao chép .env.example và cấu hình VITE_RUNTIME_MODE, VITE_API_BASE_URL, command path/timeout khi cần, cùng với một production runtime integration có nhiệm vụ cài đặt window.**UNICORECRM_CONNECTED_RUNTIME**.getAccessToken và getWorkspaceId trước khi application bundle được thực thi. Connected mode tự compose các HTTP application service; host không inject ApplicationServiceBundle.

Connected composition chỉ tạo generated client và adapter chuyên biệt cho các operation đã được khai báo trong OpenAPI, đồng thời fail closed khi thiếu HTTP/identity binding. Các browser repository chỉ giữ vai trò demo authority được khai báo rõ ràng. Mức độ bao phủ và các blocker theo từng operation được định nghĩa trong docs/api/operation-coverage-ledger.json và tóm tắt tại docs/architecture/backend-readiness.md. Bằng chứng connected acceptance cùng các giới hạn của nó được định nghĩa trong docs/quality/connected-backend-acceptance.md.

Ranh giới backend

Frontend trung lập với công nghệ backend. Nó giao tiếp thông qua docs/api/openapi.json, các generated TypeScript client và các quy ước dùng chung về authentication/workspace/error/idempotency/concurrency. Implementation backend thuộc về solution .NET riêng biệt và không được sao chép từ browser repository hoặc demo adapter.

Các generated client bao phủ toàn bộ 270 operation đã khai báo: 236 operation sẵn sàng cho production và 34 operation được chủ ý chặn. Operation coverage ledger và breaking baseline đã được review được sinh cùng với client. Xem docs/api/operation-coverage-ledger.json, docs/architecture/backend-readiness.md và docs/architecture/dotnet-sqlserver-backend-target.md.

Tạo production bundle bằng:

npm run build

Preview bundle đã sinh bằng:

npm run preview

Các lệnh kiểm tra chất lượng chính

Các lệnh sau tồn tại trong package.json hiện tại và là các entry point được hỗ trợ cho việc xác minh thường xuyên:

npm run lint
npm run quality:gate -- --gate quality.repository-naming
npm run quality:gate -- --gate quality.architecture
npm run api:check
npm run quality:gate -- --gate quality.frontend-backend-separation
npm run quality:gate -- --gate quality.connected-backend-integration
npm run verify
npm run build

Một số kiểm tra tập trung hữu ích gồm:

npm run quality:gate -- --gate quality.route-module-loads
npm run quality:gate -- --gate quality.form-runtime-sizing
npm run quality:gate -- --gate quality.shipping-create-page-contracts
npm run quality:gate -- --gate quality.sidebar-navigation-migration
npm run quality:gate -- --gate quality.workspace-navigation-language
npm run quality:gate -- --gate quality.organization-b2b-ui

package.json là bề mặt lệnh công khai, trong khi scripts/quality/quality-pipeline.json là authority thực thi cho các quality gate. Tài liệu phải tham chiếu đến một lệnh công khai đang tồn tại và, đối với việc chạy tập trung, phải dùng một gate ID hoặc group ID ổn định và hợp lệ. Repository naming gate cũng từ chối thuật ngữ liên quan đến lịch sử bàn giao, các root worklog không được hỗ trợ và các lệnh được tài liệu hóa nhưng bị lỗi.

Không gian sản phẩm và route hiện tại

Các route canonical của ứng dụng được giới hạn theo workspace:

/w/{workspaceKey}/crm/...
/w/{workspaceKey}/studio/...
/w/{workspaceKey}/people/...

Các path legacy được redirect vào một workspace và product space canonical. CRM không được mount thành một global route tree không có scope.

Các CRM module đang được đăng ký và hoạt động gồm:

commercial-evidence
contacts
customers
deals
invoices
leads
orders
organizations
payments
products
quotes
returns
shipping
support
tasks

customers là một CRM business module đã đăng ký. Module này sở hữu vòng đời Customer, trạng thái health, segmentation và care, trong khi Contact và Organization vẫn là các canonical identity owner. Customer 360 là bề mặt read-side composition của module và không được sao chép ownership từ các downstream module.

Điều hướng CRM

CRM shell nhóm các bề mặt công việc hiện tại theo trách nhiệm:

Work
Dashboard
My Work
Work Calendar
Notifications

Customers
Leads
Contacts
Organizations
Customers

Sales
Deals
Quotes
Orders

Products
Products

Order Operations
Payments
Invoices
Receivables
Shipping
Returns / Exchanges

Service
Support Cases
Tasks

Khả năng hiển thị được suy ra từ workspace hiện tại, cấu hình module của workspace và các capability có hiệu lực. Navigation không được phép bỏ qua authorization.

Bản đồ tài liệu

Bắt đầu với:

ARCHITECTURE.md — hiến chương kiến trúc và các quy tắc dependency;

docs/architecture/module-ownership-and-workflows.md — các business owner hiện tại và cơ chế điều phối liên module;

docs/architecture/routing-shell-and-access-control.md — routing canonical, shell, workspace context và authorization;

docs/architecture/compatibility-and-migration.md — ranh giới compatibility và code chỉ dành cho migration;

docs/business/customer-relationship-and-commercial-flow.md — relationship identity và luồng từ lead đến order;

docs/business/shipping-and-returns.md — các quy tắc ownership cho shipping và return;

docs/quality/form-and-presentation-contracts.md — presentation contract cho list/detail/form;

docs/quality/verification.md — quality gate, kỳ vọng baseline và các giới hạn đã biết.

Quy tắc repository

Một business write thuộc về module sở hữu nó.

Các operation liên module nằm trong src/workflows/ và sử dụng public API của module.

Workspace read model compose các public API của module; chúng không trở thành business owner.

src/platform/ phải luôn độc lập với nghiệp vụ.

Migration code không được trở thành runtime dependency.

Module Customers sở hữu trạng thái vòng đời Customer; Customer 360 vẫn là read-side composition và định tuyến các thao tác ghi đến module sở hữu tương ứng hoặc workflow.

Việc load route, permissions, kích thước form và các business invariant quan trọng được enforce bằng kiểm tra tự động.

Xem ARCHITECTURE.md để biết đầy đủ contract.
