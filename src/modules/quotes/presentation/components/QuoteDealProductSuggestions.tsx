import { useEffect, useState } from "react";
import { resolveProductSelectionIds, type ProductSelection } from "@/modules/products";
import { useDealSelectionAuthority } from "@/components/crm/useCommercialSelection";
import { Button } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";
import { useI18n } from "@/i18n";

export function QuoteDealProductSuggestions({ ids, onAdd }: { ids: readonly string[]; onAdd(id: string): void }) {
  const authority = useDealSelectionAuthority(); const { locale } = useI18n(); const vi = locale === "vi";
  const key = JSON.stringify([authority, ids]);
  const [state, setState] = useState<{ key: string; items: ProductSelection[]; error?: string }>();
  useEffect(() => { const abort = new AbortController();
    void resolveProductSelectionIds(ids, abort.signal).then(items => { if (!abort.signal.aborted) setState({ key, items }); })
      .catch(error => { if (!abort.signal.aborted) setState({ key, items: [], error: formatApplicationError(error, { locale }) }); });
    return () => abort.abort();
  }, [key, locale]);
  const current = state?.key === key ? state : undefined;
  return <section className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/50 p-4" data-i18n-skip="true"><h3 className="text-sm font-semibold">{vi ? "Sản phẩm quan tâm từ cơ hội" : "Interested products from the Deal"}</h3>{current?.error ? <p role="alert">{current.error}</p> : !current ? <p role="status">{vi ? "Đang xác minh…" : "Verifying…"}</p> : current.items.map(p => <div key={p.id} className="flex items-center justify-between gap-3"><span className="text-sm">{p.name} · {p.sku}{p.status !== "active" ? ` · ${p.status}` : ""}</span><Button variant="secondary" size="xs" disabled={p.status !== "active"} onClick={() => onAdd(p.id)}>{vi ? "Thêm vào báo giá" : "Add to Quote"}</Button></div>)}</section>;
}
