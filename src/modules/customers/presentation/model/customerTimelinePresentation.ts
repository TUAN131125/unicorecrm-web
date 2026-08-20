import { businessStatusLabel } from "@/i18n/productGlossary";
import type { CustomerTimelineItem } from "./customer360ReadModel";

export interface CustomerTimelinePresentation {
  title: string;
  detail?: string;
}

export function presentCustomerTimelineItem(item: CustomerTimelineItem, isVi: boolean): CustomerTimelinePresentation {
  if (!item.eventType) return { title: item.title, detail: item.detail };
  const p = item.params ?? {};
  const locale = isVi ? "vi" : "en";
  const status = item.statusCode ? businessStatusLabel(item.statusCode, locale) : undefined;
  switch (item.eventType) {
    case "CUSTOMER_CREATED_FROM_PURCHASE": return { title: isVi ? "Customer được tạo từ bằng chứng mua hàng" : "Customer created from purchase evidence", detail: String(p.customerCode || "") };
    case "LEAD_JOURNEY": return { title: `${isVi ? "Hành trình Lead" : "Lead journey"}: ${p.name}`, detail: [status, p.outcome ? businessStatusLabel(String(p.outcome), locale) : undefined].filter(Boolean).join(" · ") };
    case "DEAL_CREATED": return { title: `${isVi ? "Đã tạo cơ hội" : "Opportunity created"}: ${p.name}`, detail: status };
    case "QUOTE_UPDATED": return { title: `${isVi ? "Báo giá" : "Quote"} ${p.number}`, detail: status };
    case "ORDER_UPDATED": return { title: `${isVi ? "Đơn hàng" : "Order"} ${p.number}`, detail: status };
    case "PAYMENT_RECORDED": return { title: p.kind === "REFUND" ? (isVi ? "Hoàn tiền" : "Refund") : (isVi ? "Thanh toán" : "Payment"), detail: [status, p.amount].filter(Boolean).join(" · ") };
    case "SHIPPING_DELIVERED": return { title: `${isVi ? "Đã giao vận đơn" : "Shipment delivered"}: ${p.code}`, detail: String(p.trackingCode || "") || undefined };
    case "RETURN_UPDATED": return { title: `${isVi ? "Yêu cầu trả hàng" : "Return"} ${p.code}`, detail: status };
    case "CONTACT_NOTE": return { title: `${isVi ? "Ghi chú" : "Note"} · ${p.contactName}`, detail: item.detail };
    case "CONTACT_INTERNAL_NOTE": return { title: `${isVi ? "Ghi chú nội bộ" : "Internal note"} · ${p.contactName}`, detail: item.detail };
    default: return { title: item.title, detail: item.detail };
  }
}
