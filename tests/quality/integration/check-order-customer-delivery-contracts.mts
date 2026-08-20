import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { recordOrderDelivery } from "@/modules/orders/application/commands/orderCommands";
import type { OrderCollection, OrderRepository } from "@/modules/orders/application/ports/OrderRepository";
import { OrderState, type CustomerOrder } from "@/modules/orders";
import { buildLocalVietQrPayload } from "@/modules/payments";
import { createQrMatrix } from "@/shared/lib/qr";

const root = repositoryRoot;
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

class TestOrderRepository implements OrderRepository {
  constructor(private collection: OrderCollection) {}
  snapshot(): OrderCollection { return structuredClone(this.collection); }
  list(): CustomerOrder[] { return Object.values(this.collection).flat(); }
  getById(orderId: string): CustomerOrder | undefined { return structuredClone(this.list().find((order) => order.id === orderId)); }
  replace(orders: OrderCollection): void { this.collection = structuredClone(orders); }
  subscribe(): () => void { return () => undefined; }
}

const order: CustomerOrder = {
  id: "order-delivery-contract",
  orderNumber: "ORD-DELIVERY-001",
  orderDate: "2026-07-14",
  buyerRef: { type: "CONTACT", id: "contact-1" },
  state: OrderState.CONFIRMED,
  confirmedAt: "2026-07-14T08:30:00.000Z",
  recipientName: "Nguyễn Văn A",
  recipientEmail: "customer@example.com",
  recipientPhone: "0900000000",
  shippingAddress: { line1: "1 Nguyễn Huệ", city: "TP. Hồ Chí Minh" },
  items: [{
    id: "line-1",
    productId: "product-1",
    productNameSnapshot: "Gói triển khai",
    quantity: 1,
    unitPriceSnapshot: 1_500_000,
    discountPercent: 0,
    lineSubtotal: 1_500_000,
    lineDiscountAmount: 0,
    lineTaxAmount: 0,
    lineTotal: 1_500_000,
  }],
  totalAmount: 1_500_000,
  grandTotal: 1_500_000,
  currency: "VND",
  paymentAgreementSnapshot: {
    version: 1,
    kind: "FULL_PAYMENT",
    currency: "VND",
    policyVersion: "order-to-cash/v1",
    lines: [{
      id: "agreement:order-delivery-contract:1",
      sequence: 1,
      label: "Thanh toán toàn bộ",
      purpose: "FULL",
      amountRule: { type: "REMAINDER" },
      previewAmount: { amount: "1500000", currency: "VND" },
      dueRule: { type: "EVENT_RELATIVE", event: "ORDER_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" },
      allowedMethodCodes: ["bank-transfer"],
      preferredMethodCode: "bank-transfer",
      fulfillmentGate: "BEFORE_COMPLETION",
      invoicePolicyCode: "STANDARD_ORDER_INVOICE",
    }],
  },
  paymentInstruction: {
    method: "BANK_TRANSFER",
    amount: 1_500_000,
    transferContent: "TT ORD-DELIVERY-001",
    generatedAt: "2026-07-14T09:00:00.000Z",
    bankAccount: {
      sourceAccountId: "account-1",
      bankCode: "VCB",
      bankBin: "970436",
      bankName: "Vietcombank",
      accountNumber: "0011001234567",
      accountName: "UNICORE SOLUTIONS",
    },
  },
};

const repository = new TestOrderRepository({ "contact:contact-1": [order] });
const sent = recordOrderDelivery(repository, order.id, {
  id: "delivery-1",
  channel: "GMAIL",
  recipientEmail: "customer@example.com",
  sentAt: "2026-07-14T10:00:00.000Z",
  sentBy: "Admin",
  fileName: "Don-hang-ORD-DELIVERY-001.pdf",
});
assert.equal(sent?.deliveryHistory?.length, 1);
assert.equal(sent?.sentAt, "2026-07-14T10:00:00.000Z");
assert.match(sent?.deliveryHistory?.[0]?.contentFingerprint ?? "", /^order-[0-9a-f]{8}$/);
const duplicate = recordOrderDelivery(repository, order.id, {
  id: "delivery-1",
  channel: "GMAIL",
  recipientEmail: "customer@example.com",
  sentAt: "2026-07-14T10:00:00.000Z",
});
assert.equal(duplicate?.deliveryHistory?.length, 1, "Delivery evidence must be idempotent by record id");
assert.throws(() => recordOrderDelivery(repository, order.id, {
  id: "delivery-invalid",
  channel: "EMAIL",
  recipientEmail: "invalid",
  sentAt: "2026-07-14T10:00:00.000Z",
}), /valid recipient email/i);

const vietQrPayload = buildLocalVietQrPayload({
  bankBin: "970436",
  accountNumber: "0011001234567",
  amount: 1_500_000,
  transferContent: "TT ORD-DELIVERY-001",
});
assert.ok(vietQrPayload.startsWith("00020101021238"), "Bank-transfer QR must use the VietQR EMV payload envelope");
assert.ok(vietQrPayload.includes("A000000727"), "VietQR payload must retain the NAPAS application identifier");
assert.ok(vietQrPayload.includes("QRIBFTTA"), "VietQR payload must identify account transfer service");
assert.match(vietQrPayload, /6304[0-9A-F]{4}$/);
const qrMatrix = createQrMatrix(vietQrPayload);
assert.ok(qrMatrix.length >= 45, "The local QR encoder must support a complete VietQR payload");
assert.equal(qrMatrix.length, qrMatrix[0].length);
assert.deepEqual(qrMatrix[0].slice(0, 7), [true, true, true, true, true, true, true]);

const detail = read("src/modules/orders/presentation/pages/OrderDetailPage.tsx");
for (const marker of [
  "handleSendGmail",
  "handleExportPdf",
  "confirmOrderDelivery",
  "orders.delivery.confirm",
  'key: "DOCUMENT"',
  "OrderCustomerDocument",
  "recordOrderDeliveryCommandBoundary",
]) assert.ok(detail.includes(marker), `Order detail must retain ${marker}`);

const customerDocument = read("src/modules/orders/presentation/components/OrderCustomerDocument.tsx");
for (const marker of [
  'data-order-pdf-source="true"',
  'data-order-print-qr="bank-transfer"',
  "paymentInstruction",
  "PaymentQrCode",
  "showOnPrint",
]) assert.ok(customerDocument.includes(marker), `Customer Order document must retain ${marker}`);

const actions = read("src/modules/orders/presentation/model/orderActionPolicy.ts");
for (const action of ["send", "confirm-sent", "export-pdf"]) assert.ok(actions.includes(`"${action}"`));

console.log("Order customer delivery, PDF and VietQR contracts: PASS");
