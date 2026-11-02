import { useEffect, useState } from "react";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useEffectiveAccess } from "@/platform/access-control";
import { useI18n } from "@/i18n";
import { Button, Input } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";
import { queryProductPage, resolveProductSelectionIds, type ProductSelection } from "../../public/catalog";
import { ProductSelectionRow } from "./ProductSelectionRow";

export function ProductInterestSelector({ ids, onChange, error, guidanceId }: { ids: readonly string[]; onChange(ids: string[]): void; error?: string; guidanceId?: string }) {
  const { locale } = useI18n();const vi = locale === "vi";
  const session = useAuthSessionSnapshot(), workspace = useWorkspaceContextSnapshot(), access = useEffectiveAccess();
  const authority = JSON.stringify([session, workspace, access]);
  const [search, setSearch] = useState(""), [paging, setPaging] = useState<{ authority: string; search: string; cursor?: string }>();
  const cursor = paging?.authority === authority && paging.search === search ? paging.cursor : undefined;
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([authority, search, cursor, retry]);
  const [page, setPage] = useState<{ key: string; items: ProductSelection[]; next?: string; error?: string }>();
  const [selected, setSelected] = useState<{ key: string; items: ProductSelection[]; error?: string }>();
  const selectedKey = JSON.stringify([authority, ids, retry]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void queryProductPage({ search: search.trim(), limit: 20, ...(cursor ? { cursor } : {}) }, controller.signal)
        .then(value => { if (!controller.signal.aborted) setPage({ key, items: value.items, ...(value.pageInfo.nextCursor ? { next: value.pageInfo.nextCursor } : {}) }); })
        .catch(reason => { if (!controller.signal.aborted) setPage({ key, items: [], error: formatApplicationError(reason, { locale }) }); });
    }, 250);
    return () => { clearTimeout(timer);controller.abort(); };
  }, [key, search, cursor, locale]);
  useEffect(() => {
    const controller = new AbortController();
    void resolveProductSelectionIds(ids, controller.signal)
      .then(items => { if (!controller.signal.aborted) setSelected({ key: selectedKey, items }); })
      .catch(reason => { if (!controller.signal.aborted) setSelected({ key: selectedKey, items: [], error: formatApplicationError(reason, { locale }) }); });
    return () => controller.abort();
  }, [selectedKey, locale]);
  const current = page?.key === key ? page : undefined, chosen = selected?.key === selectedKey ? selected : undefined;
  return <section data-guidance-id={guidanceId} aria-label={vi ? "Sản phẩm quan tâm" : "Interested products"} className={`min-w-0 space-y-3 rounded-xl border p-3 ${error ? "border-rose-300" : "border-slate-200"}`}>
    <Input id="qualification-product-search" label={vi ? "Sản phẩm quan tâm" : "Interested products"} placeholder={vi ? "Tìm sản phẩm theo tên hoặc SKU..." : "Search products by name or SKU..."} type="search" value={search} onChange={event => setSearch(event.target.value)} error={error} />
    <div className="h-64 overflow-y-auto overscroll-contain rounded-lg border border-slate-100 p-2" aria-busy={!current} aria-label={vi ? "Kết quả sản phẩm" : "Product results"}>
      {!current ? <p role="status">{vi ? "Đang tìm sản phẩm…" : "Searching products…"}</p> : current.error ? <><p role="alert">{current.error}</p><Button type="button" variant="secondary" onClick={() => setRetry(value => value + 1)}>{vi ? "Thử lại" : "Retry"}</Button></> : current.items.length === 0 ? <p>{vi ? "Không có sản phẩm phù hợp." : "No matching products."}</p> : current.items.map(product => <ProductSelectionRow key={product.id} product={product} selected={ids.includes(product.id)} disabled={product.status !== "active" || (!ids.includes(product.id) && ids.length >= 250)} onToggle={() => onChange(ids.includes(product.id) ? ids.filter(id => id !== product.id) : [...ids, product.id])} />)}
    </div>
    <div className="flex gap-2"><Button type="button" variant="secondary" size="xs" disabled={!cursor || !current} onClick={() => setPaging({ authority, search })}>{vi ? "Trang đầu" : "First page"}</Button>{current?.next && <Button type="button" variant="secondary" size="xs" onClick={() => setPaging({ authority, search, cursor: current.next })}>{vi ? "Trang tiếp" : "Next page"}</Button>}</div>
    <p className="text-xs font-medium">{vi ? `Đã chọn: ${ids.length} sản phẩm` : `Selected: ${ids.length} products`}</p>
    <ul className="flex flex-wrap gap-2" aria-label={vi ? "Sản phẩm đã chọn" : "Selected products"}>{ids.map(id => {
      const product = chosen?.items.find(item => item.id === id);
      return <li key={id} data-product-id={id} className="flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs"><span className="min-w-0 break-words">{product ? `${product.name}${product.sku ? ` — ${product.sku}` : ""}${product.status === "active" ? "" : vi ? " · Không khả dụng" : " · Unavailable"}` : vi ? "Sản phẩm đã chọn" : "Selected product"}</span><button type="button" className="shrink-0 rounded px-1 focus-visible:ring-2 focus-visible:ring-violet-500" aria-label={vi ? `Bỏ chọn ${product?.name ?? "sản phẩm"}` : `Remove ${product?.name ?? "product"}`} onClick={() => onChange(ids.filter(value => value !== id))}>×</button></li>;
    })}</ul>
    {ids.length > 0 && !chosen && <p role="status">{vi ? "Đang tải sản phẩm đã chọn…" : "Loading selected products…"}</p>}
    {chosen?.error && <><p role="alert">{chosen.error}</p><Button type="button" variant="secondary" onClick={() => setRetry(value => value + 1)}>{vi ? "Tải lại lựa chọn" : "Reload selection"}</Button></>}
  </section>;
}

