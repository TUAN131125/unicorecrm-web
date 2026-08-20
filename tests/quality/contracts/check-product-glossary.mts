import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { PRODUCT_GLOSSARY, businessStatusLabel, productTerm } from "../../../src/i18n/productGlossary";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

for (const [key, value] of Object.entries(PRODUCT_GLOSSARY)) {
  assert.ok(value.vi.trim(), `${key} must have Vietnamese copy`);
  assert.ok(value.en.trim(), `${key} must have English copy`);
  assert.notEqual(value.vi, value.en, `${key} must not use one mixed-language label`);
}

assert.equal(productTerm("lead", "vi"), "Khách hàng tiềm năng");
assert.equal(productTerm("deal", "vi"), "Cơ hội");
assert.equal(productTerm("shipping", "vi"), "Vận đơn");
assert.equal(productTerm("support", "en"), "Support ticket");

for (const value of ["IN_PROGRESS", "WAITING_CUSTOMER", "DELIVERY_FAILED", "COMPLETED", "CANCELLED"]) {
  const vi = businessStatusLabel(value, "vi");
  const en = businessStatusLabel(value, "en");
  assert.equal(vi.includes("_"), false, `${value} must not expose its technical enum in Vietnamese`);
  assert.equal(en.includes("_"), false, `${value} must not expose its technical enum in English`);
}

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");
const sidebar = read("src/app/shell/layout/Sidebar.tsx");
for (const term of ["Khách hàng tiềm năng", "Người liên hệ", "Tổ chức", "Cơ hội", "Báo giá", "Đơn hàng", "Thanh toán", "Vận đơn", "Đổi / Trả hàng", "Phiếu hỗ trợ", "Công việc"]) {
  assert.ok(sidebar.includes(term), `Sidebar must use canonical Vietnamese term: ${term}`);
}

const orderDetail = read("src/modules/orders/presentation/pages/OrderDetailPage.tsx");
assert.ok(orderDetail.includes("businessStatusLabel(paymentSummary.state, locale)"), "Order payment status must use the product status glossary");
assert.equal(orderDetail.includes('>Yêu cầu: {booking.bookingStatus}'), false, "Shipping booking enum must not be exposed directly");
assert.equal(orderDetail.includes('>Vận chuyển: {booking.externalStatus}'), false, "Carrier enum must not be exposed directly");

const customerDetail = read("src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx");
assert.ok(customerDetail.includes("businessStatusLabel(item.status"), "Customer 360 support status must use a friendly label");
const supportDetail = read("src/modules/support/presentation/pages/SupportCaseDetailPage.tsx");
assert.ok(supportDetail.includes("businessStatusLabel(task.status, locale)"), "Support task status must use a friendly label");

console.log(`Product glossary: PASS — ${Object.keys(PRODUCT_GLOSSARY).length} canonical terms and status presentation contracts verified`);
