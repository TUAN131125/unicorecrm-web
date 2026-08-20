# Đặc tả xây dựng frontend cho cụm Order-to-Cash

> **Document status:** TARGET FRONTEND CONTRACT — supporting guidance, not the canonical backend API contract.
> **Current implementation note:** Connected HTTP boundaries now cover Quote, Order, Payments, Invoices, Receivables, Shipping and Returns through generated clients and dedicated adapters. Operation readiness remains defined only by `docs/api/openapi.json`; a declared adapter is not proof of a deployed backend.
> Endpoint lists in this document are provisional except for operations explicitly declared in `docs/api/openapi.json`; OpenAPI wins on path and transport schema.

## 1. Mục đích và phạm vi

Tài liệu này là hợp đồng thiết kế và triển khai frontend cho cụm nghiệp vụ:

```text
Báo giá
→ Đơn hàng
→ Thỏa thuận và lịch thanh toán
→ Hóa đơn
→ Công nợ phải thu
→ Thu tiền / Thanh toán online / COD
→ Phân bổ tiền
→ Vận đơn
→ Đổi / Trả hàng
→ Credit Note / Hoàn tiền / Giao thay thế
```

Tài liệu áp dụng cho `unicorecrm-web` và chỉ mô tả phạm vi frontend. Frontend phải có domain contract, DTO, port, adapter phát triển, action policy, UI states và API boundary đủ rõ để nối backend. Frontend không được giả lập rằng trình duyệt là hệ thống kế toán, cổng thanh toán, hệ thống hóa đơn điện tử, scheduler hay nguồn dữ liệu bền vững.

Chi tiết chuyên sâu về phương thức, điều khoản và lịch thanh toán nằm tại:

```text
docs/business/payment-plans-and-collections-frontend-spec.md
```

Tài liệu đó là phần bắt buộc của đặc tả này, không phải phụ lục tùy chọn.

## 2. Baseline kiến trúc hiện tại

Source hiện đã có owner riêng cho `orders`, `payments`, `shipping` và `returns`; `invoices` đã là module chính thức. OpenAPI dùng Money dạng decimal string, có Payment Plan/Intent, COD evidence, refund recovery và các workflow transaction/saga rõ ràng. Connected mode dùng generated client và fail closed thay vì coi browser repository là production authority.

Các giới hạn còn lại phải được giữ rõ:

- chưa có backend ASP.NET Core/SQL Server bền vững hoặc provider thật;
- database precision/scale, tax semantics theo chứng từ và allocation residual policy chưa đóng hoàn toàn;
- generic Payment/Customer Credit allocation vẫn bị chặn;
- một số frontend compatibility/view model còn dùng `number` và không được vượt qua connected adapter;
- provider callback, scheduler, reconciliation, idempotency, outbox/inbox và saga durability vẫn thuộc backend.

Mô hình tiếp tục tách sáu lớp khái niệm sau:

```text
1. Payment Agreement Snapshot
   Điều khoản thương mại được chấp nhận trên Quote/Order.

2. Payment Plan
   Cấu trúc chia số tiền và lịch phải trả.

3. Payment Schedule Line
   Một nghĩa vụ theo đợt, có số tiền, trigger đến hạn và gate.

4. Invoice / Receivable
   Chứng từ phát hành tạo số dư phải thu có tính kế toán.

5. Payment Transaction / Payment Intent
   Giao dịch tiền thực tế hoặc phiên thu tiền online.

6. Payment Allocation / Customer Credit
   Phân bổ tiền vào hóa đơn hoặc giữ tiền trả trước chưa phân bổ.
```

Không được dùng một trường `paymentStatus` duy nhất để thay thế sáu lớp trên.

## 3. Quyết định kiến trúc bắt buộc

### 3.1. `orders` sở hữu cam kết thương mại

Order sở hữu:

- buyer reference;
- dòng hàng và giá đã chốt;
- recipient/shipping prerequisites;
- snapshot điều khoản thanh toán đã chấp nhận;
- Order lifecycle.

Order không sở hữu:

- giao dịch tiền thành công;
- số dư công nợ;
- trạng thái phát hành hóa đơn;
- trạng thái carrier;
- refund success;
- reconciliation.

### 3.2. `payments` sở hữu kế hoạch thu tiền và giao dịch tiền

`payments` sở hữu:

- Payment Plan;
- Payment Schedule Line;
- Payment Intent/Checkout Session;
- Payment Transaction;
- Refund Transaction;
- Payment Allocation;
- Customer Credit/Unapplied Amount;
- Reconciliation;
- COD collection/remittance evidence.

Payment Plan được tạo từ snapshot điều khoản trên Order nhưng là aggregate riêng. Không nhúng toàn bộ payment runtime vào Order record.

### 3.3. Module `invoices` là owner chính thức

`invoices` sở hữu:

- Invoice Draft;
- seller/buyer legal snapshots;
- invoice lines;
- totals authoritative;
- issue lifecycle;
- delivery state;
- Credit Note;
- quan hệ nguồn với Order, Payment Schedule Line, Shipping milestone và Return.

Invoice không sở hữu Payment Transaction. Invoice settlement là projection từ allocation và Credit Note.

### 3.4. Công nợ là read model từ chứng từ

Công nợ phải thu được tính từ:

```text
Invoice đã phát hành
- Payment Allocation có hiệu lực
- Credit Note đã phát hành
= Outstanding Receivable
```

Không tạo action “Sửa số dư công nợ”. Không sử dụng Payment Schedule Line như một hóa đơn giả. Lịch thanh toán thể hiện thỏa thuận phải trả; công nợ thể hiện số dư của chứng từ đã phát hành.

### 3.5. Tiền trả trước trước khi có hóa đơn là Customer Credit

Khi khách trả tiền trước nhưng chưa có Invoice phù hợp:

```text
Payment Transaction SUCCEEDED
→ chưa có Invoice để allocate
→ tạo Customer Credit / Unapplied Amount
→ khi Invoice được phát hành, backend cho phép allocate
```

Không được tự tạo Invoice giả để “chứa” tiền đặt cọc. Không được tự đánh dấu Order hoặc Invoice đã thanh toán chỉ vì có một giao dịch chưa phân bổ.

### 3.6. Online payment cần Payment Intent riêng

Thanh toán online không phải một `method` đơn lẻ. Nó là một kênh thực hiện có thể dùng thẻ, ví điện tử, chuyển khoản nhanh hoặc phương thức provider khác.

Luồng bắt buộc:

```text
Create Payment Intent
→ backend trả checkout URL / QR / client-safe payload
→ frontend mở provider surface
→ user redirect/callback về hệ thống
→ frontend hiển thị PENDING và query trạng thái authoritative
→ chỉ khi backend xác nhận SUCCEEDED mới tạo hiệu lực tài chính
```

Redirect thành công hoặc query parameter `success=true` không phải bằng chứng thanh toán.

## 4. Vòng đời mục tiêu

### 4.1. Order

```ts
export type OrderState =
  | "DRAFT"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED";
```

Quy tắc:

- `DRAFT`: chỉnh sửa nội dung thương mại;
- `CONFIRMED`: khóa snapshot thương mại;
- `COMPLETED`: chỉ qua closing workflow;
- `CANCELLED`: chỉ qua cancellation workflow có readiness;
- không dùng `FAILED` để mô tả lỗi payment hoặc shipping;
- không hard delete durable Order.

### 4.2. Payment Plan

```ts
export type PaymentPlanState =
  | "DRAFT"
  | "ACTIVE"
  | "SUPERSEDED"
  | "CANCELLED"
  | "COMPLETED";
```

- Plan được chỉnh khi DRAFT.
- Plan ACTIVE không được sửa âm thầm sau khi đã có Invoice, Payment Intent, Payment, Allocation hoặc COD evidence.
- Thay đổi điều khoản phải tạo version mới và supersede plan cũ.
- Plan COMPLETED là projection khi các schedule line đã được xử lý theo policy.

### 4.3. Payment Schedule Line

```ts
export type PaymentScheduleLineState =
  | "SCHEDULED"
  | "NOT_DUE"
  | "DUE"
  | "PARTIAL"
  | "SATISFIED"
  | "OVERDUE"
  | "VOIDED";
```

State do API/read model trả về. UI không tự dùng đồng hồ thiết bị để quyết định overdue.

### 4.4. Payment Intent

```ts
export type PaymentIntentState =
  | "CREATED"
  | "REQUIRES_ACTION"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";
```

### 4.5. Payment Transaction

```ts
export type PaymentTransactionState =
  | "CREATED"
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REVERSED";
```

Chỉ `SUCCEEDED` có thể tạo allocation có hiệu lực, trừ khi backend trả một settlement policy khác có code rõ ràng.

### 4.6. Invoice

```ts
export type InvoiceLifecycleState =
  | "DRAFT"
  | "ISSUING"
  | "ISSUED"
  | "ISSUE_FAILED"
  | "DISCARDED"
  | "VOIDED";
```

Invoice ISSUED bất biến về nội dung chính. Điều chỉnh dùng Credit Note hoặc replacement flow được backend hỗ trợ.

### 4.7. Settlement projection

```ts
export type SettlementState =
  | "NOT_DUE"
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CREDITED";
```

Không lưu settlement như field do component tự thay đổi.

## 5. Quan hệ giữa Quote, Order, Payment Plan và Invoice

### 5.1. Quote

Quote đề xuất:

- tổng giá trị;
- loại payment plan;
- tỷ lệ/số tiền từng đợt;
- due trigger;
- allowed payment methods;
- fulfillment gates;
- invoice timing nếu có.

Quote không tạo Payment Transaction và không phát hành Invoice.

### 5.2. Order

Khi xác nhận Order:

```text
Quote terms
→ normalize/validate
→ Payment Agreement Snapshot trên Order
→ tạo Payment Plan ACTIVE bằng workflow
```

Snapshot trên Order dùng để audit cam kết thương mại. Payment Plan là cấu trúc vận hành có version riêng.

### 5.3. Invoice

Invoice có thể được tạo:

- toàn bộ tại lúc Order confirmed;
- cho khoản đặt cọc;
- theo từng milestone;
- theo số lượng đã giao;
- sau delivery/acceptance;
- cho phần còn lại.

Payment Schedule Line và Invoice có thể liên kết nhưng không bắt buộc 1–1. Một schedule line có thể được thanh toán bởi nhiều payment; một Invoice có thể được thanh toán bởi nhiều payment; một payment có thể được phân bổ cho nhiều Invoice.

## 6. Các mô hình thanh toán phải hỗ trợ

Chi tiết validation và API nằm trong tài liệu payment chuyên sâu. Tối thiểu phải có các pattern sau:

### 6.1. Trả trước toàn bộ

```text
100% trước khi booking/dispatch
Allowed methods: bank transfer, online gateway, cash, card, e-wallet
Gate: BEFORE_BOOKING hoặc BEFORE_DISPATCH
```

Order không được qua gate nếu schedule line chưa SATISFIED theo response authoritative.

### 6.2. Đặt cọc và thanh toán phần còn lại

Ví dụ:

```text
Đợt 1: 30% khi xác nhận Order
Đợt 2: 70% trước giao hàng hoặc sau giao hàng 7 ngày
```

Khoản đặt cọc có thể được invoice ngay hoặc giữ dưới dạng customer credit theo invoice policy do backend trả về.

### 6.3. Trả khi nhận hàng

Có hai trường hợp khác nhau:

```text
A. COD qua carrier
B. Khách thanh toán sau khi nhận bằng chuyển khoản/tiền mặt/thẻ
```

Cả hai có timing `ON_DELIVERY`, nhưng method/channel/evidence khác nhau. Không được đồng nhất “trả khi nhận hàng” với COD.

### 6.4. Trả sau

Ví dụ:

```text
Net 7 / Net 15 / Net 30 sau ngày phát hành hóa đơn
N ngày sau delivery
N ngày sau acceptance
Ngày cố định
```

Order có thể được giao và hoàn tất trước khi payment settled nếu plan không đặt fulfillment gate. Công nợ tiếp tục mở và có thể quá hạn.

### 6.5. Thanh toán online

Có thể dùng:

- thẻ;
- ví điện tử;
- chuyển khoản nhanh;
- payment link;
- QR/provider checkout.

Frontend không lưu provider secret và không tự xác nhận callback. UI phải hỗ trợ pending, expired, failed, retry và duplicate intent protection.

### 6.6. Trả theo đợt hữu hạn

Ví dụ:

```text
3 đợt: 40% / 30% / 30%
6 kỳ hàng tháng
Thanh toán theo milestone nghiệm thu
```

Mỗi đợt là một Payment Schedule Line. Tổng amount/percentage phải được backend preview và xác nhận.

### 6.7. Thanh toán định kỳ mở

Thanh toán định kỳ không giới hạn hoặc subscription không được giả làm một Order payment plan hữu hạn. Nó cần Contract/Subscription/Billing Schedule owner riêng. Frontend hiện chỉ chuẩn bị interface liên kết; không tự tạo module subscription nếu chưa có đặc tả được duyệt.

### 6.8. Kết hợp nhiều phương thức

Một Order có thể:

```text
30% chuyển khoản
50% online card
20% COD
```

Mỗi schedule line có `allowedMethodCodes`; phương thức thực tế được ghi trên Payment Transaction. Không ép mọi đợt phải dùng cùng một method.

## 7. Billing và payment là hai lịch độc lập

Không giả định:

```text
1 Payment Schedule Line = 1 Invoice
```

Cần hai khái niệm:

- `Billing Plan`: khi nào và bao nhiêu được lập hóa đơn;
- `Payment Plan`: khi nào và bao nhiêu phải thanh toán.

Ví dụ:

```text
Invoice toàn bộ 100% khi giao hàng
Payment: 30% trả trước, 70% Net 15
```

Hoặc:

```text
Invoice đặt cọc 30%
Invoice phần còn lại 70% sau nghiệm thu
Payment theo từng Invoice
```

Frontend hiển thị hai timeline riêng. Không dùng cùng một badge hoặc cùng một state machine.

## 8. Mô hình dữ liệu frontend

### 8.1. Money

```ts
export interface MoneyDto {
  amount: string;
  currency: string;
}
```

- `amount` là decimal string hoặc minor-unit representation được duyệt;
- không dùng `number` làm hợp đồng authoritative;
- không cộng/trừ bằng JavaScript floating point để quyết định readiness;
- totals, allocation limits và rounding do API/adapter trả về.

### 8.2. Payment Agreement Snapshot

```ts
export interface PaymentAgreementSnapshotDto {
  sourceQuoteId?: string;
  planKind: "FULL" | "DEPOSIT_BALANCE" | "INSTALLMENT" | "MILESTONE" | "CUSTOM";
  billingPolicyCode?: string;
  scheduleSummary: PaymentAgreementLineSnapshotDto[];
  acceptedAt: string;
  acceptedBy: string;
  version: number;
}
```

### 8.3. Payment Plan

```ts
export interface PaymentPlanDto {
  id: string;
  workspaceId: string;
  orderId: string;
  buyerRef: BuyerRefDto;
  state: PaymentPlanState;
  kind: "FULL" | "DEPOSIT_BALANCE" | "INSTALLMENT" | "MILESTONE" | "CUSTOM";
  currency: string;
  orderAmount: MoneyDto;
  scheduledAmount: MoneyDto;
  lines: PaymentScheduleLineDto[];
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

### 8.4. Payment Schedule Line

```ts
export interface PaymentScheduleLineDto {
  id: string;
  planId: string;
  sequence: number;
  label: string;
  purpose: "FULL" | "DEPOSIT" | "BALANCE" | "INSTALLMENT" | "MILESTONE" | "OTHER";
  calculation: AmountRuleDto;
  amountDue: MoneyDto;
  dueRule: PaymentDueRuleDto;
  dueDate?: string;
  allowedMethodCodes: string[];
  preferredMethodCode?: string;
  collectionChannelCodes: string[];
  fulfillmentGate: "NONE" | "BEFORE_CONFIRMATION" | "BEFORE_BOOKING" | "BEFORE_DISPATCH" | "BEFORE_COMPLETION";
  invoicePolicyCode?: string;
  state: PaymentScheduleLineState;
  paidAmount: MoneyDto;
  remainingAmount: MoneyDto;
  version: number;
}
```

### 8.5. Due rule discriminated union

```ts
export type PaymentDueRuleDto =
  | { type: "FIXED_DATE"; date: string }
  | { type: "ORDER_CONFIRMED"; offsetDays: number; dayMode: "CALENDAR" | "BUSINESS" }
  | { type: "INVOICE_ISSUED"; offsetDays: number; dayMode: "CALENDAR" | "BUSINESS" }
  | { type: "BEFORE_BOOKING"; offsetDays: number }
  | { type: "BEFORE_DISPATCH"; offsetDays: number }
  | { type: "DELIVERY_CONFIRMED"; offsetDays: number; dayMode: "CALENDAR" | "BUSINESS" }
  | { type: "ACCEPTANCE_CONFIRMED"; offsetDays: number; dayMode: "CALENDAR" | "BUSINESS" }
  | { type: "MILESTONE"; milestoneCode: string; offsetDays: number }
  | { type: "RECURRING"; anchorDate: string; interval: "WEEK" | "MONTH" | "QUARTER"; count: number };
```

Backend resolves `dueDate`. Frontend chỉ render preview và blockers.

### 8.6. Payment Method Catalog

Không hardcode danh sách method trong page.

```ts
export interface PaymentMethodCatalogItemDto {
  code: string;
  family: "BANK_TRANSFER" | "CASH" | "CARD" | "E_WALLET" | "COD" | "DIRECT_DEBIT" | "OTHER";
  channel: "OFFLINE" | "BANK" | "ONLINE_GATEWAY" | "POS" | "CARRIER" | "EXTERNAL";
  displayName: LocalizedTextDto;
  enabled: boolean;
  supportedCurrencies: string[];
  requiresPhysicalShipping: boolean;
  requiresProvider: boolean;
  supportsRefund: boolean;
  supportsPartialPayment: boolean;
  supportsRecurring: boolean;
}
```

### 8.7. Payment Intent

```ts
export interface PaymentIntentDto {
  id: string;
  orderId?: string;
  invoiceIds: string[];
  scheduleLineIds: string[];
  buyerRef: BuyerRefDto;
  amount: MoneyDto;
  methodCode: string;
  providerId: string;
  state: PaymentIntentState;
  checkoutUrl?: string;
  qrPayload?: string;
  expiresAt?: string;
  transactionId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

`checkoutUrl` và `qrPayload` phải là client-safe. Không truyền secret.

### 8.8. Payment Transaction

```ts
export interface PaymentTransactionDto {
  id: string;
  buyerRef: BuyerRefDto;
  orderId?: string;
  intentId?: string;
  kind: "PAYMENT" | "REFUND";
  state: PaymentTransactionState;
  amount: MoneyDto;
  methodCode: string;
  channelCode: string;
  occurredAt: string;
  providerReference?: string;
  externalReference?: string;
  reconciliationState: "UNRECONCILED" | "MATCHED" | "MISMATCH";
  customerPaymentEvidenceState?: "NOT_APPLICABLE" | "COLLECTED";
  merchantRemittanceState?: "NOT_APPLICABLE" | "PENDING" | "REMITTED" | "FAILED";
  effectiveForReceivables: boolean;
  version: number;
}
```

### 8.9. Allocation và Customer Credit

```ts
export interface PaymentAllocationDto {
  id: string;
  paymentTransactionId: string;
  invoiceId: string;
  amount: MoneyDto;
  state: "ACTIVE" | "REVERSED";
  allocatedAt: string;
  reversedAt?: string;
  version: number;
}

export interface CustomerCreditDto {
  id: string;
  buyerRef: BuyerRefDto;
  sourcePaymentTransactionId: string;
  originalAmount: MoneyDto;
  availableAmount: MoneyDto;
  state: "AVAILABLE" | "PARTIAL" | "APPLIED" | "REFUNDED" | "VOIDED";
  version: number;
}
```

### 8.10. Invoice

Invoice DTO phải có:

- sourceOrderIds;
- sourcePaymentScheduleLineIds nếu có;
- sourceShippingMilestoneRefs nếu có;
- seller/buyer snapshots;
- issue/due dates;
- totals;
- credited/allocated/outstanding totals;
- lifecycle, delivery và settlement states riêng;
- version.

## 9. Workflow mục tiêu

### 9.1. Tạo Order Draft

```text
Nhập nội dung thương mại
→ gọi pricing preview
→ chọn Payment Plan template từ configuration/API
→ chỉnh schedule lines
→ gọi payment-plan preview
→ lưu Order DRAFT và Payment Plan DRAFT
```

Không tự sinh ID bền vững bằng `Date.now()`/`Math.random()` trong presentation.

### 9.2. Xác nhận Order

```text
Order DRAFT
→ order confirm-readiness
→ payment-plan confirm-readiness
→ hiển thị blockers/warnings
→ confirm workflow
→ Order CONFIRMED + Payment Plan ACTIVE từ response
```

Backend phải thực hiện transaction hoặc saga. Frontend chỉ gọi một workflow command; không tự lưu Order rồi tự lưu Payment Plan bằng hai thao tác không bù trừ.

### 9.3. Thu tiền trả trước

```text
Payment Schedule Line đến hạn
→ chọn method từ catalog
→ online: create intent; offline: create record request
→ backend xác nhận transaction SUCCEEDED
→ nếu chưa có Invoice: tạo Customer Credit
→ nếu có Invoice: tạo/đề xuất Allocation
```

### 9.4. COD

```text
Schedule line ON_DELIVERY + method catalog hỗ trợ COD
→ Shipping Booking nhận COD collection request
→ carrier báo collected
→ Payment Transaction/COD evidence cập nhật
→ backend quyết định effectiveForReceivables theo policy
→ carrier remittance được theo dõi riêng
```

Không để `COD requested` hoặc `Shipment delivered` tự động đồng nghĩa `Payment succeeded`.

### 9.5. Trả sau

```text
Invoice ISSUED
→ due date được resolve từ rule
→ Receivable NOT_DUE/UNPAID
→ đến hạn: DUE/OVERDUE projection
→ Payment success + allocation
→ Receivable PARTIAL/PAID
```

Order closing không bắt buộc chờ thanh toán nếu payment plan cho phép trả sau và closing policy không có gate.

### 9.6. Trả theo kỳ

```text
Payment Plan ACTIVE có nhiều schedule lines
→ mỗi line có due trigger riêng
→ mỗi line có thể tạo Invoice hoặc tham chiếu Invoice khác
→ Payment có thể trả từng phần
→ schedule/receivable state được cập nhật từ backend
```

Không sinh schedule bằng effect trong React. Gọi preview/generation API.

### 9.7. Refund và Return

```text
Return RECEIVED
→ Credit Note draft/issue nếu giảm giá trị phải thu
→ nếu đã thu tiền: Refund Intent/Transaction
→ reverse/reallocate theo backend policy
→ Return chỉ đóng khi có evidence từ owner
```

Refund không phải payment âm. Không sửa ngược Invoice issued.

### 9.8. Hủy Order

```text
cancellation-readiness
→ phân loại schedule lines chưa có evidence
→ Invoice drafts có thể discard
→ Invoice issued cần credit/void policy
→ Payment/customer credit cần refund/retain decision
→ Shipping booking cần cancel decision
→ backend trả action plan
→ confirm cancellation
```

## 10. API operation inventory chuẩn bị cho backend

> Đây là inventory use case mục tiêu, không phải source of truth cho path. Trước khi backend triển khai, mọi operation chưa có trong `docs/api/openapi.json` phải được đối chiếu với consumer hiện tại và chuyển thành OpenAPI 3.1 có operation ID, schema, error envelope, idempotency và concurrency rõ ràng.

### 10.1. Quy ước chung

```text
/api/v1
Authorization: Bearer <token>
X-Workspace-Id: <workspace-id>
X-Correlation-Id: <uuid>
Idempotency-Key: <uuid>
If-Match: "<etag-or-version>"
Accept-Language: vi | en
```

- Money dùng decimal string.
- Date/time dùng ISO 8601.
- Errors dùng Problem Details có `code`, `fieldErrors`, `blockers`, `correlationId`.
- Write command nhận `AbortSignal` ở frontend port.
- Không silent retry write nếu idempotency chưa rõ.

### 10.2. Catalog/configuration

```text
GET /payment-methods
GET /payment-plan-templates
GET /billing-policy-catalog
GET /payment-provider-availability
```

Catalog là nguồn hiển thị option. Không hardcode provider/method trong component.

### 10.3. Order và payment plan

```text
POST /orders/drafts
PATCH /orders/{orderId}/draft
POST /orders/{orderId}/payment-plan-preview
GET  /orders/{orderId}/confirm-readiness
POST /orders/{orderId}/confirm
GET  /orders/{orderId}/cancellation-readiness
POST /orders/{orderId}/cancel
GET  /orders/{orderId}/closing-readiness
POST /orders/{orderId}/complete
POST /orders/{orderId}/copies
```

`POST /orders/{id}/confirm` trả Order và Payment Plan authoritative trong cùng response/workflow result.

### 10.4. Payment plan

```text
GET   /payment-plans/{planId}
PATCH /payment-plans/{planId}/draft
POST  /payment-plans/{planId}/preview
GET   /payment-plans/{planId}/activation-readiness
POST  /payment-plans/{planId}/activate
POST  /payment-plans/{planId}/supersede
GET   /payment-schedule-lines/{lineId}/collection-readiness
```

### 10.5. Online payment

```text
POST /payment-intents
GET  /payment-intents/{intentId}
POST /payment-intents/{intentId}/cancel
POST /payment-intents/{intentId}/retry
GET  /payment-intents/{intentId}/status
```

Frontend không có endpoint `mark-success`.

### 10.6. Payment transactions

```text
GET  /payments
GET  /payments/{paymentId}
POST /payments/manual-records
POST /payments/{paymentId}/allocations
POST /payment-allocations/{allocationId}/reverse
POST /payments/{paymentId}/reconcile
POST /refund-intents
GET  /refunds/{refundId}
```

Manual record command không nên nhận `state=SUCCEEDED` tùy ý nếu backend policy yêu cầu approval/reconciliation.

### 10.7. Customer credits

```text
GET  /customer-credits
GET  /buyers/{buyerType}/{buyerId}/customer-credits
POST /customer-credits/{creditId}/allocations
POST /customer-credits/{creditId}/refund-intents
```

### 10.8. Invoice và receivables

```text
GET    /invoices
GET    /invoices/{invoiceId}
POST   /invoices/drafts
PATCH  /invoices/{invoiceId}/draft
GET    /invoices/{invoiceId}/issue-readiness
POST   /invoices/{invoiceId}/issue
POST   /invoices/{invoiceId}/retry-issue
POST   /invoices/{invoiceId}/send
POST   /invoices/{invoiceId}/discard
POST   /invoices/{invoiceId}/void
GET    /receivables
GET    /receivables/summary
GET    /receivables/aging
GET    /buyers/{buyerType}/{buyerId}/account-statement
```

Không có endpoint sửa balance trực tiếp.

## 11. Port và adapter frontend

Presentation không gọi `fetch` trực tiếp.

```text
presentation
→ application query/command/workflow
→ port
→ InMemory adapter hoặc HTTP adapter
```

Tối thiểu cần:

```ts
export interface PaymentPlanRepository {
  getByOrderId(orderId: string, signal?: AbortSignal): Promise<PaymentPlanDto | null>;
  preview(command: PreviewPaymentPlanCommand, signal?: AbortSignal): Promise<PaymentPlanPreviewDto>;
  saveDraft(command: SavePaymentPlanDraftCommand, signal?: AbortSignal): Promise<PaymentPlanDto>;
  getActivationReadiness(planId: string, signal?: AbortSignal): Promise<CommandReadinessDto>;
}

export interface PaymentCollectionRepository {
  getMethodCatalog(signal?: AbortSignal): Promise<PaymentMethodCatalogItemDto[]>;
  createIntent(command: CreatePaymentIntentCommand, signal?: AbortSignal): Promise<PaymentIntentDto>;
  getIntent(intentId: string, signal?: AbortSignal): Promise<PaymentIntentDto>;
  recordManualPayment(command: RecordManualPaymentCommand, signal?: AbortSignal): Promise<PaymentTransactionDto>;
  allocate(command: AllocatePaymentCommand, signal?: AbortSignal): Promise<PaymentAllocationResultDto>;
}
```

In-memory adapter:

- dùng cùng port/DTO;
- enforce cùng invariants;
- có deterministic fixtures cho pending, failed, expired, conflict, permission;
- không giả webhook;
- không được gọi trực tiếp từ page.

HTTP adapter:

- map DTO/error tại boundary;
- truyền idempotency/correlation/version;
- không lưu secret;
- xử lý cancellation;
- không tự chuyển redirect callback thành success.

## 12. UI cần xây dựng

### 12.1. Payment Plan Builder trong Order Draft

Hiển thị theo ba tầng:

```text
Loại kế hoạch
→ Các đợt thanh toán
→ Chi tiết từng đợt
```

Mỗi đợt hiển thị:

- tên/mục đích;
- amount hoặc percentage rule;
- authoritative preview amount;
- due trigger và resolved date preview;
- allowed methods;
- preferred method;
- collection channel;
- fulfillment gate;
- invoice policy reference;
- blockers/warnings.

Không đặt đồng thời các select “term”, “timing”, “method”, “gate” mà không có quan hệ validation. UI phải dùng schema/metadata từ API để ẩn option không hợp lệ và vẫn hiển thị server blocker nếu cấu hình stale.

### 12.2. Order Detail

Các phần riêng:

```text
Điều khoản đã chấp nhận
Lịch thanh toán
Hóa đơn
Công nợ
Giao dịch thanh toán
Tiền chưa phân bổ
Vận chuyển/COD evidence
```

Không gộp thành một card “Payment status”.

### 12.3. Payment Intent/Online Checkout Panel

Phải có:

- amount/currency;
- method/provider;
- expiresAt;
- state;
- open checkout action;
- pending polling state có cancel;
- expired/retry action theo policy;
- provider/network error;
- không có nút “Đánh dấu đã trả”.

### 12.4. Manual Payment Form

Dùng cho chuyển khoản đối soát thủ công, tiền mặt hoặc external evidence tùy capability. Phải có:

- buyer/order context;
- amount/currency;
- method từ catalog;
- occurredAt;
- external reference;
- evidence metadata;
- allocation proposal;
- unapplied confirmation;
- readiness/error states.

### 12.5. Allocation Drawer

Hiển thị:

- payment/customer credit available amount;
- open invoices cùng buyer/currency;
- outstanding amount authoritative;
- proposed amount;
- total allocated/unapplied;
- version conflict handling.

### 12.6. Receivables

Receivables là invoice-level read model. Có aging, due date, outstanding, buyer statement. Không hiển thị schedule line như Invoice.

### 12.7. COD

Hiển thị riêng:

```text
COD requested
Customer collected
Carrier remittance pending/remitted/failed
Effective for receivables
```

Bốn khái niệm này không được gộp một badge.

## 13. Action policy và quyền

Không scatter `if` theo status trong JSX.

Tạo selectors:

```ts
getPaymentPlanActionPolicy(context)
getPaymentScheduleLineActionPolicy(context)
getPaymentIntentActionPolicy(context)
getPaymentTransactionActionPolicy(context)
getInvoiceActionPolicy(context)
```

Capabilities đề xuất:

```text
payments.plan.read
payments.plan.create
payments.plan.update_draft
payments.plan.activate
payments.plan.supersede
payments.intent.create
payments.intent.cancel
payments.record_manual
payments.allocate
payments.reverse_allocation
payments.reconcile
payments.refund
payments.customer_credit.read
payments.customer_credit.allocate

invoices.read
invoices.create
invoices.update_draft
invoices.issue
invoices.retry_issue
invoices.send
invoices.create_credit_note
invoices.discard_draft
invoices.void

receivables.read
receivables.export
```

UI dùng capability catalog; backend enforce lại.

## 14. Quy tắc validation nghiệp vụ

Frontend hiển thị validation sớm nhưng response backend là authoritative.

Tối thiểu:

- plan có ít nhất một line;
- sequence và idempotency key duy nhất;
- amount/percentage dương;
- tổng schedule khớp Order total đối với fixed-value plan, trừ policy explicit;
- percentage total bằng 100% khi dùng percentage plan;
- currency nhất quán hoặc có FX policy rõ;
- due rule có đủ field;
- recurring line có count hữu hạn trong phạm vi Order;
- `ON_DELIVERY` không tự suy ra COD;
- COD chỉ khả dụng khi có physical shipping và provider hỗ trợ;
- COD line không chặn booking bằng chính khoản sẽ thu lúc giao;
- trả trước phải có due rule/gate nhất quán;
- trả sau phải có anchor xác định;
- online method cần provider available;
- amount allocation không vượt payment available và invoice outstanding;
- pending/failed payment không giảm receivables;
- issued Invoice không editable;
- plan ACTIVE có evidence không được sửa; dùng supersede/amendment;
- order cancellation phải đọc ảnh hưởng downstream;
- không dùng local time làm accounting truth.

## 15. Không hardcode

Cấm hardcode trong page/component:

- payment methods;
- provider list;
- payment plan templates;
- due-rule options;
- allowed method combinations;
- tax/currency defaults;
- capability strings;
- routes;
- labels/tone;
- status action rules;
- installment counts;
- Net 7/15/30 options;
- COD availability;
- invoice policy;
- success/failure outcomes;
- demo financial rows.

Nguồn đúng:

```text
method/provider options → catalog/configuration query
plan templates           → backend/configuration
status metadata          → centralized registry
business rules           → domain/application/readiness
copy                      → i18n/guidance
sample data               → seed/test fixtures
```

## 16. Typography và presentation

- không `font-black` trong cụm mới;
- không `font-extrabold` trong màn hình nghiệp vụ;
- không bold mọi label/cell/value;
- page title 600–700;
- section title 600;
- field label 500–600;
- body/table 400–500;
- badge 500–600;
- monetary total quan trọng 600–700;
- body/table không dưới 12px;
- dùng whitespace, alignment và grouping trước khi tăng weight;
- không uppercase toàn bộ table headers;
- không tạo dashboard card chỉ để trang trông “đầy”.

Money phải right-align, hiện currency và dùng formatter tập trung.

## 17. Required UI states

Mỗi route/panel có:

```text
initial loading
background refresh
empty dataset
empty filter result
recoverable error
not found
access denied
stale/version conflict
partial related-data error
mutation pending
validation error
provider unavailable
payment intent expired
payment processing
reconciliation mismatch
```

Không thay lỗi bằng seed data im lặng.

## 18. Migration từ mã nguồn hiện tại

### 18.1. Chặn hành vi sai

- bỏ fake success “Tạo hóa đơn”;
- bỏ `InvoiceMocks` và obligation-as-invoice mapping;
- bỏ Order copy trực tiếp thành CONFIRMED;
- bỏ `FAILED` khỏi Order lifecycle;
- bỏ `font-black`/`font-extrabold` trong các surface liên quan;
- bỏ payment method/label arrays khỏi Order page;
- bỏ `Date.now()/Math.random()` cho durable IDs;
- không dùng `number` authoritative cho Money contract mới.

### 18.2. Chuẩn hóa payment model

- giữ compatibility mapper cho dữ liệu cũ;
- tạo `PaymentPlan` và `PaymentScheduleLine` versioned;
- đổi `PaymentObligation` cũ thành compatibility DTO/read adapter, không dùng làm Invoice;
- thêm method catalog;
- thêm online Payment Intent;
- thêm Customer Credit;
- chuyển allocation target từ obligation sang Invoice;
- giữ optional scheduleLineId làm commercial trace, không làm accounting target.

### 18.3. Tạo module Invoice và Receivables

- module manifest/routes/capabilities;
- domain/application/ports/adapters;
- invoice list/detail/draft;
- credit note;
- receivables/account statement;
- allocation UI.

### 18.4. Workflow orchestration

- Order confirmation workflow trả Order + Payment Plan;
- online payment workflow;
- COD evidence workflow;
- cancellation workflow;
- return/credit/refund workflow;
- order closing readiness.

## 19. Test và guard

Bổ sung tối thiểu:

```text
test:payment-plan-contracts
test:payment-method-catalog-contracts
test:payment-intent-contracts
test:payment-allocation-contracts
test:customer-credit-contracts
test:invoice-domain-contracts
test:receivables-contracts
test:order-to-cash-api-contracts
check:order-to-cash-no-fake-success
check:order-to-cash-no-payment-hardcode
check:order-to-cash-money-safety
check:order-to-cash-typography
```

Guard phải bắt:

- hardcoded method/template/provider arrays trong presentation;
- redirect/query param tự chuyển payment success;
- obligation relabeled as invoice;
- payment allocation vào Order thay vì Invoice trong contract mới;
- pending/failed payment giảm outstanding;
- COD request coi là collected;
- collected coi là remitted;
- recurring count vô hạn trong Order plan;
- floating-point totals trong component;
- fake success toast;
- issued invoice editable;
- text dưới 12px, `font-black`, `font-extrabold` trong surface mới.

Sau thay đổi chạy các gate repository hiện có và focused tests. Không tuyên bố browser E2E PASS nếu chưa chạy.

## 20. Acceptance criteria

Frontend đạt khi:

1. Có module `invoices` chính thức.
2. Có Payment Plan và Payment Schedule Line versioned.
3. Payment method/channel/timing/due rule/gate là các chiều riêng.
4. Hỗ trợ trả trước, đặt cọc + balance, COD, trả sau, online và trả theo đợt hữu hạn.
5. Online payment dùng Intent lifecycle; redirect không phải success.
6. Tiền trả trước chưa có Invoice trở thành Customer Credit.
7. Allocation target là Invoice; schedule line chỉ là commercial trace.
8. Công nợ là invoice-level read model.
9. COD collection và carrier remittance tách riêng.
10. Order closing tôn trọng fulfillment gates thay vì bắt mọi Order phải PAID.
11. Payment options đến từ catalog/configuration, không hardcode page.
12. Money DTO không dùng floating-point authoritative.
13. Mọi mutation có readiness, pending, error, conflict và authoritative success.
14. Không fake Invoice, fake Payment success hoặc direct balance edit.
15. Typography không lạm dụng bold và không dùng `font-black`/`font-extrabold` trong surface mới.
16. Có InMemory và HTTP adapter cùng port.
17. Backend-only responsibilities được ghi rõ và không bị frontend mô phỏng sai.
18. Tests/guards liên quan pass.

## 21. Definition of done cho từng màn hình

```text
business owner rõ ràng
route metadata
capability guard
query/command port
memory adapter
HTTP adapter/interface
DTO mapper
loading/empty/error/permission/conflict states
mutation pending
responsive layout
keyboard/focus
money/date formatter tập trung
i18n/guidance
action policy tập trung
focused tests
architecture checks
```

Render được dữ liệu seed không đồng nghĩa màn hình đã hoàn thành.

## 22. Tích hợp SKILLS.md

Ưu tiên đặt:

```text
docs/ai/SKILLS.md
```

và bắt buộc đọc từ `AGENTS.md`.

Nếu công cụ AI chỉ đọc root `SKILLS.md`, cập nhật naming allowlist bằng thay đổi có kiểm soát và chạy naming guard. Không bỏ qua verification.
