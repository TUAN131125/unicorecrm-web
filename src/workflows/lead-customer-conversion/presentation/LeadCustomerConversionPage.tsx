import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTargetBoundWorkflow } from "@/shared/presentation/useTargetBoundWorkflow";
import { Link, useParams } from "react-router-dom";
import { getLeadDetailResource, useLeadAuthoritativeResource } from "@/modules/leads";
import { invalidateModuleQueries } from "@/shared/application";
import { AuthoritativeQueryBoundary, formatApplicationError } from "@/shared/operations";
import { convertLeadToCustomer, isLeadConversionInProgress, type LeadConversionOutcome } from "@/workflows/lead-customer-conversion";
import { isLeadCustomerConversionSuppressed, retainOrCreateConversionIntent, type LeadCustomerConversionIntent as ConversionIntent } from "../application/conversionIntent";


export const LeadCustomerConversionPage: React.FC = () => {
  const { leadId = "" } = useParams();
  const lifecycle = useTargetBoundWorkflow(leadId, "Lead customer conversion");
  const targetId = lifecycle.targetId ?? "";
  const resource = useMemo(() => getLeadDetailResource(targetId || "__missing__"), [targetId]);
  const query = useLeadAuthoritativeResource(resource, { enabled: Boolean(targetId) });
  const [subjectType, setSubjectType] = useState<ConversionIntent["subjectType"]>("CONTACT");
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<LeadConversionOutcome>();
  const intent = useRef<ConversionIntent | undefined>(undefined);
  const authoritativeCustomerRef = query.data?.customerRef;

  const initialized = useRef<number | undefined>(undefined);
  const reset = () => { intent.current = undefined; setSubjectType("CONTACT"); setSubjectId(""); setError(undefined); setResult(undefined); };
  useEffect(() => {
    if (initialized.current !== lifecycle.cycle) { initialized.current = lifecycle.cycle; reset(); }
  });
  const saveRef = useRef<() => Promise<boolean>>(async () => false);
  lifecycle.register(Boolean(!result && (subjectType !== "CONTACT" || subjectId !== "" || intent.current)), reset, () => saveRef.current());

  const convert = async (): Promise<boolean> => {
    if (!lifecycle.begin()) return false;
    const normalizedSubjectId = subjectId.trim(); const expectedVersion = query.data?.resourceVersion;
    if (!normalizedSubjectId || query.data?.id !== targetId || expectedVersion === undefined) { setError("The authoritative Lead version is unavailable. Refresh the Lead and try again."); lifecycle.finish(); return false; }
    const current = retainOrCreateConversionIntent(intent.current, { subjectType, subjectId: normalizedSubjectId, expectedVersion }, () => crypto.randomUUID());
    intent.current = current; setBusy(true); setError(undefined);
    try {
      const response = await convertLeadToCustomer(targetId, current.expectedVersion, current.idempotencyKey, {
        accountSubject: { type: current.subjectType, mode: "EXISTING", id: current.subjectId },
      });
      await invalidateModuleQueries({ moduleKeys: ["leads", "customers"], commandType: "lead.convert-to-customer", aggregateId: targetId, occurredAt: response.occurredAt });
      if (lifecycle.isCurrent()) setResult(response);
      return true;
    } catch (caught) {
      if (!lifecycle.isCurrent()) return false;
      if (!isLeadConversionInProgress(caught)) intent.current = undefined;
      setError(formatApplicationError(caught));
      return false;
    } finally { lifecycle.finish(); if (lifecycle.isCurrent()) setBusy(false); }
  };

  saveRef.current = convert;
  const submit = (event: React.FormEvent) => { event.preventDefault(); void convert(); };

  return <AuthoritativeQueryBoundary query={query} hasData={Boolean(query.data)} loadingTitleVi="Đang tải Lead" loadingTitleEn="Loading Lead" errorTitleVi="Không thể tải Lead" errorTitleEn="Lead could not be loaded">
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header><h1 className="text-2xl font-semibold">Convert Lead to Customer</h1>
        <p className="mt-2 text-sm text-muted-foreground">Associate this Lead with an authoritative existing CRM subject and create or reuse its exact-subject Customer. No Deal, Quote, Order, or Direct Sale is required or created.</p></header>
      {isLeadCustomerConversionSuppressed(authoritativeCustomerRef) ? <section className="rounded-lg border p-5"><h2 className="font-semibold">Lead already converted</h2><p className="mt-2 text-sm">Customer: <Link className="underline" to={`/customers/${authoritativeCustomerRef}`}>{authoritativeCustomerRef}</Link></p></section>
      : result ? <section className="rounded-lg border p-5" aria-live="polite"><h2 className="font-semibold">Conversion {result.result.customerResolution === "CREATED" ? "created a Customer" : "reused a Customer"}</h2><p className="mt-2 text-sm">Customer: <Link className="underline" to={`/customers/${result.result.customerId}`}>{result.result.customerId}</Link></p><p className="text-sm">Resolution: {result.result.customerResolution}</p><p className="text-sm">Outcome: {result.outcome}</p></section>
      : <form className="space-y-4 rounded-lg border p-5" onSubmit={submit}>
        <label className="block text-sm font-medium">Subject type<select className="mt-1 block w-full rounded border p-2" disabled={busy || Boolean(intent.current)} value={subjectType} onChange={e=>{ intent.current = undefined; setError(undefined); setSubjectType(e.target.value as ConversionIntent["subjectType"]); }}><option value="CONTACT">Contact (B2C)</option><option value="ORGANIZATION_ACCOUNT">Organization (B2B)</option></select></label>
        <label className="block text-sm font-medium">Existing subject ID<input className="mt-1 block w-full rounded border p-2" required disabled={busy || Boolean(intent.current)} value={subjectId} onChange={e=>{ intent.current = undefined; setError(undefined); setSubjectId(e.target.value); }} /></label>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || query.data?.resourceVersion === undefined}>{busy ? "Converting…" : intent.current ? "Retry conversion" : "Convert to Customer"}</button>
      </form>}
    </main>
  </AuthoritativeQueryBoundary>;
};
