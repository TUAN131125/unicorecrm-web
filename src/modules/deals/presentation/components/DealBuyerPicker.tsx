import React from "react";
import type { BuyerRef } from "@/platform/identity";
import { queryContactPage, readContactById } from "@/modules/contacts";
import { queryOrganizationPage, readOrganizationById } from "@/modules/organizations";
import { Input, Button, Select } from "@/shared/components/ui";
import type { AuthoritativePage } from "@/shared/application";
import { useI18n } from "@/i18n";
import { useDealSelectionQueries, useDealSelectionAuthority, getDealSelectionAuthority } from "../hooks/useDealSelectionQueries";

interface BuyerOption { ref: BuyerRef; label: string; identity: string }
export async function loadDealBuyers(type: BuyerRef["type"], search: string, cursor: string | undefined, signal: AbortSignal): Promise<AuthoritativePage<BuyerOption>> {
  const query = { search, limit: 20, ...(cursor ? { cursor } : {}) };
  if (type === "CONTACT") {
    const page = await queryContactPage(query, signal);
    return { ...page, items: page.items.map(item => ({ ref: { type: "CONTACT", id: item.id }, label: item.fullName || item.name || item.id, identity: [item.contactCode, item.email, item.phone, item.id].filter(Boolean).join(" · ") })) };
  }
  const page = await queryOrganizationPage(query, signal);
  return { ...page, items: page.items.map(item => ({ ref: { type: "ORGANIZATION_ACCOUNT", id: item.id }, label: item.displayName || item.id, identity: [item.legalName, item.id].filter(Boolean).join(" · ") })) };
}

export function DealBuyerPicker({ value, label, onChange, error }: { value?: BuyerRef; label: string; onChange(ref: BuyerRef, label: string): void; error?: string }) {
  const { locale } = useI18n(); const vi = locale === "vi";
  const [type, setType] = React.useState<BuyerRef["type"]>(value?.type ?? "CONTACT");
  const [search, setSearch] = React.useState("");
  const authority = useDealSelectionAuthority();
  const [selected, setSelected] = React.useState<{ key: string; label: string }>();
  const selectedKey = JSON.stringify([authority, value]);
  React.useEffect(() => {
    if (!value) return;
    const controller = new AbortController(); let retired = false;
    const read = value.type === "CONTACT" ? readContactById(value.id, controller.signal).then(item => item.fullName || item.name || item.id)
      : readOrganizationById(value.id, controller.signal).then(item => item.displayName || item.id);
    void read.then(name => { if (!retired && authority === getDealSelectionAuthority()) setSelected({ key: selectedKey, label: name }); }).catch(() => { if (!retired) setSelected(undefined); });
    return () => { retired = true; controller.abort(); };
  }, [authority, selectedKey, value]);
  const loader = React.useCallback((text: string, cursor: string | undefined, signal: AbortSignal) => loadDealBuyers(type, text, cursor, signal), [type]);
  const query = useDealSelectionQueries(search, loader);
  return <section data-guidance-id="deals.form.buyer" className="space-y-2">
    <Select label={vi ? "Loại người mua" : "Buyer type"} value={type} onChange={event => { setType(event.target.value === "CONTACT" ? "CONTACT" : "ORGANIZATION_ACCOUNT"); setSearch(""); }}><option value="CONTACT">Contact</option><option value="ORGANIZATION_ACCOUNT">Organization Account</option></Select>
    <Input id="deal-buyer-search" label={vi ? "Tìm người mua" : "Search buyers"} value={search} onChange={event => setSearch(event.target.value)} error={error} />
    {value && <p className="text-sm" data-testid="deal-selected-buyer">{selected?.key === selectedKey ? selected.label : label || value.id} · {value.type} · {value.id}</p>}
    <div aria-live="polite">{query.loading ? (vi ? "Đang tải…" : "Loading…") : query.error ? <><p role="alert">{query.error}</p><Button type="button" onClick={query.reload}>{vi ? "Thử lại" : "Retry"}</Button></> : query.items.length === 0 ? (vi ? "Không tìm thấy bản ghi." : "No records found.") : query.items.map(item => <button type="button" key={item.ref.id} className="block w-full rounded border p-2 text-left text-sm" onClick={() => onChange(item.ref, item.label)}><span>{item.label}</span><small className="block">{item.identity}</small></button>)}</div>
    <Button type="button" variant="secondary" size="xs" onClick={query.firstPage}>{vi ? "Trang đầu" : "First page"}</Button>
    {query.next && <Button type="button" variant="secondary" size="xs" onClick={query.nextPage}>{vi ? "Trang tiếp" : "Next page"}</Button>}
  </section>;
}
