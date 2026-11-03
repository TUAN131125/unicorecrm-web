import { useEffect, useRef, useState } from "react";
import { getDealSelectionAuthority, useDealSelectionAuthority } from "@/components/crm/useCommercialSelection";
import { formatApplicationError } from "@/shared/operations";
import { useI18n } from "@/i18n";
import { loadProductDetail, queryProductPage, readProductCatalogPage } from "../../public/catalog";
import type { Product } from "../../domain/model/product.types";

/** Full catalog pages, plus only the selected records absent from that page.
 * Cache lifetime is this picker session/authority; no protected global cache. */
export function useProductPickerCatalog(open: boolean, selectedIds: readonly string[]) {
  const authority = useDealSelectionAuthority(); const { locale } = useI18n();
  const [search, setSearch] = useState(""); const [cursor, setCursor] = useState<string>();
  const [state, setState] = useState<{ authority: string; products: Product[]; selected: Product[]; next?: string; loading: boolean; preparing: boolean; error: string; missing: string[] }>({ authority, products: [], selected: [], loading: false, preparing: true, error: "", missing: [] });
  const cache = useRef(new Map<string, Product>()); const openingIds = useRef(selectedIds);
  const catalogLoaded = useRef(false);
  const wasOpen = useRef(false); const previousAuthority = useRef(authority);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (previousAuthority.current !== authority) { previousAuthority.current = authority; cache.current.clear(); catalogLoaded.current = false; }
    if (open && !wasOpen.current) { openingIds.current = [...selectedIds]; cache.current.clear(); catalogLoaded.current = false; setSearch(""); setCursor(undefined); setState({ authority, products: [], selected: [], loading: true, preparing: true, error: "", missing: [] }); }
    wasOpen.current = open;
  }, [open, authority]);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setState(s => ({ ...s, loading: true, error: "" }));
    const timer = setTimeout(() => {
      void (async () => {
        // Full-document list has no filter/batch query contract. Read it once per opening;
        // use the existing selection cursor API for search/pagination, joined by ID/version.
        if (!catalogLoaded.current) {
          const documents = await readProductCatalogPage({}, abort.signal);
          if (abort.signal.aborted || authority !== getDealSelectionAuthority()) return;
          for (const p of documents.items) cache.current.set(p.id, p);
          catalogLoaded.current = true;
        }
        const page = await queryProductPage({ search, limit: 50, ...(cursor ? { cursor } : {}) }, abort.signal);
        if (abort.signal.aborted || authority !== getDealSelectionAuthority()) return;
        const absent = [...new Set([...openingIds.current.filter(id => !cache.current.has(id)), ...page.items.filter(p => cache.current.get(p.id)?.resourceVersion !== p.version).map(p => p.id)])];
        const missing: string[] = [];
        // The owner has no full-price batch-by-ID contract. Only preselected cache misses need detail reads.
        for (let offset = 0; offset < absent.length; offset += 4) {
          await Promise.all(absent.slice(offset, offset + 4).map(async id => {
            try { const p = await loadProductDetail(id, abort.signal); if (!abort.signal.aborted) cache.current.set(id, p); }
            catch { if (!abort.signal.aborted) missing.push(id); }
          }));
        }
        if (abort.signal.aborted || authority !== getDealSelectionAuthority()) return;
        const products = page.items.flatMap(p => { const product = cache.current.get(p.id); return product && product.resourceVersion === p.version ? [product] : []; });
        setState(s => ({ authority, products: cursor ? [...new Map([...s.products, ...products].map(p => [p.id, p])).values()] : products,
          selected: openingIds.current.flatMap(id => { const p = cache.current.get(id); return p ? [p] : []; }),
          ...(page.pageInfo.nextCursor ? { next: page.pageInfo.nextCursor } : {}), loading: false, preparing: false, error: "", missing }));
      })().catch(error => { if (!abort.signal.aborted && authority === getDealSelectionAuthority()) setState(s => ({ ...s, loading: false, preparing: false, error: formatApplicationError(error, { locale }) })); });
    }, search ? 300 : 0);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [open, authority, search, cursor, retry, locale]);
  const visible = state.authority === authority ? state : { products: [], selected: [], preparing: true, loading: true, error: "", missing: [], next: undefined };
  return { ...visible, search: (value: string) => { setSearch(value); setCursor(undefined); }, more: () => setCursor(state.next), retry: () => setRetry(n => n + 1) };
}
