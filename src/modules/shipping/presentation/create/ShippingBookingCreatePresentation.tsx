import type { ReactNode } from "react";
import { Globe2, Route, Zap } from "lucide-react";
import { Button } from "@/shared/components/ui";
import type { CustomerOrder } from "@/modules/orders";
import type { ShippingTransportMode } from "../../domain/model/shipping.types";
import type { PickupLocationConfiguration } from "../../domain/model/shippingConfiguration.types";
import { formatShippingMoney, type GoodsDraft } from "./shippingBookingCreateModel";

interface Localizer {
  (vi: string, en: string): string;
}

const modeOptions: Array<{ id: ShippingTransportMode; icon: ReactNode; vi: string; en: string; hintVi: string; hintEn: string }> = [
  { id: "DOMESTIC", icon: <Route size={16} />, vi: "Trong nước", en: "Domestic", hintVi: "Giao liên tỉnh hoặc nội tỉnh", hintEn: "Intercity or local delivery" },
  { id: "INTERNATIONAL", icon: <Globe2 size={16} />, vi: "Quốc tế", en: "International", hintVi: "Có khai báo hải quan và chứng từ", hintEn: "Customs declaration and documents" },
  { id: "INSTANT", icon: <Zap size={16} />, vi: "Giao ngay", en: "Instant", hintVi: "Giao nội thành theo khung giờ", hintEn: "Same-city scheduled delivery" },
];

export function ShippingTransportModeSelector({ mode, onChange, text }: { mode: ShippingTransportMode; onChange: (mode: ShippingTransportMode) => void; text: Localizer }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3">
      {modeOptions.map((option) => {
        const active = mode === option.id;
        return (
          <button key={option.id} type="button" onClick={() => onChange(option.id)} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${active ? "border-violet-300 bg-violet-50 text-violet-800 shadow-sm" : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"}`}>{option.icon}</span>
            <span className="min-w-0"><span className="block text-sm font-semibold">{text(option.vi, option.en)}</span><span className="mt-0.5 block text-[11px] font-medium text-slate-500">{text(option.hintVi, option.hintEn)}</span></span>
          </button>
        );
      })}
    </div>
  );
}

export function ShippingInitialOrderIssue({ issue, orderId, onOpenOrder, text }: { issue?: "ORDER_NOT_FOUND" | "ORDER_NOT_CONFIRMED" | "NO_PHYSICAL_LINES"; orderId?: string; onOpenOrder: (orderId: string) => void; text: Localizer }) {
  if (!issue) return null;
  return (
    <section role="alert" className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
      <div className="text-sm font-medium text-slate-900">{text("Đơn hàng không đủ điều kiện tạo vận đơn", "Order is not eligible for shipment creation")}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-600">
        {issue === "ORDER_NOT_FOUND"
          ? text("Không tìm thấy Order được truyền từ đường dẫn hoặc bạn không có quyền truy cập.", "The linked Order was not found or is not accessible.")
          : issue === "ORDER_NOT_CONFIRMED"
            ? text("Chỉ Order đã xác nhận mới có thể tạo vận đơn.", "Only confirmed Orders can create a shipment.")
            : text("Order này không có dòng hàng vật lý; hãy dùng quy trình thực hiện dịch vụ hoặc thanh toán phù hợp.", "This Order has no physical lines; use the appropriate service-fulfillment or payment workflow.")}
      </div>
      {issue !== "ORDER_NOT_FOUND" && orderId && <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => onOpenOrder(orderId)}>{text("Mở Order để kiểm tra", "Open Order to review")}</Button>}
    </section>
  );
}

export function ShippingReadinessAlert({ visible, missingRequired, warnings, submitError, selectedOrder, canonicalOrderMissing, onOpenOrder, text }: {
  visible: boolean;
  ready: boolean;
  score: number;
  missingRequired: string[];
  warnings: string[];
  submitError: string | null;
  selectedOrder?: CustomerOrder;
  canonicalOrderMissing: string[];
  onOpenOrder: (orderId: string) => void;
  text: Localizer;
}) {
  if (!visible) return null;
  return (
    <section className="space-y-2 text-xs leading-relaxed text-slate-600" role="alert">
      <p className="font-medium text-slate-800">{submitError || text("Bổ sung các trường được đánh dấu bên dưới.", "Complete the fields marked below.")}</p>
      {warnings.length > 0 && <ul className="list-disc space-y-1 pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      {missingRequired.length > 0 && <p className="sr-only">{[...new Set(missingRequired)].join(", ")}</p>}
      {selectedOrder && canonicalOrderMissing.length > 0 && <Button type="button" variant="secondary" size="sm" onClick={() => onOpenOrder(selectedOrder.id)}>{text("Cập nhật dữ liệu giao nhận trên Order", "Update delivery data on Order")}</Button>}
    </section>
  );
}

export function ShippingPreBookingSummary({ selectedPickup, recipientCity, recipientCountryCode, goods, packageCount, effectiveDeclaredValue, selectedOrder, locale, selectedServiceName, serviceCode, text }: {
  selectedPickup?: PickupLocationConfiguration;
  recipientCity: string;
  recipientCountryCode: string;
  goods: GoodsDraft[];
  packageCount: number;
  effectiveDeclaredValue: number;
  selectedOrder?: CustomerOrder;
  locale: "vi" | "en";
  selectedServiceName?: string;
  serviceCode: string;
  text: Localizer;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-medium uppercase text-slate-400">{text("Tuyến", "Route")}</div><div className="mt-1 text-sm font-medium text-slate-900">{selectedPickup?.city || "—"} → {recipientCity || recipientCountryCode || "—"}</div></div>
      <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-medium uppercase text-slate-400">{text("Hàng hóa", "Goods")}</div><div className="mt-1 text-sm font-medium text-slate-900">{goods.reduce((sum, item) => sum + Math.max(1, item.quantity), 0)} {text("đơn vị", "units")} · {packageCount} {text("kiện", "packages")}</div></div>
      <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-medium uppercase text-slate-400">{text("Khai giá", "Declared value")}</div><div className="mt-1 text-sm font-medium text-slate-900">{formatShippingMoney(effectiveDeclaredValue, selectedOrder?.currency ?? "VND", locale)}</div></div>
      <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-medium uppercase text-slate-400">{text("Dịch vụ", "Service")}</div><div className="mt-1 text-sm font-medium text-slate-900">{selectedServiceName ?? (serviceCode || "—")}</div></div>
    </div>
  );
}

export function ShippingBookingActionBar({ codAmount, selectedOrder, locale, chargeableWeight, hasSubmitAttempted, ready, score, submitting, onCancel, onSubmit, text }: {
  codAmount: number;
  selectedOrder?: CustomerOrder;
  locale: "vi" | "en";
  chargeableWeight: number;
  hasSubmitAttempted: boolean;
  ready: boolean;
  score: number;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  text: Localizer;
}) {
  return (
    <div data-mobile-action-bar="true" className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-4 pr-24 shadow-[0_-12px_30px_-24px_rgba(15,23,42,0.55)] backdrop-blur sm:px-6 sm:pr-28">
      <div className="mx-auto flex w-full max-w-[1480px] min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-2 text-left text-[11px] sm:grid-cols-4">
          <div><span className="font-medium text-slate-400">{text("Cước dự kiến", "Estimated fee")}</span><div className="mt-1 font-medium text-slate-800">{text("Tính bởi provider", "Calculated by carrier")}</div></div>
          <div><span className="font-medium text-slate-400">COD</span><div className="mt-1 font-semibold text-amber-700">{formatShippingMoney(codAmount, selectedOrder?.currency ?? "VND", locale)}</div></div>
          <div><span className="font-medium text-slate-400">{text("Khối lượng tính cước", "Chargeable weight")}</span><div className="mt-1 font-medium text-slate-800">{new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(chargeableWeight)} g</div></div>
          <div><span className="font-medium text-slate-400">Readiness</span><div className="mt-1 font-medium text-slate-700">{hasSubmitAttempted ? `${score}%` : text("Chưa kiểm tra", "Not checked")}</div></div>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
          <Button type="button" actionIntent="neutral" size="lg" onClick={onCancel} className="min-w-36">{text("Hủy", "Cancel")}</Button>
          <Button type="button" actionIntent="create" size="lg" onClick={onSubmit} className="min-w-48" loading={submitting}>{text("Tạo vận đơn", "Create shipment")}</Button>
        </div>
      </div>
    </div>
  );
}
