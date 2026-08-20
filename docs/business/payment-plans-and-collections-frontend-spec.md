# Đặc tả frontend cho Payment Plans, Payment Methods và Collections

## 1. Mục tiêu

Tài liệu này chuẩn hóa logic thanh toán cho Unicore CRM để frontend hỗ trợ đúng:

- trả trước toàn bộ;
- đặt cọc;
- trả phần còn lại;
- trả sau;
- trả khi nhận hàng;
- COD;
- thanh toán online;
- tiền mặt/chuyển khoản/POS;
- trả nhiều đợt;
- trả theo milestone;
- trả theo kỳ hữu hạn;
- kết hợp nhiều phương thức;
- tiền trả trước chưa phân bổ;
- refund và reversal.

Mục tiêu không phải tạo càng nhiều select càng tốt. Mục tiêu là mô hình hóa đúng để UI chỉ hiển thị lựa chọn hợp lệ và backend có API contract rõ ràng.

## 2. Năm khái niệm thường bị trộn

### 2.1. Payment Plan Kind — cách chia số tiền

Ví dụ:

```text
FULL
DEPOSIT_BALANCE
INSTALLMENT
MILESTONE
CUSTOM
```

### 2.2. Payment Timing — thời điểm khách phải trả

Ví dụ:

```text
trước xác nhận
trước booking
trước dispatch
khi giao hàng
sau hóa đơn N ngày
sau giao hàng N ngày
sau nghiệm thu N ngày
ngày cố định
định kỳ hữu hạn
```

### 2.3. Payment Method — công cụ dùng để trả

Ví dụ:

```text
chuyển khoản ngân hàng
tiền mặt
thẻ
ví điện tử
direct debit
COD
phương thức khác do backend catalog cung cấp
```

### 2.4. Payment Channel — nơi/cách giao dịch được thực hiện

Ví dụ:

```text
OFFLINE
BANK
ONLINE_GATEWAY
POS
CARRIER
EXTERNAL
```

Một thẻ có thể đi qua online gateway hoặc POS. Chuyển khoản có thể là manual bank transfer hoặc online checkout. Vì vậy channel và method không đồng nghĩa.

### 2.5. Fulfillment Gate — khoản tiền có chặn vận hành không

```text
NONE
BEFORE_CONFIRMATION
BEFORE_BOOKING
BEFORE_DISPATCH
BEFORE_COMPLETION
```

Gate là policy, không suy ra tự động từ method. COD phải thu lúc giao nên thường không thể là `BEFORE_BOOKING`.

## 2.6. Ánh xạ từ mô hình hiện tại sang mô hình mục tiêu

| Mô hình hiện tại | Vai trò mục tiêu | Hành động |
|---|---|---|
| `PaymentPlanType` | `PaymentPlan.kind` | Giữ ý nghĩa, chuẩn hóa tên và versioning |
| `PaymentTerm` | Compatibility vocabulary | Không tiếp tục dùng làm trục chính của UI |
| `PaymentTiming` | Một phần của `PaymentDueRule` | Chuyển sang due-rule discriminated union |
| `PaymentDueRule` | Due trigger | Mở rộng anchor/offset/day mode |
| `PaymentFulfillmentGate` | Fulfillment gate | Giữ riêng, không suy ra từ method |
| `PaymentMethod` enum hardcode | Method catalog item | Chuyển option sang API/configuration catalog |
| `PaymentObligation` | Payment Schedule Line compatibility | Không dùng như Invoice hoặc receivable accounting target |
| `PaymentAllocation.obligationId` | Invoice allocation | Contract mới dùng `invoiceId`; `scheduleLineId` chỉ là trace tùy chọn |
| `unappliedAmount` | Customer Credit | Trở thành record/versioned read model rõ ràng |
| `PaymentSource` | Transaction source/channel | Tách source và channel nếu backend cần |
| `CodCollectionState` | Customer collection evidence | Bổ sung merchant remittance state riêng |

Migration phải có mapper đọc dữ liệu cũ. Không đổi tên type rồi giữ nguyên semantics sai.

## 3. Bảng phân biệt bắt buộc

| Nhu cầu | Plan kind | Due trigger | Method | Channel | Gate |
|---|---|---|---|---|---|
| Trả trước chuyển khoản | FULL | trước booking | bank transfer | BANK | BEFORE_BOOKING |
| Trả online bằng thẻ | FULL | trước dispatch | card | ONLINE_GATEWAY | BEFORE_DISPATCH |
| Đặt cọc 30% | DEPOSIT_BALANCE | order confirmed | bank/card | BANK/ONLINE | BEFORE_BOOKING tùy policy |
| 70% còn lại Net 7 | DEPOSIT_BALANCE | delivery + 7 ngày | nhiều method | tùy chọn | NONE |
| COD | FULL | delivery confirmed | COD | CARRIER | NONE |
| Trả khi nhận bằng chuyển khoản | FULL | delivery confirmed | bank transfer | BANK | NONE |
| Trả sau Net 30 | FULL | invoice issued + 30 ngày | allowed methods | nhiều channel | NONE |
| 3 đợt | INSTALLMENT | ba rule riêng | method riêng từng đợt | nhiều channel | gate riêng từng đợt |

UI không được chỉ có một trường “Hình thức thanh toán” để biểu diễn toàn bộ bảng trên.

## 4. Payment Plan

### 4.1. Aggregate

```ts
export interface PaymentPlanDto {
  id: string;
  workspaceId: string;
  orderId: string;
  buyerRef: BuyerRefDto;
  kind: PaymentPlanKind;
  state: PaymentPlanState;
  currency: string;
  orderAmount: MoneyDto;
  scheduledAmount: MoneyDto;
  remainingUnscheduledAmount: MoneyDto;
  lines: PaymentScheduleLineDto[];
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

### 4.2. Plan state

```text
DRAFT      → đang chỉnh
ACTIVE     → đã chấp nhận và dùng để vận hành
SUPERSEDED → đã có version mới thay thế
CANCELLED  → bị hủy qua workflow
COMPLETED  → mọi line đã đạt kết quả theo policy
```

Plan ACTIVE có payment/invoice/evidence không được chỉnh trực tiếp. Cần `supersede` hoặc amendment command.

### 4.3. Amount rule

```ts
export type AmountRuleDto =
  | { type: "FIXED"; amount: MoneyDto }
  | { type: "PERCENTAGE"; percentage: string; base: "ORDER_TOTAL" | "REMAINING_BALANCE" }
  | { type: "REMAINDER" };
```

- Backend trả preview amount.
- UI không tự tính phần trăm để làm authoritative total.
- Một plan thường chỉ có tối đa một `REMAINDER` line và line đó đứng sau các line cố định/phần trăm.

## 5. Due rules

### 5.1. Fixed date

```ts
{ type: "FIXED_DATE", date: "2026-08-15" }
```

### 5.2. Event-relative

```ts
{ type: "ORDER_CONFIRMED", offsetDays: 0, dayMode: "CALENDAR" }
{ type: "INVOICE_ISSUED", offsetDays: 30, dayMode: "CALENDAR" }
{ type: "DELIVERY_CONFIRMED", offsetDays: 7, dayMode: "BUSINESS" }
{ type: "ACCEPTANCE_CONFIRMED", offsetDays: 15, dayMode: "CALENDAR" }
```

### 5.3. Operational precondition

```ts
{ type: "BEFORE_BOOKING", offsetDays: 0 }
{ type: "BEFORE_DISPATCH", offsetDays: 1 }
```

### 5.4. Milestone

```ts
{ type: "MILESTONE", milestoneCode: "UAT_ACCEPTED", offsetDays: 0 }
```

Milestone codes đến từ contract/configuration, không hardcode page.

### 5.5. Recurring finite

```ts
{
  type: "RECURRING",
  anchorDate: "2026-08-01",
  interval: "MONTH",
  count: 6
}
```

Backend sinh sáu schedule lines hoặc trả generated preview. Frontend không tự tạo kỳ bằng `Array.from` rồi coi là business truth.

Open-ended recurrence thuộc Subscription/Contract Billing, không thuộc Order plan hữu hạn.

## 6. Payment method catalog

### 6.1. Catalog-driven UI

Frontend gọi:

```text
GET /payment-methods?workspaceId=...
```

Mỗi method trả:

- code;
- localized label;
- family;
- channel;
- currencies;
- min/max amount nếu có;
- provider availability;
- physical shipping requirement;
- partial payment support;
- refund support;
- recurring support;
- required fields schema;
- disabled reason.

Không đặt array payment methods trong `OrderFormPage.tsx`.

### 6.2. Method examples

#### Bank transfer

Có thể là:

- manual bank transfer với nội dung chuyển khoản;
- virtual account;
- QR transfer;
- online banking redirect.

Không tự đánh dấu succeeded khi người dùng tải QR hoặc copy nội dung.

#### Cash

Cần cashier/manual evidence và capability. Không tự coi việc chọn “Tiền mặt” là đã nhận tiền.

#### Card

Có thể là online gateway hoặc POS. Không lưu card number/CVV.

#### E-wallet

Provider-specific nhưng UI nhận schema/client-safe payload từ API.

#### COD

Chỉ khả dụng khi:

- có physical shipping;
- provider/carrier hỗ trợ COD;
- amount trong giới hạn provider;
- currency hỗ trợ;
- due timing là on delivery;
- gate không mâu thuẫn.

#### Direct debit

Chỉ hiển thị khi backend trả mandate capability. Frontend không lưu bank credential hoặc tự tạo mandate giả.

## 7. Các pattern chi tiết

### 7.1. Trả trước 100%

```text
Line 1
purpose: FULL
due: BEFORE_BOOKING
amount: 100%
allowed methods: bank transfer, online card, e-wallet
fulfillment gate: BEFORE_BOOKING
```

Luồng:

```text
Plan ACTIVE
→ line DUE
→ collect payment
→ transaction SUCCEEDED
→ customer credit hoặc invoice allocation
→ gate readiness READY
→ shipping booking được phép
```

### 7.2. Đặt cọc 30%, còn lại 70% trước giao

```text
Line 1: DEPOSIT 30%, due ORDER_CONFIRMED, gate BEFORE_BOOKING
Line 2: BALANCE REMAINDER, due BEFORE_DISPATCH, gate BEFORE_DISPATCH
```

Nếu chỉ thu 30%, booking có thể được phép nhưng dispatch vẫn bị chặn.

### 7.3. Đặt cọc 30%, còn lại Net 7 sau giao

```text
Line 1: DEPOSIT 30%, due ORDER_CONFIRMED, gate BEFORE_BOOKING
Line 2: BALANCE 70%, due DELIVERY_CONFIRMED + 7, gate NONE
```

Order có thể completed sau delivery nếu closing policy cho phép; receivable vẫn còn mở.

### 7.4. COD toàn bộ

```text
Line 1
purpose: FULL
due: DELIVERY_CONFIRMED
method: COD
channel: CARRIER
gate: NONE
```

States cần hiển thị:

```text
COD request created
Shipment delivered
Customer collection confirmed
Carrier remittance pending
Carrier remitted
Reconciled
```

Các state trên không đồng nghĩa nhau.

### 7.5. Trả khi nhận nhưng không COD

Khách nhận hàng rồi chuyển khoản. Due trigger giống COD nhưng method/channel khác:

```text
due: DELIVERY_CONFIRMED
method: BANK_TRANSFER
channel: BANK
gate: NONE
```

Không cần carrier collection evidence.

### 7.6. Trả sau Net 30

```text
due: INVOICE_ISSUED + 30 calendar days
allowed methods: catalog-defined
gate: NONE
```

Invoice creates receivable. Payment schedule chỉ mô tả điều khoản.

### 7.7. Ba đợt theo milestone

```text
20% khi ký
40% khi UAT accepted
40% khi go-live accepted
```

Milestone event phải đến từ backend/workflow. Frontend không có nút tùy ý “đánh dấu milestone hoàn tất” nếu không có owner/capability.

### 7.8. Sáu kỳ hàng tháng

Backend preview trả sáu line cụ thể có dueDate. UI cho xem/chỉnh theo policy trước activation. Sau activation không regenerate âm thầm.

### 7.9. Kết hợp phương thức

Mỗi line có `allowedMethodCodes`. Khi thu tiền, user chọn method khả dụng cho line đó. Payment Transaction ghi method thực tế.

### 7.10. Trả thừa

```text
Payment amount > allocatable outstanding
→ backend yêu cầu allowUnapplied/confirmation
→ phần dư thành Customer Credit
```

Không tự allocate vượt invoice outstanding.

### 7.11. Trả thiếu

Tạo partial allocation. Schedule line/Invoice settlement trở thành PARTIAL theo response.

### 7.12. Payment cho nhiều Invoice

Một payment có thể allocate nhiều Invoice cùng buyer và currency. Backend kiểm tra amount, currency, version và outstanding.

## 8. Online payment lifecycle

### 8.1. Create intent

Request chỉ chứa client-safe business data:

```json
{
  "buyerRef": { "type": "CONTACT", "id": "..." },
  "orderId": "...",
  "invoiceIds": ["..."],
  "scheduleLineIds": ["..."],
  "amount": { "amount": "1000000", "currency": "VND" },
  "methodCode": "provider-card",
  "returnContext": { "routeKey": "PAYMENT_DETAIL" }
}
```

Không gửi provider secret từ browser.

### 8.2. Redirect/embedded checkout

- Chỉ dùng URL/payload do backend trả.
- Validate allowed origin/schema trước khi open.
- Có expiresAt.
- Có pending state.
- User đóng checkout không có nghĩa payment failed hoặc cancelled.

### 8.3. Return callback

Frontend đọc `intentId` opaque và query backend. Không tin amount/status/providerRef từ query string.

### 8.4. Polling

- Có AbortSignal.
- Dừng khi terminal state hoặc user rời trang.
- Backoff do shared query policy.
- Không poll nhanh hơn contract.
- Không tạo transaction local nếu timeout.

### 8.5. Retry

Retry tạo intent mới hoặc gọi retry command theo backend policy. Không reuse idempotency key với payload khác.

## 9. COD accounting boundary

COD có hai sự thật:

```text
Customer paid carrier
Carrier remitted merchant
```

Backend trả:

```ts
customerPaymentEvidenceState: "COLLECTED"
merchantRemittanceState: "PENDING" | "REMITTED" | "FAILED"
effectiveForReceivables: boolean
```

Frontend không tự quyết định khi nào receivable được giảm. Policy có thể khác theo doanh nghiệp.

## 10. Invoice interaction

### 10.1. Prepayment before Invoice

Payment thành Customer Credit. Sau khi Invoice issued:

```text
Allocate customer credit
→ Invoice outstanding giảm
```

### 10.2. Invoice before payment

Invoice tạo receivable. Payment success được allocate sau.

### 10.3. Deposit invoice

Nếu policy yêu cầu, Invoice module tạo invoice cho deposit line. Payment allocation target là deposit invoice.

### 10.4. Milestone invoice

Invoice draft availability dựa trên milestone evidence và chưa invoiced amount.

### 10.5. Final invoice

Có thể trừ deposit/credit theo backend totals. UI không tự trừ.

## 11. Payment Plan Builder UX

### 11.1. Không dùng form “ma trận select” thiếu ngữ cảnh

Thay vì cho người dùng tự chọn tùy ý:

```text
plan type
purpose
timing
term
method
gate
due date
```

UI nên theo flow:

```text
1. Chọn template/kind
2. Backend trả schema và line đề xuất
3. Chỉnh amount rule
4. Chọn due trigger
5. Chọn allowed methods từ catalog đã lọc
6. Chọn gate hợp lệ
7. Xem preview authoritative
8. Sửa blockers
```

### 11.2. Preview panel

Hiển thị:

- Order total;
- scheduled total;
- remainder;
- resolved due dates;
- prepayment gates;
- invoice policy summary;
- unsupported method/provider warnings;
- overlapping/missing line warnings.

### 11.3. Accessibility

- fieldset/legend cho từng schedule line;
- reorder bằng keyboard nếu có sequence control;
- errors liên kết field;
- không chỉ dùng màu;
- amount và due date đọc rõ;
- không dùng text quá nhỏ.

## 12. Validation matrix

### 12.1. General

- amount > 0;
- unique line IDs/sequence;
- valid currency;
- scheduled total valid;
- due rule complete;
- method enabled;
- provider available;
- buyer/order consistent;
- version current.

### 12.2. Prepaid

- due anchor trước gate;
- gate không thể xảy ra trước due trigger bất khả thi;
- method supports amount/currency.

### 12.3. Postpaid

- anchor phải là invoice/delivery/acceptance/fixed date;
- gate thường NONE trừ explicit policy;
- due date do backend resolve.

### 12.4. COD

- physical shipping;
- carrier supports COD;
- timing on delivery;
- gate NONE;
- amount within carrier limit;
- remittance tracking enabled.

### 12.5. Installment

- count hữu hạn;
- total amount valid;
- sequence consistent;
- no duplicate generated dates unless allowed;
- plan activation freezes schedule.

### 12.6. Online

- provider available;
- method/channel compatible;
- redirect origin/client payload valid;
- intent not expired;
- duplicate submit protected.

## 13. Error codes cần chuẩn bị

```text
PAYMENT_PLAN_TOTAL_MISMATCH
PAYMENT_PLAN_LINE_INVALID
PAYMENT_PLAN_VERSION_CONFLICT
PAYMENT_METHOD_DISABLED
PAYMENT_METHOD_CURRENCY_UNSUPPORTED
PAYMENT_PROVIDER_UNAVAILABLE
PAYMENT_INTENT_EXPIRED
PAYMENT_INTENT_ALREADY_TERMINAL
PAYMENT_AMOUNT_EXCEEDS_AVAILABLE
PAYMENT_ALLOCATION_CURRENCY_MISMATCH
PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING
CUSTOMER_CREDIT_INSUFFICIENT
COD_REQUIRES_PHYSICAL_SHIPPING
COD_PROVIDER_UNSUPPORTED
COD_AMOUNT_OUT_OF_RANGE
RECURRING_COUNT_REQUIRED
RECURRING_OPEN_ENDED_NOT_SUPPORTED
DUE_RULE_INVALID
FULFILLMENT_GATE_CONFLICT
INVOICE_REQUIRED_FOR_ALLOCATION
```

Frontend map code qua i18n/guidance. Không hardcode English error text trong component.

## 14. API response examples

### 14.1. Plan preview

```json
{
  "ready": false,
  "orderAmount": { "amount": "100000000", "currency": "VND" },
  "scheduledAmount": { "amount": "90000000", "currency": "VND" },
  "remainingAmount": { "amount": "10000000", "currency": "VND" },
  "resolvedLines": [],
  "warnings": [],
  "blockers": [
    {
      "code": "PAYMENT_PLAN_TOTAL_MISMATCH",
      "messageKey": "payments.plan.totalMismatch",
      "fieldPath": "lines"
    }
  ],
  "version": 3
}
```

### 14.2. Intent pending

```json
{
  "id": "pi_123",
  "state": "PROCESSING",
  "amount": { "amount": "30000000", "currency": "VND" },
  "methodCode": "gateway-card",
  "expiresAt": "2026-07-15T12:30:00+07:00",
  "version": 2
}
```

### 14.3. Allocation result

```json
{
  "payment": { "id": "pay_123", "state": "SUCCEEDED" },
  "allocations": [],
  "customerCredit": {
    "availableAmount": { "amount": "500000", "currency": "VND" }
  },
  "updatedReceivables": [],
  "version": 5
}
```

## 15. Frontend-only giới hạn

Frontend không làm:

- scheduler tạo kỳ bền vững;
- provider webhook verification;
- payment authorization/capture;
- bank reconciliation authoritative;
- legal invoice numbering;
- accounting posting;
- FX authoritative;
- durable idempotency;
- server authorization;
- secrets/mandates/card data storage;
- transaction/saga persistence.

Frontend làm:

- render plan/schema;
- preview;
- input validation UX;
- call commands;
- display authoritative states;
- conflict recovery;
- ports/adapters/DTO mapping;
- deterministic development fixtures;
- accessibility/i18n/guidance.

## 16. Test cases bắt buộc

1. 100% prepay blocks booking until satisfied.
2. 30/70 plan only releases the appropriate gate.
3. COD unavailable without physical shipping.
4. COD requested does not settle receivable.
5. COD collected and remitted display separately.
6. Postpaid Order can complete while receivable remains open when policy allows.
7. Redirect callback cannot mark Intent succeeded.
8. Intent expiry and retry work without duplicate payment.
9. Payment pending/failed does not reduce outstanding.
10. Partial payment creates partial allocation.
11. Overpayment requires customer-credit confirmation.
12. Customer credit allocates only to same buyer/currency unless backend permits otherwise.
13. One payment can allocate multiple invoices.
14. Installment generation is backend preview-driven.
15. Open-ended recurrence is blocked in Order plan.
16. Plan ACTIVE with evidence cannot be edited directly.
17. Supersede preserves audit/version.
18. Method options come from catalog, not page constants.
19. Money totals are decimal-safe and authoritative.
20. All error codes have bilingual guidance.
