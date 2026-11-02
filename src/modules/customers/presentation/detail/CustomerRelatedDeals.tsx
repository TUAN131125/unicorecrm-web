import { Link } from "react-router-dom";
import type { RelationshipRef } from "@/platform/identity";
import { useI18n } from "@/i18n";
import { Button } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";
import { useCustomerRelatedDeals } from "../hooks/useCustomerRelatedDeals";

export function CustomerRelatedDeals({ subject }: { subject: RelationshipRef }) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const { query, permitted, items, hasPrevious, hasNext, firstPage, nextPage } = useCustomerRelatedDeals(subject);
  return <section data-guidance-id="customers.detail.related-deals" className="space-y-3" aria-label={vi ? "Cơ hội liên quan" : "Related deals"}>
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{vi ? "Cơ hội liên quan" : "Related deals"}</h3>
      {permitted && <Button size="xs" variant="secondary" disabled={query.loading} onClick={() => void query.refresh()}>{vi ? "Tải lại" : "Refresh"}</Button>}</div>
    {!permitted ? <p role="status">{vi ? "Bạn chưa có quyền đọc Cơ hội." : "You do not have access to read Deals."}</p>
      : query.loading ? <p role="status">{vi ? "Đang tải cơ hội…" : "Loading deals…"}</p>
      : query.error ? <p role="alert">{formatApplicationError(query.error, { locale })}</p>
      : items.length === 0 ? <p role="status">{vi ? "Không có cơ hội được phép đọc cho Contact hoặc Organization của khách hàng này." : "No accessible deals for this Customer's Contact or Organization."}</p>
      : <ul className="divide-y divide-slate-100">{items.map(deal => <li key={deal.id} className="py-3"><Link className="font-semibold text-indigo-700 hover:underline" to={`/deals/${encodeURIComponent(deal.id)}`}>{deal.name || deal.id}</Link></li>)}</ul>}
    {permitted && !query.loading && !query.error && <div className="flex gap-2">
      {hasPrevious && <Button size="xs" variant="secondary" onClick={firstPage}>{vi ? "Trang đầu" : "First page"}</Button>}
      {hasNext && <Button size="xs" variant="secondary" onClick={nextPage}>{vi ? "Trang tiếp" : "Next page"}</Button>}
    </div>}
  </section>;
}
