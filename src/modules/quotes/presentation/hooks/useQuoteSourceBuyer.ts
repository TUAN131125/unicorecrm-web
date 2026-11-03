import { useEffect, useState } from "react";
import type { BuyerRef } from "@/platform/identity";
import { readContactById } from "@/modules/contacts";
import { readOrganizationById } from "@/modules/organizations";
import { readCustomerById } from "@/modules/customers";
import { useDealSelectionAuthority } from "@/components/crm/useCommercialSelection";
import { formatApplicationError } from "@/shared/operations";
import { useI18n } from "@/i18n";

/** URL identifiers are locators, never trusted Buyer identity or cached presentation. */
export function useQuoteSourceBuyer(enabled: boolean, contactId: string | null, customerId: string | null, organizationId: string | null) {
  const authority = useDealSelectionAuthority(); const { locale } = useI18n();
  const key = JSON.stringify([authority, enabled, contactId, customerId, organizationId]);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; buyer?: BuyerRef; label?: string; error?: string }>();
  const required = enabled && Boolean(contactId || customerId || organizationId);
  useEffect(() => {
    if (!required) return;
    const abort = new AbortController();
    void (async () => {
      let ref: BuyerRef;
      if (customerId) {
        const customer = await readCustomerById(customerId, abort.signal);
        if (customer.status === "ARCHIVED" || !customer.relationshipRef?.id) throw new Error("CUSTOMER_SOURCE_UNAVAILABLE");
        ref = customer.relationshipRef;
      } else ref = contactId ? { type: "CONTACT", id: contactId } : { type: "ORGANIZATION_ACCOUNT", id: organizationId || "" };
      const label = ref.type === "CONTACT" ? (await readContactById(ref.id, abort.signal)).fullName : (await readOrganizationById(ref.id, abort.signal)).displayName;
      if (!abort.signal.aborted) setState({ key, buyer: ref, label });
    })().catch(error => { if (!abort.signal.aborted) setState({ key, error: formatApplicationError(error, { locale }) }); });
    return () => abort.abort();
  }, [key, required, contactId, customerId, organizationId, locale, retry]);
  const current = state?.key === key ? state : undefined;
  return { required, buyer: current?.buyer, label: current?.label, error: current?.error,
    loading: required && !current, retry: () => { setState(undefined); setRetry(x => x + 1); } };
}
