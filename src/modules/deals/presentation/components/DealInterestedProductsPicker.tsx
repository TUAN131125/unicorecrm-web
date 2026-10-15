import React from "react";
import { queryProductPage } from "@/modules/products";
import { Button, Input } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { useDealSelectionQueries } from "../hooks/useDealSelectionQueries";
import { useDealProductSelection } from "../hooks/useDealProductSelection";

const load = (search: string, cursor: string | undefined, signal: AbortSignal) => queryProductPage({ search, limit: 20, ...(cursor ? { cursor } : {}) }, signal);
export function DealInterestedProductsPicker({ ids, onChange, guidanceId = "deals.form.interested-products" }: { ids: readonly string[]; onChange(ids: string[]): void; guidanceId?: string }) {
  const { locale } = useI18n(); const vi = locale === "vi";
  const [search, setSearch] = React.useState("");
  const query = useDealSelectionQueries(search, load);
  const selected = useDealProductSelection(ids);
  return <section data-guidance-id={guidanceId} className="space-y-2 rounded border p-3">
    <Input label={vi ? "Tìm sản phẩm theo tên hoặc SKU" : "Find products by name or SKU"} value={search} onChange={event => setSearch(event.target.value)} />
    <ul aria-label={vi ? "Sản phẩm đã chọn" : "Selected products"}>{ids.map(id => {
      const product = selected.items.find(item => item.id === id);
      return <li key={id} data-product-id={id}>{product ? `${product.name} · ${product.sku}` : id}
        {product && product.status !== "active" ? <span> · {vi ? "Không còn hoạt động" : "No longer active"}</span> : null}
        {!product && !selected.loading && !selected.error ? <span> · {vi ? "Không thể xác minh" : "Cannot verify"}</span> : null}
        <Button type="button" variant="secondary" size="xs" onClick={() => onChange(ids.filter(value => value !== id))}>{vi ? "Xóa" : "Remove"}</Button></li>;
    })}</ul>
    {selected.loading ? <p>{vi ? "Đang xác minh sản phẩm đã chọn…" : "Verifying selected products…"}</p> : selected.error ? <><p role="alert">{selected.error}</p><Button type="button" onClick={selected.retry}>{vi ? "Thử xác minh lại" : "Retry selected products"}</Button></> : null}
    {query.loading ? <p>{vi ? "Đang tìm…" : "Searching…"}</p> : query.error ? <><p role="alert">{query.error}</p><Button type="button" onClick={query.reload}>{vi ? "Thử lại" : "Retry"}</Button></> : query.items.length === 0 ? <p>{vi ? "Không có sản phẩm phù hợp." : "No matching products."}</p> : query.items.filter(item => item.status === "active").map(item => <Button type="button" key={item.id} variant="secondary" disabled={ids.includes(item.id) || ids.length >= 100} onClick={() => onChange([...new Set([...ids, item.id])])}>{item.name} · {item.sku}</Button>)}
    <Button type="button" variant="secondary" size="xs" onClick={query.firstPage}>{vi ? "Trang đầu" : "First page"}</Button>{query.next && <Button type="button" variant="secondary" size="xs" onClick={query.nextPage}>{vi ? "Trang tiếp" : "Next page"}</Button>}
    <p className="text-xs">{vi ? "Sản phẩm quan tâm không thay đổi giá trị dự kiến. Báo giá dòng thương mại chưa được hỗ trợ." : "Interested products do not change the expected amount. Commercial line pricing is unavailable."}</p>
  </section>;
}
