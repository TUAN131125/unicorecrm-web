import React from "react";
import { resolveProductSelectionIds, type ProductSelection } from "@/modules/products";
import { MutationCommandError } from "@/shared/application";
import { formatApplicationError } from "@/shared/operations";
import { useI18n } from "@/i18n";
import { getDealSelectionAuthority, useDealSelectionAuthority } from "./useDealSelectionQueries";

export function useDealProductSelection(ids: readonly string[]) {
  const authority = useDealSelectionAuthority();
  const retirement = React.useRef({ authority, generation: 0 });
  if (retirement.current.authority !== authority) retirement.current = { authority, generation: retirement.current.generation + 1 };
  const generation = retirement.current.generation;
  const { locale } = useI18n();
  const idsKey = JSON.stringify(ids);
  const key = JSON.stringify([authority, generation, idsKey]);
  const [retry, setRetry] = React.useState(0);
  const [state, setState] = React.useState<{ key: string; items: ProductSelection[]; loading: boolean; error: string }>({ key: "", items: [], loading: true, error: "" });
  React.useEffect(() => {
    const controller = new AbortController(); let retired = false;
    const selectedIds: string[] = JSON.parse(idsKey);
    setState({ key, items: [], loading: selectedIds.length > 0, error: "" });
    void resolveProductSelectionIds(selectedIds, controller.signal).then(items => {
      if (!retired && !controller.signal.aborted && authority === getDealSelectionAuthority() && generation === retirement.current.generation)
        setState({ key, items, loading: false, error: "" });
    }).catch(error => {
      if (!retired && !controller.signal.aborted && authority === getDealSelectionAuthority() && generation === retirement.current.generation)
        setState({ key, items: [], loading: false, error: formatApplicationError(error, { locale }) });
    });
    return () => { retired = true; controller.abort(); };
  }, [authority, generation, idsKey, key, locale, retry]);
  const current = state.key === key ? state : { items: [], loading: ids.length > 0, error: "" };
  return { ...current, retry: () => setRetry(value => value + 1) };
}

/** Verify visibility under the current principal; mutation eligibility remains backend-owned. */
export async function verifyDealProductSelection(ids: readonly string[], authority: string, signal?: AbortSignal): Promise<void> {
  const items = await resolveProductSelectionIds(ids, signal);
  if (authority !== getDealSelectionAuthority())
    throw new MutationCommandError({ code: "DEAL_SELECTION_AUTHORITY_CHANGED", message: "Product selection authority changed. Reopen the opportunity.", category: "AUTHORIZATION", retryable: false });
  if (ids.some(id => !items.some(item => item.id === id)))
    throw new MutationCommandError({ code: "DEAL_PRODUCT_REFERENCE_UNAVAILABLE", message: "Some selected products cannot be verified. Review the selection and try again.", category: "VALIDATION", retryable: false, fieldErrors: { interestedProductIds: ["Some selected products cannot be verified."] } });
}
