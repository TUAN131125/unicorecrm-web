import { resolveOrderLineFulfillmentKind, type CustomerOrder } from "@/modules/orders";
import type { Product } from "@/modules/products";
import type { ShippingHandlingFlags, ShippingTransportMode } from "../../domain/model/shipping.types";

export type GoodsDraft = {
  id: string;
  orderLineId?: string;
  productId: string;
  sku?: string;
  name: string;
  quantity: number;
  weightGrams: number;
  declaredValue: number;
  hsCode: string;
  countryOfOrigin: string;
};

export const serviceOptions: Record<ShippingTransportMode, Array<{ value: string; vi: string; en: string; hintVi: string; hintEn: string }>> = {
  DOMESTIC: [
    { value: "standard", vi: "Tiêu chuẩn", en: "Standard", hintVi: "Tối ưu chi phí", hintEn: "Cost optimized" },
    { value: "express", vi: "Chuyển phát nhanh", en: "Express", hintVi: "Ưu tiên thời gian", hintEn: "Time prioritized" },
    { value: "economy", vi: "Tiết kiệm", en: "Economy", hintVi: "Phù hợp hàng không gấp", hintEn: "For non-urgent goods" },
  ],
  INTERNATIONAL: [
    { value: "intl_express", vi: "Quốc tế nhanh", en: "International express", hintVi: "Ưu tiên thời gian và tracking", hintEn: "Priority transit and tracking" },
    { value: "intl_economy", vi: "Quốc tế tiết kiệm", en: "International economy", hintVi: "Tối ưu chi phí tuyến quốc tế", hintEn: "Cost optimized international route" },
  ],
  INSTANT: [
    { value: "instant_now", vi: "Giao ngay", en: "Deliver now", hintVi: "Điều phối ngay khi booking", hintEn: "Dispatch immediately after booking" },
    { value: "instant_slot", vi: "Giao theo khung giờ", en: "Scheduled slot", hintVi: "Chọn thời gian lấy và giao", hintEn: "Choose pickup and delivery windows" },
  ],
};

export const handlingLabels: Array<{ key: keyof ShippingHandlingFlags; vi: string; en: string }> = [
  { key: "highValue", vi: "Giá trị cao", en: "High value" },
  { key: "oversized", vi: "Quá khổ / nguyên khối", en: "Oversized / monolithic" },
  { key: "fragile", vi: "Dễ vỡ", en: "Fragile" },
  { key: "liquid", vi: "Chất lỏng", en: "Liquid" },
  { key: "solid", vi: "Chất rắn", en: "Solid goods" },
  { key: "powder", vi: "Bột / khoáng sản", en: "Powder / minerals" },
  { key: "perishable", vi: "Dễ hỏng", en: "Perishable" },
  { key: "hazardousGoods", vi: "Hàng nguy hiểm", en: "Dangerous goods" },
  { key: "containsBattery", vi: "Có pin / ắc quy", en: "Contains battery" },
  { key: "keepUpright", vi: "Giữ đúng chiều", en: "Keep upright" },
  { key: "allowStacking", vi: "Cho phép xếp chồng", en: "Allow stacking" },
];

export const formatShippingMoney = (value: number, currency = "VND", locale: "vi" | "en" = "vi") => new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
  style: "currency",
  currency,
  maximumFractionDigits: currency === "VND" ? 0 : 2,
}).format(value || 0);

const resolveProductWeight = (product?: Product): number => {
  const candidate = product?.customFields?.shippingWeightGrams
    ?? product?.customFields?.weightGrams
    ?? product?.customFields?.weight
    ?? 0;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const makeGoodsFromOrder = (order?: CustomerOrder, products: Product[] = []): GoodsDraft[] => order?.items
  .filter((item) => resolveOrderLineFulfillmentKind(item) === "PHYSICAL_SHIPMENT" || (!item.fulfillmentKind && resolveOrderLineFulfillmentKind(item) === "NONE"))
  .map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return {
      id: item.id,
      orderLineId: item.id,
      productId: item.productId,
      sku: item.skuSnapshot,
      name: item.productNameSnapshot,
      quantity: item.quantity,
      weightGrams: resolveProductWeight(product),
      declaredValue: item.lineTotal,
      hsCode: String(product?.customFields?.hsCode ?? ""),
      countryOfOrigin: String(product?.customFields?.countryOfOrigin ?? "VN"),
    };
  }) ?? [];
