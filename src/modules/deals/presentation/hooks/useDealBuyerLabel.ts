import React from "react";
import { readContactById } from "@/modules/contacts";
import { readOrganizationById } from "@/modules/organizations";
import { useEffectiveRecordAccessDecision } from "@/platform/access-control";
import type { Deal } from "../../domain/model/deal.types";
import { getDealSelectionAuthority, useDealSelectionAuthority } from "./useDealSelectionQueries";

/** One authorized detail read; never resolves a display name from an unhydrated collection. */
export function useDealBuyerLabel(deal: Deal | undefined) {
  const authority = useDealSelectionAuthority();
  const access = useEffectiveRecordAccessDecision();
  const buyerMode = access?.fieldAccess.buyerRef;
  const permitted = access?.canRead === true && (buyerMode === "READ_WRITE" || buyerMode === "READ_ONLY");
  const type = deal?.buyerRef.type;
  const id = deal?.buyerRef.id;
  const key = JSON.stringify([authority, deal?.id, type, id, permitted]);
  const [state, setState] = React.useState<{ key: string; name?: string; status: "READY" | "UNAVAILABLE" }>();
  React.useEffect(() => {
    if (!permitted || !id || !type) return;
    const controller = new AbortController();
    let retired = false;
    const read = type === "CONTACT"
      ? readContactById(id, controller.signal).then(item => item.fullName || item.name)
      : readOrganizationById(id, controller.signal).then(item => item.displayName);
    void read.then(name => {
      if (!retired && authority === getDealSelectionAuthority()) setState({ key, name: name?.trim(), status: "READY" });
    }).catch(() => {
      // An inaccessible, missing or failed related record never falls back to a cached name or ID.
      if (!retired && authority === getDealSelectionAuthority()) setState({ key, status: "UNAVAILABLE" });
    });
    return () => { retired = true; controller.abort(); };
  }, [authority, id, key, permitted, type]);
  return !permitted ? { status: "RESTRICTED" as const }
    : state?.key === key ? state : { status: "LOADING" as const };
}
