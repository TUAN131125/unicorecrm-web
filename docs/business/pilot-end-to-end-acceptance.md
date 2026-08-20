# Pilot end-to-end acceptance

## Mục đích

Hợp đồng này xác định cách Unicore CRM thu thập và đánh giá bằng chứng pilot xuyên suốt. Nó không thay thế nghiệm thu trên trình duyệt, xác nhận của người dùng nghiệp vụ, connector nhà cung cấp thật hoặc kiểm soát backend production.

Mục tiêu là bảo đảm một chuỗi dữ liệu duy nhất có thể đi từ tiếp nhận Lead đến hỗ trợ hậu mãi mà không mất lịch sử, sai owner, sai quan hệ khách hàng, sai tổng tiền hoặc vượt quyền.

## Thành phần pilot tối thiểu

- 2–4 Nhân viên Sales.
- 1 Sales Manager.
- 1 nhân sự tài chính/công nợ.
- 1 nhân sự vận hành giao hàng/đổi trả.
- 1 Workspace Owner hoặc Workspace Administrator.
- 1 đại diện Product/Engineering phụ trách quan sát, đối soát và ghi vấn đề.

Không dùng một tài khoản quản trị để thay thế toàn bộ vai trò. Mỗi bước phải được thực hiện hoặc xác nhận bởi vai trò chịu trách nhiệm thực tế.

## Chuỗi nghiệm thu mười bước

1. Tiếp nhận Lead bằng nhập tay, import và webhook; xác nhận chống trùng và idempotency.
2. Giao đúng owner; kiểm tra phạm vi Của tôi/Của đội, audit và SLA phản hồi đầu tiên.
3. Chuyển đổi sang Contact/Organization; giữ lịch sử Lead và canonical relationship.
4. Tạo Deal; cập nhật stage, next step, ngày đóng và forecast evidence.
5. Tạo Quote; kiểm tra dòng hàng, chiết khấu, tổng tiền và phê duyệt.
6. Chuyển Quote thành Order; giữ nguồn Deal/Quote và quan hệ khách hàng.
7. Tạo lịch thanh toán, ghi nhận giao dịch và đối soát.
8. Tạo vận đơn; kiểm tra booking, attempt history và delivered evidence.
9. Tiếp nhận đổi/trả; xác nhận nhận hàng và bằng chứng refund hoặc replacement delivery.
10. Tạo Support/Task; đối soát Customer 360, Dashboard, Reports, audit, role/scope, Guidance.

Định nghĩa máy đọc được nằm tại `src/workspaces/people-access/pilot-acceptance/domain/pilotAcceptanceCatalog.ts`.

## Hai lớp bằng chứng

### Bằng chứng tự động

Evaluator đọc dữ liệu hiện tại của workspace và kiểm tra:

- Quan hệ Lead → Contact/Organization → Deal → Quote → Order.
- Payment plan, giao dịch và reconciliation.
- Shipping booking, attempts và delivered evidence.
- Return receipt và resolution evidence.
- Support, Task và SLA.
- Ownership audit.
- Relationship integrity.
- Dashboard–Reports reconciliation delta.
- Role/data scope, Guidance coverage và audit ledger.
- Connector evidence, idempotency, retry và reconciliation.

Bằng chứng tự động chỉ mô tả trạng thái source/runtime hiện tại. Nó không chứng minh khả năng sử dụng thực tế trên trình duyệt.

### Bằng chứng thủ công

Mỗi bước yêu cầu người tham gia pilot ghi:

- Vai trò xác nhận.
- Tài khoản hoặc thiết bị được dùng.
- Bản ghi đã thao tác.
- Kết quả quan sát.
- Trạng thái PASS hoặc FAIL.
- Ghi chú đủ để tái hiện vấn đề.

Không tự động chuyển bước sang PASS chỉ vì dữ liệu source hợp lệ.

## Trạng thái đánh giá

Evaluator chỉ trả về:

- `READY_FOR_BROWSER_PILOT`: kiểm tra tự động không có lỗi hoặc blocker; vẫn cần bằng chứng trình duyệt.
- `NEEDS_ACTION`: có kiểm tra thất bại hoặc bằng chứng thủ công chưa đạt.
- `BLOCKED`: còn điều kiện bắt buộc không thể thỏa mãn, đặc biệt connector nhà cung cấp thật.

Không có trạng thái `ACCEPTED` tự động. Quyết định nghiệm thu là một quyết định sản phẩm và vận hành, dựa trên cả bằng chứng tự động, người dùng pilot và kiểm soát production.

## Điều kiện connector thật

Development webhook hoặc adapter mô phỏng không được tính là integration thật. Bằng chứng chấp nhận phải gồm:

- Nhà cung cấp bên ngoài thực tế.
- Authentication được xác minh.
- Idempotency/replay protection.
- Retry history hoặc provider error log.
- Reconciliation.
- Last successful sync hoặc delivery evidence.

Thiếu điều kiện này làm pilot bị `BLOCKED`, không được đổi thành PASS bằng ghi chú thủ công.

## Chỉ số pilot

Hệ thống theo dõi chín hợp đồng đo lường:

1. Thời gian tạo Lead.
2. Thời gian tạo Deal.
3. Tỷ lệ bỏ dở form.
4. Tỷ lệ thiếu owner hoặc next step.
5. Tỷ lệ đáp ứng SLA Lead.
6. Số thao tác phải thực hiện ngoài CRM.
7. Sai lệch Dashboard–Reports–dữ liệu gốc.
8. Chất lượng Order/Payment/Shipping/Return.
9. Số thay đổi cấu hình workspace thất bại hoặc phải rollback sau khi backend configuration được triển khai.

Một metric không có observation phải hiển thị là chưa có bằng chứng, không được ngầm coi là 0 hoặc PASS. Trung tâm nghiệm thu cho phép nhập giá trị, ghi chú nguồn đo và lưu audit `PILOT_METRIC_RECORDED` theo workspace.

## Lưu trữ và xuất bằng chứng

Bằng chứng frontend được lưu theo workspace bằng khóa versioned:

```text
unicore_pilot_acceptance_v1:{workspaceId}
```

Dữ liệu gồm manual evidence, metric observations và lần đánh giá gần nhất. Trang Kiểm toán & khả năng phục hồi cho phép xuất JSON để review. Local storage không phải audit sink bất biến; production phải lưu hồ sơ pilot ở backend có quyền, retention và audit phù hợp.

## Ranh giới quyền

- Chỉ người có quyền truy cập khu vực People & Access/Audit mới được xem trung tâm nghiệm thu.
- Việc hiển thị panel không cấp thêm quyền với Lead, Deal, Quote, Order hoặc các domain khác.
- Mỗi bước vẫn phải vượt qua route guard, capability và data scope tương ứng.
- Bằng chứng thủ công không thể ghi đè một kiểm tra authorization hoặc tenant-isolation thất bại.

## Quality gates

- `npm run quality:gate -- --gate quality.pilot-journey-fixture`
- `npm run quality:gate -- --gate quality.pilot-end-to-end`
- `npm run quality:gate -- --gate quality.pilot-acceptance-boundary`
- `npm run quality:gate -- --gate quality.guidance-contracts`
- `npm run quality:gate -- --gate quality.guidance-runtime`

Các gate bảo vệ số bước, vai trò, metric, điều kiện provider thật, manual evidence, workspace-scoped storage, audit events và selector Guidance.

## Điều kiện chuyển chương trình sang nghiệm thu pilot

Trước khi tuyên bố pilot đạt cần có đủ:

- Mười bước có bằng chứng tự động và thủ công PASS.
- Không còn orphan hoặc cross-workspace reference.
- Owner, audit và data scope đúng.
- Dashboard, Reports và dữ liệu nguồn khớp.
- Sales hoàn thành luồng chính mà không cần Excel hoặc công cụ ngoài luồng.
- Màn hình cấu hình backend trong tương lai phải bảo vệ thay đổi chưa lưu.
- Một connector nhà cung cấp thật có retry và reconciliation evidence.
- Support/SLA và Guidance được xác nhận trên trình duyệt.
- Các lỗi phát hiện trong pilot có owner, mức độ và quyết định xử lý rõ ràng.

## Giới hạn production

Source hiện tại cung cấp evaluator, fixture, UI và contract kiểm thử. Nó không chứng minh:

- Browser E2E trên nhiều thiết bị và tài khoản thật.
- API/database authorization hoặc tenant isolation production.
- Immutable audit server.
- Connector provider thật.
- Backup/restore production.
- Hiệu năng, tải đồng thời hoặc RPO/RTO.

Các bằng chứng này phải được bổ sung ngoài source package trước khi chuyển trạng thái chương trình sang `ACCEPTED`.
