import { useEffect, useState } from "react";
import type { BuyerRef } from "@/platform/identity";
import { queryContactPage } from "@/modules/contacts";
import { queryOrganizationPage } from "@/modules/organizations";
import { formatApplicationError } from "@/shared/operations";
import { Input, Select } from "@/shared/components/ui";

/** Buyer options are owner reads; the Quote command verifies eligibility again. */
export function QuoteBuyerSelector({ value, onChange, locale, validationError }: {
  value: { ref: BuyerRef; label: string } | null;
  onChange(value: { ref: BuyerRef; label: string } | null): void;
  locale: string;
  validationError?: string;
}) {
  const [type, setType] = useState<BuyerRef["type"]>("CONTACT");
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setOptions([]); setError(""); setLoading(true);
    const timer = setTimeout(() => {
      const query = { search, limit: 50 };
      const load = type === "CONTACT"
        ? queryContactPage(query, abort.signal).then(page => page.items.map(item => ({ id: item.id, label: item.fullName || item.name || item.id })))
        : queryOrganizationPage(query, abort.signal).then(page => page.items.map(item => ({ id: item.id, label: item.displayName || item.id })));
      void load.then(items => { if (!abort.signal.aborted) setOptions(items); })
        .catch(reason => { if (!abort.signal.aborted) setError(formatApplicationError(reason, { locale })); })
        .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [type, search, locale]);
  return <div tabIndex={-1} data-quote-error-target="quote-buyer" className="space-y-3 rounded-xl border border-slate-200 bg-white p-5" data-guidance-id="quotes.buyer.select">
    <Select label={locale === "vi" ? "Loại người mua" : "Buyer type"} value={type} onChange={event => { setType(event.target.value === "CONTACT" ? "CONTACT" : "ORGANIZATION_ACCOUNT"); onChange(null); }}>
      <option value="CONTACT">Contact</option><option value="ORGANIZATION_ACCOUNT">{locale === "vi" ? "Tổ chức" : "Organization"}</option>
    </Select>
    <Input label={locale === "vi" ? "Tìm người mua" : "Search buyers"} value={search} onChange={event => setSearch(event.target.value)} />
    <Select error={validationError} label={locale === "vi" ? "Người mua *" : "Buyer *"} value={value?.ref.id || ""} disabled={loading} onChange={event => { const option = options.find(item => item.id === event.target.value); onChange(option ? { ref: { type, id: option.id }, label: option.label } : null); }}>
      <option value="">{loading ? (locale === "vi" ? "Đang tải…" : "Loading…") : (locale === "vi" ? "Chọn người mua" : "Select buyer")}</option>
      {value && !options.some(option => option.id === value.ref.id) && <option value={value.ref.id}>{value.label}</option>}
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </Select>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
