import React from "react";
import { queryContactPage, readContactById } from "@/modules/contacts";
import { getDealSelectionAuthority, useDealSelectionAuthority, useDealSelectionQueries } from "@/modules/deals";
import { Button, Input } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";

const load = (search: string, cursor: string | undefined, signal: AbortSignal) => queryContactPage({ search, limit: 20, ...(cursor ? { cursor } : {}) }, signal);
export function QualificationContactPicker({ id, onChange, locale, error }: { id?: string; onChange(id: string): void; locale: string; error?: string }) {
  const vi = locale === "vi";
  const authority = useDealSelectionAuthority();
  const [search, setSearch] = React.useState("");
  const query = useDealSelectionQueries(search, load);
  const [selected, setSelected] = React.useState<{ key: string; label: string; error: string }>();
  const epoch = React.useRef({ authority, generation: 0 });
  if (epoch.current.authority !== authority) epoch.current = { authority, generation: epoch.current.generation + 1 };
  const key = JSON.stringify([authority, epoch.current.generation, id]);
  React.useEffect(() => {
    const controller = new AbortController(); let retired = false;
    setSelected(undefined);
    if (id) void readContactById(id, controller.signal).then(contact => {
      if (!retired && !controller.signal.aborted && authority === getDealSelectionAuthority()) setSelected({ key, label: [contact.fullName || contact.name, contact.contactCode, contact.email, contact.phone, id].filter(Boolean).join(" · "), error: "" });
    }).catch(caught => { if (!retired && !controller.signal.aborted) setSelected({ key, label: "", error: formatApplicationError(caught, { locale }) }); });
    return () => { retired = true; controller.abort(); };
  }, [authority, id, key, locale]);
  return <section data-guidance-id="leads.qualification.contact" className="space-y-2">
    <Input id="qualification-relationship-selected" label={vi ? "Tìm Contact theo tên, email hoặc mã" : "Search Contact by name, email or code"} value={search} onChange={event => setSearch(event.target.value)} error={error} />
    {id && <p data-testid="qualification-selected-contact">{selected?.key === key ? selected.label || selected.error : (vi ? "Đang xác minh Contact…" : "Verifying Contact…")}</p>}
    {query.loading ? <p>{vi ? "Đang tìm…" : "Searching…"}</p> : query.error ? <><p role="alert">{query.error}</p><Button type="button" onClick={query.reload}>{vi ? "Thử lại" : "Retry"}</Button></> : query.items.length === 0 ? <p>{vi ? "Không tìm thấy Contact." : "No Contacts found."}</p> : query.items.map(contact => <Button type="button" variant="secondary" key={contact.id} disabled={contact.id === id} onClick={() => onChange(contact.id)}>{[contact.fullName || contact.name, contact.contactCode, contact.email, contact.phone, contact.id].filter(Boolean).join(" · ")}</Button>)}
    <Button type="button" variant="secondary" onClick={query.firstPage}>{vi ? "Trang đầu" : "First page"}</Button>
    {query.next && <Button type="button" variant="secondary" onClick={query.nextPage}>{vi ? "Trang tiếp" : "Next page"}</Button>}
  </section>;
}
