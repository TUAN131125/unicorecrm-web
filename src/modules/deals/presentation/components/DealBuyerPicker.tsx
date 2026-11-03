import { BuyerPicker } from "@/components/crm/BuyerPicker";
import type { BuyerRef } from "@/platform/identity";
import { queryContactPage } from "@/modules/contacts";
import { queryOrganizationPage } from "@/modules/organizations";

export async function loadDealBuyers(type: BuyerRef["type"], search: string, cursor: string | undefined, signal: AbortSignal) {
  const query = { search, limit: 20, ...(cursor ? { cursor } : {}) };
  if (type === "CONTACT") {
    const page = await queryContactPage(query, signal);
    return { ...page, items: page.items.map(item => ({ ref: { type: "CONTACT" as const, id: item.id }, label: item.fullName || item.name, identity: [item.contactCode, item.email, item.phone].filter(Boolean).join(" · ") })) };
  }
  const page = await queryOrganizationPage(query, signal);
  return { ...page, items: page.items.map(item => ({ ref: { type: "ORGANIZATION_ACCOUNT" as const, id: item.id }, label: item.displayName, identity: item.legalName || "" })) };
}
export function DealBuyerPicker({ value, label, onChange, error, locked }: { value?: BuyerRef; label: string; onChange(ref: BuyerRef | undefined, label: string): void; error?: string; locked?: boolean }) {
  return <div data-guidance-id="deals.form.buyer"><BuyerPicker value={value ? { ref: value, label } : null} onChange={choice => onChange(choice?.ref, choice?.label || "")} error={error} locked={locked} /></div>;
}
