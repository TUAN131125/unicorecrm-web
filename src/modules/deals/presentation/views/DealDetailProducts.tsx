import React from "react";
import { Button } from "@/shared/components/ui";
import { formatCurrency } from "@/shared/lib/format/currency";
import { DealDetailField } from "./DealDetailField";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailProducts({ controller: c }: { controller: DealDetailController }) {
  const vi = c.locale === "vi";
  const editable = !c.connected && !c.isTerminal && c.canCommand("deal.update") && c.canWrite("lineItems");
  return <DealDetailField field="lineItems" className="space-y-3 border-t border-slate-100 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{c.t("deals.lineItems.title")}</h3>
      {editable && <Button size="sm" actionIntent="create" onClick={() => c.setIsProductPickerOpen(true)}>{c.t("deals.detail.addLineItem")}</Button>}</div>
    {c.deal.lineItems.length === 0 ? <p className="text-xs text-slate-500">{vi ? "Chưa có dòng sản phẩm thương mại." : "No commercial product lines."}</p> : <div className="max-w-full overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-2">{vi ? "Sản phẩm" : "Product"}</th><th>{vi ? "Số lượng" : "Quantity"}</th><th>{vi ? "Đơn giá" : "Unit price"}</th><th>{vi ? "Giảm (%)" : "Discount (%)"}</th><th>{vi ? "Thành tiền" : "Line total"}</th>{editable && <th />}</tr></thead>
      <tbody>{c.deal.lineItems.map(item => <tr key={item.id} className="border-t border-slate-100"><td className="max-w-48 py-3 pr-3"><p className="font-medium">{item.productNameSnapshot ?? item.productName}</p><p className="text-slate-500">{item.descriptionSnapshot ?? item.description}</p></td>
        <td>{editable ? <input aria-label={vi ? "Số lượng" : "Quantity"} type="number" min={1} className="w-14 rounded border p-1" value={item.quantity} onChange={event => void c.handleUpdateLineItem(item.id, "quantity", Math.max(1, parseInt(event.target.value) || 1))} /> : item.quantity}</td>
        <td className="whitespace-nowrap px-2">{c.deal.currency ? formatCurrency(item.unitPriceSnapshot ?? item.unitPrice ?? 0, c.deal.currency, c.locale) : "—"}</td>
        <td>{editable ? <input aria-label={vi ? "Giảm giá" : "Discount"} type="number" min={0} max={100} className="w-14 rounded border p-1" value={item.discountPercent} onChange={event => void c.handleUpdateLineItem(item.id, "discountPercent", Math.min(100, Math.max(0, parseInt(event.target.value) || 0)))} /> : item.discountPercent}</td>
        <td className="whitespace-nowrap px-2">{c.deal.currency ? c.connected ? (item.lineTotal ?? item.totalAmount) === undefined ? "—" : formatCurrency(item.lineTotal ?? item.totalAmount ?? 0, c.deal.currency, c.locale)
          : formatCurrency((item.unitPrice ?? item.unitPriceSnapshot ?? 0) * (1 - item.discountPercent / 100) * item.quantity, c.deal.currency, c.locale) : "—"}</td>
        {editable && <td><Button size="xs" variant="ghost" onClick={() => void c.handleDeleteLineItem(item.id)}>{vi ? "Xóa" : "Remove"}</Button></td>}</tr>)}</tbody></table></div>}
  </DealDetailField>;
}
