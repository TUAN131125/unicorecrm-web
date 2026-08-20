import { useMemo } from "react";
import { useAuthoritativeResource } from "@/shared/operations";
import { getPaymentRecordDetailResource, getPaymentWorkspaceResource } from "../../public/api";

export function usePaymentWorkspaceQuery() {
  return useAuthoritativeResource(getPaymentWorkspaceResource());
}

export function usePaymentRecordDetailQuery(paymentRecordId: string) {
  const resource = useMemo(() => getPaymentRecordDetailResource(paymentRecordId), [paymentRecordId]);
  return useAuthoritativeResource(resource);
}
