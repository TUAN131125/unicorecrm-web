import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { LeadCustomerConversionResponse } from "@/platform/api/generated/commercialApi";
import { convertLeadToCustomer } from "../infrastructure/convertLeadToCustomer";

export const LeadCustomerConversionPage: React.FC = () => {
  const { leadId = "" } = useParams();
  const [subjectType, setSubjectType] = useState<"CONTACT" | "ORGANIZATION_ACCOUNT">("CONTACT");
  const [subjectId, setSubjectId] = useState("");
  const [version, setVersion] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<LeadCustomerConversionResponse>();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(undefined);
    try {
      setResult(await convertLeadToCustomer(leadId, version, {
        accountSubject: { type: subjectType, mode: "EXISTING", id: subjectId.trim() },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lead conversion failed.");
    } finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-2xl space-y-6 p-6">
    <header><h1 className="text-2xl font-semibold">Convert Lead to Customer</h1>
      <p className="mt-2 text-sm text-muted-foreground">Associate this closed Opportunity Lead with an authoritative CRM subject. This does not create a sale, Quote, or Order.</p></header>
    {result ? <section className="rounded-lg border p-5" aria-live="polite">
      <h2 className="font-semibold">Conversion {result.result.customerResolution === "CREATED" ? "created a Customer" : "reused a Customer"}</h2>
      <p className="mt-2 text-sm">Customer: <Link className="underline" to={`/customers/${result.result.customerId}`}>{result.result.customerId}</Link></p>
      <p className="text-sm">Outcome: {result.outcome}</p>
    </section> : <form className="space-y-4 rounded-lg border p-5" onSubmit={submit}>
      <label className="block text-sm font-medium">Subject type<select className="mt-1 block w-full rounded border p-2" value={subjectType} onChange={e=>setSubjectType(e.target.value as typeof subjectType)}><option value="CONTACT">Contact (B2C)</option><option value="ORGANIZATION_ACCOUNT">Organization (B2B)</option></select></label>
      <label className="block text-sm font-medium">Existing subject ID<input className="mt-1 block w-full rounded border p-2" required value={subjectId} onChange={e=>setSubjectId(e.target.value)} /></label>
      <label className="block text-sm font-medium">Lead version<input className="mt-1 block w-full rounded border p-2" type="number" min={1} required value={version} onChange={e=>setVersion(Number(e.target.value))} /></label>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <button className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy}>{busy ? "Converting…" : "Convert to Customer"}</button>
    </form>}
  </main>;
};
