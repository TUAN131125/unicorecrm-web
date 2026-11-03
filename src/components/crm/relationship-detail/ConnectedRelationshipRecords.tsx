import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useEffectiveAccess } from "@/platform/access-control";
import { BuyerDealForm } from "@/modules/deals";
import { RelationshipWorkspace } from "./RelationshipWorkspace";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { toWorkspacePath } from "@/platform/navigation";
import type { RelationshipRef } from "@/platform/identity";
import { useI18n } from "@/i18n";
import { useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import { Button } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";
import { formatCommercialMoney } from "@/shared/lib/format/commercialMoney";
import { formatDate, formatDateTime } from "@/shared/lib/format/date";
import { useConnectedRelationshipRecords, type RelationshipRecordModule } from "./useConnectedRelationshipRecords";

const labels: Record<RelationshipRecordModule, [string, string]> = { deals: ["Cơ hội", "Deals"], quotes: ["Báo giá", "Quotes"], orders: ["Đơn hàng", "Orders"], invoices: ["Hóa đơn", "Invoices"], payments: ["Thanh toán", "Payments"], support: ["Yêu cầu hỗ trợ", "Support cases"], receivables: ["Công nợ", "Receivables"], products: ["Sản phẩm đã mua", "Purchased products"], history: ["Lịch sử đơn hàng", "Order history"] };
function Records({ module, subject }: { module: RelationshipRecordModule; subject: RelationshipRef }) {
  const { locale } = useI18n(); const vi = locale === "vi";
  const { timeZone } = useWorkspaceRuntimeSettings();
  const workspace = useWorkspaceContextSnapshot();
  const query = useConnectedRelationshipRecords(module, subject);
  return <section data-connected-records={module} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center gap-2 pr-12 sm:justify-between sm:pr-0"><h3 className="text-sm font-semibold">{labels[module][vi ? 0 : 1]}{query.page && <span className="ml-2 font-normal text-slate-500">({query.page.total ?? `${query.page.rows.length}${query.page.next ? "+" : ""}`})</span>}</h3>{query.permitted && <Button variant="secondary" size="xs" disabled={query.loading} onClick={query.refresh}>{vi ? "Tải lại" : "Refresh"}</Button>}</div>
    {!query.permitted ? <p role="status">{vi ? "Bạn chưa có quyền đọc dữ liệu mục này." : "You do not have access to these records."}</p>
      : query.loading && !query.page ? <p role="status">{vi ? "Đang tải…" : "Loading…"}</p>
      : query.error ? <div role="alert"><p>{module === "receivables" && typeof query.error === "object" && "status" in query.error && query.error.status === 404 ? (vi ? "Máy chủ hiện chưa hỗ trợ tra cứu công nợ theo người mua. Chưa có số dư được xác nhận." : "This server does not support buyer account statements yet. No balance has been verified.") : formatApplicationError(query.error, { locale })}</p><Button variant="secondary" onClick={query.refresh}>{vi ? "Thử lại" : "Retry"}</Button></div>
      : !query.page?.rows.length ? <p role="status" className="text-sm text-slate-500">{vi ? "Chưa có bản ghi liên kết được phép đọc." : "No accessible linked records."}</p>
      : <ul className="divide-y divide-slate-100">{query.page.rows.map(row => <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"><div className="min-w-0 flex-1"><Link className="font-medium text-violet-700 hover:underline [overflow-wrap:anywhere]" to={toWorkspacePath(workspace.workspaceKey, "crm", row.href.replace(/^\//, ""))}>{row.title}</Link><p className="mt-1 text-xs text-slate-500">{row.status}{row.businessDate ? ` · ${module === "deals" ? (vi ? "Đóng dự kiến" : "Expected close") : (vi ? "Hiệu lực đến" : "Valid until")}: ${formatDate(row.businessDate, locale)}` : ""}{row.at ? ` · ${formatDateTime(row.at, locale, { timeZone })}` : ""}</p></div>{row.amount && <span>{formatCommercialMoney(row.amount, locale)}</span>}</li>)}</ul>}
    {(query.previous || query.page?.next) && <div className="flex gap-2"><Button variant="secondary" disabled={!query.previous || query.loading} onClick={query.first}>{vi ? "Trang đầu" : "First page"}</Button><Button variant="secondary" disabled={!query.page?.next || query.loading} onClick={query.next}>{vi ? "Xem tiếp" : "Next page"}</Button></div>}
  </section>;
}

export interface CommercialSource { type: "CONTACT" | "CUSTOMER"; id: string; label: string; archived?: boolean }
export function ConnectedRelationshipRecords({ subject, section, source }: { subject: RelationshipRef; section: "sales" | "transactions" | "service"; source?: CommercialSource }) {
  const access = useEffectiveAccess(); const { locale } = useI18n(); const vi = locale === "vi";
  const navigate = useNavigate(); const workspace = useWorkspaceContextSnapshot(); const [params, setParams] = useSearchParams();
  const [creatingDeal, setCreatingDeal] = useState(false); const [createdDeal, setCreatedDeal] = useState<string>();
  const modules: RelationshipRecordModule[] = (section === "sales" ? ["deals", "quotes"] as const : section === "transactions" ? ["orders", "invoices", "payments", "receivables", "products", "history"] as const : ["support"] as const).filter(module => access.can(`${module === "products" || module === "history" ? "orders" : module}.read`));
  const viewIds: Partial<Record<RelationshipRecordModule, string>> = { deals: "opportunities", quotes: "quotations" };
  const module = modules.find(x => (viewIds[x] || x) === params.get("view")) || modules[0];
  const path = (suffix: string) => toWorkspacePath(workspace.workspaceKey, "crm", suffix);
  const directQuote = () => { if (source) navigate(path(`quotes/new?${source.type === "CONTACT" ? "contactId" : "customerId"}=${encodeURIComponent(source.id)}`)); };
  if (!module) return <p role="status">{vi ? "Không có dữ liệu mục này được phép đọc." : "No authorized section is available."}</p>;
  return <div data-connected-relationship-section={section} data-i18n-skip="true" className="space-y-4">
    <RelationshipWorkspace workspaceKey={`${section}-${subject.type}-${subject.id}`} activeId={module} items={modules.map(id => ({ id, label: labels[id][vi ? 0 : 1] }))} onChange={id => { const next = new URLSearchParams(params); next.set("view", viewIds[id as RelationshipRecordModule] || id); setParams(next); }}>
      {source && !source.archived && <div className="mb-3 flex flex-wrap justify-end gap-2">{module === "deals" && access.can("deals.create") && <Button onClick={() => setCreatingDeal(true)}>{vi ? "Tạo cơ hội" : "Create opportunity"}</Button>}{module === "quotes" && access.can("quotes.create") && <Button onClick={directQuote}>{vi ? "Báo giá trực tiếp" : "Direct Sale Quote"}</Button>}</div>}
      {createdDeal && module === "deals" && <p role="status" className="mb-3 text-sm text-emerald-700">{vi ? "Đã tạo cơ hội." : "Opportunity created."} <Link to={path(`deals/${createdDeal}`)}>{vi ? "Mở cơ hội" : "Open opportunity"}</Link></p>}
      <Records key={`${subject.type}:${subject.id}:${module}`} module={module} subject={subject}/>
      {(module === "products" || module === "history") && <p className="mt-3 text-xs text-slate-500">{vi ? "Dữ liệu từ đơn hàng đã hoàn tất. Không suy diễn thanh toán hay mua hàng từ báo giá đã chấp nhận." : "Based on completed Orders. Quote acceptance does not imply payment or completed purchases."}</p>}
      {module === "deals" && access.can("quotes.create") && <p className="mt-3 text-xs text-slate-500">{vi ? "Để lập báo giá từ một cơ hội cụ thể, mở cơ hội đó và chọn Tạo báo giá." : "Open a specific opportunity to create a Quote linked to it."}</p>}
    </RelationshipWorkspace>
    {source && creatingDeal && <BuyerDealForm buyer={subject} label={source.label} open onClose={() => setCreatingDeal(false)} onCreated={setCreatedDeal}/>}
  </div>;
}
