import { Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui";
import type { OrderItem } from "../../domain/model/order.types";

interface OrderLineItemsEditorProps {
  locale: string;
  currency: string;
  items: OrderItem[];
  calculations: { subtotal: number; discountTotal: number; taxTotal: number; grandTotal: number };
  onOpenPicker: () => void;
  onUpdateItem: (itemId: string, field: keyof OrderItem, value: string | number) => void;
  onRemoveItem: (itemId: string) => void;
}

export function OrderLineItemsEditor({
  locale,
  currency,
  items,
  calculations,
  onOpenPicker,
  onUpdateItem,
  onRemoveItem,
}: OrderLineItemsEditorProps) {
  const numberLocale = locale === "vi" ? "vi-VN" : "en-US";
  const formatMoney = (value: number) => new Intl.NumberFormat(numberLocale, { style: "currency", currency }).format(value);
  return (
<div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
    <div className="flex items-center gap-2">
      <Package className="w-5 h-5 text-indigo-500" />
      <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">
        {locale === "vi" ? "Danh mục dòng sản phẩm thanh toán" : "Purchase Line Items"}
      </h3>
    </div>

    {/* Add Product Picker modal trigger */}
    <div className="flex items-center gap-2">
      <Button
        type="button"
        actionIntent="create"
        size="xs"
        icon={<Plus size={13} />}
        onClick={onOpenPicker}
      >
        {locale === "vi" ? "Chọn sản phẩm" : "Add products"}
      </Button>
    </div>
  </div>

  {/* Line items list */}
  {items.length === 0 ? (
    <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
      <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
      <p className="text-xs text-slate-600">
        {locale === "vi" ? "Đơn hàng chưa có sản phẩm nào. Chọn một tài sản ở bộ lọc trên để thêm mới." : "No line items drafted yet. Select a product snapshot from the catalog filter above."}
      </p>
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[500px]">
        <thead>
          <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-600">
            <th className="pb-2 w-[40%]">{locale === "vi" ? "Mặt hàng / Chi tiết" : "Catalog Product / Details"}</th>
            <th className="pb-2 text-center w-[15%]">{locale === "vi" ? `Đơn giá (${currency})` : `Unit Price (${currency})`}</th>
            <th className="pb-2 text-center w-[12%]">{locale === "vi" ? "Số lượng" : "Qty"}</th>
            <th className="pb-2 text-center w-[12%]">{locale === "vi" ? "Chiết khấu (%)" : "Disc (%)"}</th>
            <th className="pb-2 text-right w-[15%]">{locale === "vi" ? "Thành tiền" : "Line Total"}</th>
            <th className="pb-2 w-[6%]"><span className="sr-only">{locale === "vi" ? "Thao tác" : "Actions"}</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-50 text-sm">
              
              {/* Name snap */}
              <td className="py-3 pr-2">
                <p className="font-medium text-slate-800 text-xs">{item.productNameSnapshot}</p>
                <input
                  type="text"
                  placeholder={locale === "vi" ? "Mô tả dòng sản phẩm" : "Line description"}
                  aria-label={`${locale === "vi" ? "Mô tả" : "Description"}: ${item.productNameSnapshot}`}
                  value={item.descriptionSnapshot || ""}
                  onChange={(e) => onUpdateItem(item.id, "descriptionSnapshot", e.target.value)}
                  className="bg-transparent border-0 border-b border-transparent focus:border-indigo-400 focus:outline-none w-full text-[11px] text-slate-600 mt-1 placeholder-slate-500"
                />
              </td>

              {/* Unit price input */}
              <td className="py-3 text-center">
                <input
                  type="number"
                  min="0"
                  value={item.unitPriceSnapshot}
                  aria-label={`${locale === "vi" ? "Đơn giá" : "Unit price"}: ${item.productNameSnapshot}`}
                  onChange={(e) => onUpdateItem(item.id, "unitPriceSnapshot", Number(e.target.value))}
                  className="w-24 text-center text-xs bg-slate-50 border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </td>

              {/* Quantity input */}
              <td className="py-3 text-center">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  aria-label={`${locale === "vi" ? "Số lượng" : "Quantity"}: ${item.productNameSnapshot}`}
                  onChange={(e) => onUpdateItem(item.id, "quantity", Number(e.target.value))}
                  className="w-16 text-center text-xs bg-slate-50 border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </td>

              {/* Discount percent */}
              <td className="py-3 text-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={item.discountPercent}
                  aria-label={`${locale === "vi" ? "Chiết khấu phần trăm" : "Discount percent"}: ${item.productNameSnapshot}`}
                  onChange={(e) => onUpdateItem(item.id, "discountPercent", Number(e.target.value))}
                  className="w-16 text-center text-xs bg-slate-50 border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </td>

              {/* Line total */}
              <td className="py-3 text-right font-medium text-slate-700 text-xs">
                {formatMoney(item.lineTotal || 0)}
              </td>

              {/* Delete btn */}
              <td className="py-3 text-right">
                <button
                  onClick={() => onRemoveItem(item.id)}
                  type="button"
                  aria-label={`${locale === "vi" ? "Xóa dòng" : "Remove line"}: ${item.productNameSnapshot}`}
                  className="text-slate-500 hover:text-rose-600 transition p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}

  {/* Calculations summaries */}
  <div className="flex flex-col items-end pt-4 border-t border-slate-100 text-xs text-slate-500 gap-2">
    <div className="flex justify-between w-64">
      <span>{locale === "vi" ? "Tổng cộng doanh số:" : "Subtotal Amount:"}</span>
      <span className="font-semibold text-slate-700">
        {formatMoney(calculations.subtotal)}
      </span>
    </div>
    
    <div className="flex justify-between w-64 text-rose-600">
      <span>{locale === "vi" ? "Khấu trừ chiết khấu:" : "Discount aggregate:"}</span>
      <span>
        -{formatMoney(calculations.discountTotal)}
      </span>
    </div>

    <div className="flex justify-between w-64">
      <span>{locale === "vi" ? "Thuế:" : "Tax:"}</span>
      <span className="font-semibold text-slate-700">{formatMoney(calculations.taxTotal)}</span>
    </div>

    <div className="flex justify-between w-64 border-t border-slate-100 pt-2 text-sm text-slate-900 font-bold">
      <span>{locale === "vi" ? `TỔNG CỘNG (${currency}):` : `GRAND TOTAL (${currency}):`}</span>
      <span>{formatMoney(calculations.grandTotal)}</span>
    </div>
  </div>

</div>

  );
}
