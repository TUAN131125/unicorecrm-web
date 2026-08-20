import { useMemo } from "react";
import { useAuthoritativeResource } from "@/shared/operations";
import {
  getAccountStatementResource,
  getInvoiceDetailResource,
  getInvoiceWorkspaceResource,
  getReceivableDetailResource,
  getReceivablesWorkspaceResource,
} from "../../public/api";

export function useInvoiceWorkspaceQuery() {
  return useAuthoritativeResource(getInvoiceWorkspaceResource());
}

export function useReceivablesWorkspaceQuery() {
  return useAuthoritativeResource(getReceivablesWorkspaceResource());
}

export function useInvoiceDetailQuery(invoiceId: string) {
  const resource = useMemo(() => getInvoiceDetailResource(invoiceId), [invoiceId]);
  return useAuthoritativeResource(resource);
}

export function useReceivableDetailQuery(invoiceId: string) {
  const resource = useMemo(() => getReceivableDetailResource(invoiceId), [invoiceId]);
  return useAuthoritativeResource(resource);
}

export function useAccountStatementQuery(buyerId: string) {
  const resource = useMemo(() => getAccountStatementResource(buyerId), [buyerId]);
  return useAuthoritativeResource(resource);
}
