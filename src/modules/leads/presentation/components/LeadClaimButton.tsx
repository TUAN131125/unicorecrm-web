import { useI18n } from "@/i18n";
export function LeadClaimButton({ leadId, pending, onClaim }: { leadId: string; pending: boolean; onClaim: (leadId: string) => void }) {
  const { locale } = useI18n();
  return <button type="button" data-guidance-id="leads.list.claim" disabled={pending} aria-busy={pending} onClick={(event) => { event.stopPropagation(); onClaim(leadId); }} className="rounded px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
    {pending ? (locale === "vi" ? "Đang nhận…" : "Claiming…") : (locale === "vi" ? "Nhận Lead" : "Claim Lead")}
  </button>;
}
