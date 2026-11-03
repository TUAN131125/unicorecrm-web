import React from "react";
import { Link } from "react-router-dom";
import type { BuyerRef } from "@/platform/identity";
import { useEffectiveAccess } from "@/platform/access-control";
import { queryContactPage, readContactById } from "@/modules/contacts";
import { queryOrganizationPage, readOrganizationById } from "@/modules/organizations";
import { readCustomerById, readCustomerPage } from "@/modules/customers/public/api";
import { BuyerContactCreateModal } from "@/modules/contacts/public/BuyerContactCreateModal";
import { BuyerOrganizationCreateModal } from "@/modules/organizations/public/BuyerOrganizationCreateModal";
import { Button, Input, Select } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { toWorkspacePath } from "@/platform/navigation";
import { formatApplicationError } from "@/shared/operations";
import { getDealSelectionAuthority, useDealSelectionAuthority, useDealSelectionQueries } from "./useCommercialSelection";

export interface BuyerChoice { ref: BuyerRef; label: string }
interface Option extends BuyerChoice { identity: string; customerId?: string }
type Source = "contacts" | "organizations" | "customers";

/** Owner reads only. A Customer resolves to its source; it is never a Buyer ID. */
export function BuyerPicker({ value, onChange, error, locked = false }: {
  value: BuyerChoice | null; onChange(value: BuyerChoice | null): void; error?: string; locked?: boolean;
}) {
  const { locale } = useI18n(); const vi = locale === "vi";
  const access = useEffectiveAccess(); const authority = useDealSelectionAuthority();
  const workspace = useWorkspaceContextSnapshot();
  const [type, setType] = React.useState("ALL"); const [search, setSearch] = React.useState("");
  const [customerType, setCustomerType] = React.useState("ALL");
  const [creating, setCreating] = React.useState<"CONTACT" | "ORGANIZATION_ACCOUNT">();
  const [pending, setPending] = React.useState(false); const [failure, setFailure] = React.useState("");
  const selectionRequest = React.useRef<AbortController | undefined>(undefined);
  React.useEffect(() => () => { selectionRequest.current?.abort(); selectionRequest.current = undefined; }, [authority]);
  const [sourceFailures, setSourceFailures] = React.useState<{ key: string; messages: string[] }>();
  const searchKey = JSON.stringify([authority, type, customerType, search.trim()]);
  const [verified, setVerified] = React.useState<{ key: string; label: string }>();
  const key = JSON.stringify([authority, value?.ref]);
  React.useEffect(() => {
    if (!value) return;
    const abort = new AbortController();
    const read = value.ref.type === "CONTACT" ? readContactById(value.ref.id, abort.signal).then(x => x.fullName || x.name)
      : readOrganizationById(value.ref.id, abort.signal).then(x => x.displayName);
    void read.then(label => { if (!abort.signal.aborted) { setVerified({ key, label }); setFailure(""); } })
      .catch(reason => { if (!abort.signal.aborted) { setVerified(undefined); setFailure(formatApplicationError(reason, { locale })); } });
    return () => abort.abort();
  }, [key, locale, value?.ref.id, value?.ref.type]);
  const loader = React.useCallback(async (text: string, cursor: string | undefined, signal: AbortSignal) => {
    const cursors: Partial<Record<Source, string | null>> = cursor ? JSON.parse(cursor) : {};
    const sources: Source[] = [
      ...((type === "ALL" || type === "CONTACT") && access.can("contacts.read") ? ["contacts" as const] : []),
      ...((type === "ALL" || type === "ORGANIZATION_ACCOUNT") && access.can("organizations.read") ? ["organizations" as const] : []),
      ...((type === "ALL" || type === "CUSTOMER") && access.can("customers.view") ? ["customers" as const] : []),
    ];
    const activeSources = sources.filter(source => cursors[source] !== null);
    const responses = await Promise.allSettled(activeSources.map(async source => {
      const token = cursors[source]; const query = { search: text, limit: 20, ...(token ? { cursor: token } : {}) };
      if (source === "contacts") {
        const p = await queryContactPage(query, signal);
        return { source, next: p.pageInfo.nextCursor, items: p.items.map((x): Option => ({ ref: { type: "CONTACT", id: x.id }, label: x.fullName || x.name, identity: [x.contactCode, x.email, x.phone].filter(Boolean).join(" · ") })) };
      }
      if (source === "organizations") {
        const p = await queryOrganizationPage(query, signal);
        return { source, next: p.pageInfo.nextCursor, items: p.items.map((x): Option => ({ ref: { type: "ORGANIZATION_ACCOUNT", id: x.id }, label: x.displayName, identity: [x.legalName, x.taxCode, x.email, x.phone].filter(Boolean).join(" · ") })) };
      }
      const p = await readCustomerPage({ ...query, ...(customerType === "ALL" ? {} : { filters: { type: customerType } }) }, signal);
      return { source, next: p.pageInfo.nextCursor, items: p.items.filter(x => x.relationshipRef?.id && x.status !== "ARCHIVED").map((x): Option => ({ ref: x.relationshipRef, label: x.listIdentity?.displayName || x.customerCode, identity: x.customerCode, customerId: x.id })) };
    }));
    signal.throwIfAborted();
    const pages: { source: Source; next: string | undefined; items: Option[] }[] = [];
    const messages: string[] = [];
    for (const [index, result] of responses.entries()) {
      if (result.status === "fulfilled") pages.push(result.value);
      else messages.push(`${activeSources[index] === "customers" ? "Customer" : activeSources[index] === "contacts" ? (locale === "vi" ? "Liên hệ" : "Contact") : (locale === "vi" ? "Tổ chức" : "Organization")}: ${formatApplicationError(result.reason, { locale })}`);
    }
    setSourceFailures({ key: JSON.stringify([authority, type, customerType, text]), messages });
    if (responses.length && !pages.length) { const rejected = responses.find(x => x.status === "rejected"); if (rejected?.status === "rejected") throw rejected.reason; }
    const next = { ...cursors }; for (const p of pages) next[p.source] = p.next || null;
    // Do not imply complete cross-owner pagination when a source failed. The user can
    // narrow to a successful source or retry; records from successful owners remain usable.
    const hasNextPage = messages.length === 0 && Object.values(next).some(Boolean);
    return { items: pages.flatMap(p => p.items), pageInfo: { hasNextPage, ...(hasNextPage ? { nextCursor: JSON.stringify(next) } : {}) }, loadedAt: new Date().toISOString(), authority: "backend" as const };
  }, [access, type, customerType, authority, locale]);
  const query = useDealSelectionQueries(search, loader, JSON.stringify([type, customerType]));
  const choose = async (option: Option) => {
    if (selectionRequest.current) return;
    const request = new AbortController(); selectionRequest.current = request;
    setPending(true); setFailure("");
    try {
      const customer = option.customerId ? await readCustomerById(option.customerId, request.signal) : undefined;
      const ref = customer ? customer.relationshipRef : option.ref;
      if (customer?.status === "ARCHIVED" || !ref?.id) throw new Error("BUYER_SOURCE_UNAVAILABLE");
      const label = ref.type === "CONTACT" ? (await readContactById(ref.id, request.signal)).fullName : (await readOrganizationById(ref.id, request.signal)).displayName;
      if (!request.signal.aborted && authority === getDealSelectionAuthority()) onChange({ ref, label });
    } catch (reason) { if (!request.signal.aborted && authority === getDealSelectionAuthority()) setFailure(formatApplicationError(reason, { locale })); }
    finally { if (selectionRequest.current === request) { selectionRequest.current = undefined; setPending(false); } }
  };
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" data-buyer-picker data-i18n-skip="true">
    {value && <div className="flex items-center justify-between gap-2 rounded-lg bg-violet-50 p-3"><p className="text-sm">{verified?.key === key ? verified.label : value.label}<small className="block text-slate-500">{value.ref.type === "CONTACT" ? (vi ? "Liên hệ" : "Contact") : (vi ? "Tổ chức" : "Organization")}</small></p>{!locked && <Button type="button" variant="secondary" size="xs" onClick={() => onChange(null)}>{vi ? "Xóa lựa chọn" : "Clear selection"}</Button>}</div>}
    {!locked && <>
      <Input disabled={pending} label={vi ? "Tìm người mua" : "Search buyers"} value={search} onChange={e => setSearch(e.target.value)} />
      <Select disabled={pending} label={vi ? "Loại người mua" : "Buyer type"} value={type} onChange={e => { const next = e.target.value; setType(next); setCustomerType("ALL"); setSearch(""); if (value && next !== "ALL" && next !== "CUSTOMER" && value.ref.type !== next) onChange(null); }}><option value="ALL">{vi ? "Tất cả" : "All"}</option><option value="CONTACT">{vi ? "Liên hệ" : "Contact"}</option><option value="ORGANIZATION_ACCOUNT">{vi ? "Tổ chức" : "Organization"}</option><option value="CUSTOMER">Customer</option></Select>
      {type === "CUSTOMER" && <Select disabled={pending} label={vi ? "Loại khách hàng" : "Customer type"} value={customerType} onChange={e => { setCustomerType(e.target.value); if (value && ((e.target.value === "B2B" && value.ref.type !== "ORGANIZATION_ACCOUNT") || (e.target.value === "B2C" && value.ref.type !== "CONTACT"))) onChange(null); }}><option value="ALL">{vi ? "Tất cả" : "All"}</option><option value="B2C">B2C</option><option value="B2B">B2B</option></Select>}
      {sourceFailures?.key === searchKey && sourceFailures.messages.length > 0 && <div role="status" className="space-y-1 text-xs text-amber-700">{sourceFailures.messages.map(message => <p key={message}>{message}</p>)}<p>{vi ? "Một số nguồn chưa tải được. Chọn loại người mua để tìm và phân trang trong nguồn phù hợp, hoặc Làm mới để thử lại." : "Some sources could not be loaded. Select a buyer type to search and paginate that source, or Refresh to retry."}</p></div>}
      <div className="max-h-56 space-y-1 overflow-y-auto" aria-live="polite">{query.loading ? <p>{vi ? "Đang tìm…" : "Searching…"}</p> : query.error ? <><p role="alert">{query.error}</p><Button type="button" variant="secondary" onClick={query.reload}>{vi ? "Thử lại" : "Retry"}</Button></> : query.items.length ? query.items.map(x => <button type="button" disabled={pending} key={`${x.customerId || x.ref.type}:${x.customerId || x.ref.id}`} onClick={() => void choose(x)} className="block w-full rounded-lg border border-slate-100 p-2 text-left hover:bg-violet-50"><span className="text-sm font-medium">{x.label}</span><small className="block text-slate-500">{x.customerId ? "Customer · " : ""}{x.ref.type === "CONTACT" ? (vi ? "Liên hệ" : "Contact") : (vi ? "Tổ chức" : "Organization")} · {x.identity}</small></button>) : <p>{vi ? "Không tìm thấy người mua được phép đọc." : "No accessible buyers found."}</p>}</div>
      <div className="flex gap-2"><Button type="button" variant="secondary" size="xs" onClick={query.firstPage}>{vi ? "Trang đầu" : "First page"}</Button>{query.next && <Button type="button" variant="secondary" size="xs" disabled={pending} onClick={query.nextPage}>{vi ? "Trang tiếp" : "Next page"}</Button>}<Button type="button" variant="secondary" size="xs" onClick={query.reload}>{vi ? "Làm mới" : "Refresh"}</Button></div>
      <p className="flex gap-3 text-xs">{access.can("contacts.create") && <Link target="_blank" to={toWorkspacePath(workspace.workspaceKey, "crm", "contacts")}>{vi ? "Mở danh sách để tạo Liên hệ" : "Create a Contact from the directory"}</Link>}{access.can("organizations.create") && <Link target="_blank" to={toWorkspacePath(workspace.workspaceKey, "crm", "organizations")}>{vi ? "Mở danh sách để tạo Tổ chức" : "Create an Organization from the directory"}</Link>}</p>
      <div className="flex flex-wrap gap-2">{access.can("contacts.create") && <Button type="button" variant="secondary" size="xs" disabled={pending} onClick={() => setCreating("CONTACT")}>{vi ? "Tạo nhanh liên hệ" : "Create Contact"}</Button>}{access.can("organizations.create") && <Button type="button" variant="secondary" size="xs" disabled={pending} onClick={() => setCreating("ORGANIZATION_ACCOUNT")}>{vi ? "Tạo nhanh tổ chức" : "Create Organization"}</Button>}</div>
    </>}
    {(error || failure) && <p role="alert" className="text-xs italic text-red-600">{error || failure}</p>}
    {creating === "CONTACT" && access.can("contacts.create") && <BuyerContactCreateModal onClose={() => setCreating(undefined)} onCreated={contact => { setCreating(undefined); void choose({ ref: { type: "CONTACT", id: contact.id }, label: contact.fullName || contact.name, identity: "" }); }}/>}
    {creating === "ORGANIZATION_ACCOUNT" && access.can("organizations.create") && <BuyerOrganizationCreateModal isOpen actorId={access.memberId || ""} onClose={() => setCreating(undefined)} onCreated={organization => { setCreating(undefined); void choose({ ref: { type: "ORGANIZATION_ACCOUNT", id: organization.id }, label: organization.displayName, identity: "" }); }}/>}
  </section>;
}
