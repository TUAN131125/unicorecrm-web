import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");

const contracts: Array<{ file: string; forbidden: RegExp[]; required?: RegExp[] }> = [
  {
    file: "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx",
    forbidden: [/Payment owner/, /refundable balance/, /Tìm Order/],
    required: [/Không thể ghi nhận thanh toán/, /Đã ghi nhận tiền thu/, /Payment request created/],
  },
  {
    file: "src/modules/orders/presentation/pages/OrderListPage.tsx",
    forbidden: [/CANCELLED\. Đây không phải fulfillment failure/, /Terminal Orders/],
    required: [/Lịch sử giao dịch vẫn được giữ lại/],
  },
  {
    file: "src/modules/returns/presentation/pages/ReturnListPage.tsx",
    forbidden: [/Đóng Return/, /Durable record/, /downstream evidence/, /case queue/, /Resolution mong muốn/],
    required: [/Đóng yêu cầu đổi \/ trả/, /Kết quả kiểm tra hàng và toàn bộ lịch sử xử lý vẫn được lưu/],
  },
  {
    file: "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
    forbidden: [/Hủy booking/, /Order FAILED/, /không xóa record/, /Booking readiness/, />Provider</, />Readiness</],
    required: [/Hủy giao hàng/, /Đơn hàng và toàn bộ lịch sử giao hàng vẫn được giữ lại/],
  },
  {
    file: "src/workspaces/studio/navigation/studioSectionRegistry.ts",
    forbidden: [/Tổng quan thiết lập/, /Quy trình bán hàng/, /Thiết lập chăm sóc khách hàng/, /Sản phẩm chủ lực/],
    required: [
      /Thông tin doanh nghiệp/, /Ngôn ngữ & khu vực/, /Tính năng sử dụng/,
      /Pipeline & trạng thái/, /Loại sản phẩm/, /Trường thông tin/,
      /Thông tin thanh toán/, /Thông tin hóa đơn/, /Tích hợp/, /Webhook & API/,
    ],
  },
];

for (const contract of contracts) {
  const source = read(contract.file);
  for (const pattern of contract.forbidden) {
    assert.equal(pattern.test(source), false, `${contract.file} still contains user-facing copy matching ${pattern}`);
  }
  for (const pattern of contract.required ?? []) {
    assert.equal(pattern.test(source), true, `${contract.file} is missing required copy matching ${pattern}`);
  }
}

console.log(`User-facing copy contracts passed (${contracts.length} surfaces).`);
