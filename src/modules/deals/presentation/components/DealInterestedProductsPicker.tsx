import React from "react";
import { ProductPickerModal, useProductPickerCatalog, type SelectedPickerItem } from "@/modules/products";
import { Button, Modal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { useDealProductSelection } from "../hooks/useDealProductSelection";

export function DealInterestedProductsPicker({ ids, onChange, guidanceId = "deals.form.interested-products" }: { ids: readonly string[]; onChange(ids: string[]): void; guidanceId?: string }) {
  const { locale } = useI18n(); const vi = locale === "vi";
  const [open, setOpen] = React.useState(false);
  const catalog = useProductPickerCatalog(open, ids);
  const selected = useDealProductSelection(ids);
  const initial: SelectedPickerItem[] = catalog.selected.map(product => ({ product, quantity: 1, discountPercent: 0 }));
  return <section data-guidance-id={guidanceId} className="space-y-3 rounded-xl border border-slate-200 p-4">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{vi ? "Sản phẩm quan tâm" : "Interested products"}</h3><Button type="button" variant="secondary" onClick={() => setOpen(true)}>{vi ? "Chọn sản phẩm" : "Choose products"}</Button></div>
    <ul className="space-y-2">{ids.map(id => { const p = selected.items.find(x => x.id === id); return <li key={id} className="flex items-center justify-between gap-2 text-sm"><span>{p ? `${p.name} · ${p.sku}` : (vi ? "Đang xác minh sản phẩm" : "Verifying product")}{p && p.status !== "active" ? ` · ${p.status}` : ""}</span><Button type="button" variant="secondary" size="xs" onClick={() => onChange(ids.filter(x => x !== id))}>{vi ? "Bỏ" : "Remove"}</Button></li>; })}</ul>
    {selected.error && <p role="alert" className="text-xs text-red-600">{selected.error}</p>}
    <p className="text-xs text-slate-500">{vi ? "Sản phẩm quan tâm không thay đổi giá trị dự kiến của cơ hội." : "Interested products do not change the expected opportunity amount."}</p>
    {open && catalog.preparing ? <Modal isOpen onClose={() => setOpen(false)} title={vi ? "Chọn sản phẩm quan tâm" : "Choose interested products"}><p>{vi ? "Đang tải danh mục…" : "Loading catalog…"}</p></Modal> : <ProductPickerModal id="deal-interest-picker" isOpen={open} onClose={() => setOpen(false)} products={catalog.products} initialSelected={initial} mode="interest" context="lead_interest" catalogLoading={catalog.loading} catalogError={catalog.error} onSearchCatalog={catalog.search} hasMore={Boolean(catalog.next)} onLoadMore={catalog.more} onRetryCatalog={catalog.retry} onApply={items => onChange([...new Set([...catalog.missing, ...items.map(x => x.product.id)])])}/>}
  </section>;
}
