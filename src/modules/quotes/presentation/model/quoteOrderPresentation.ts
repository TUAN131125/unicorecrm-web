import type { CustomerOrder } from "@/modules/orders";

/** Only the Order owner's persisted state can establish confirmation. */
export function quoteOrderStateLabel(order: Pick<CustomerOrder, "state">, vi: boolean): string {
  const labels: Record<CustomerOrder["state"], [string, string]> = {
    DRAFT: ["Nháp", "Draft"],
    CONFIRMED: ["Đã xác nhận", "Confirmed"],
    CANCELLED: ["Đã hủy", "Cancelled"],
    COMPLETED: ["Hoàn tất", "Completed"],
  };
  return labels[order.state][vi ? 0 : 1];
}
