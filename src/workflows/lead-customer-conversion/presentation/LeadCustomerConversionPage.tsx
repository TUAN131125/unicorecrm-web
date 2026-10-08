import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTargetBoundWorkflow } from "@/shared/presentation/useTargetBoundWorkflow";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { getLeadDetailResource, useLeadAuthoritativeResource } from "@/modules/leads";
import { invalidateModuleQueries } from "@/shared/application";
import { AuthoritativeQueryBoundary, formatApplicationError } from "@/shared/operations";
import { convertLeadToCustomer, isLeadConversionInProgress, type LeadConversionOutcome } from "@/workflows/lead-customer-conversion";
import { isLeadCustomerConversionSuppressed, retainOrCreateConversionIntent, type LeadCustomerConversionIntent as ConversionIntent } from "../application/conversionIntent";


export const LeadCustomerConversionPage: React.FC = () => {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
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
    if (!normalizedSubjectId || query.data?.id !== targetId || expectedVersion === undefined) { setError(text("Chưa tải được phiên bản Lead. Hãy tải lại và thử lại.", "The authoritative Lead version is unavailable. Refresh the Lead and try again.")); lifecycle.finish(); return false; }
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
      setError(formatApplicationError(caught, { locale }));
      return false;
    } finally { lifecycle.finish(); if (lifecycle.isCurrent()) setBusy(false); }
  };

  saveRef.current = convert;
  const submit = (event: React.FormEvent) => { event.preventDefault(); void convert(); };

  return <AuthoritativeQueryBoundary query={query} hasData={Boolean(query.data)} loadingTitleVi="Đang tải Lead" loadingTitleEn="Loading Lead" errorTitleVi="Không thể tải Lead" errorTitleEn="Lead could not be loaded">
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header><h1 className="text-2xl font-semibold">{text("Chuyển Lead thành khách hàng", "Convert Lead to Customer")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{text("Liên kết Lead với cá nhân hoặc tổ chức đã có trong CRM để tạo hoặc sử dụng hồ sơ khách hàng tương ứng. Không cần tạo cơ hội, báo giá hay đơn hàng.", "Associate this Lead with an authoritative existing CRM subject and create or reuse its exact-subject Customer. No Deal, Quote, Order, or Direct Sale is required or created.")}</p></header>
      {isLeadCustomerConversionSuppressed(authoritativeCustomerRef) ? <section className="rounded-lg border p-5"><h2 className="font-semibold">{text("Lead đã được chuyển đổi", "Lead already converted")}</h2><p className="mt-2 text-sm">{text("Khách hàng:", "Customer:")} <Link className="underline" to={`/customers/${authoritativeCustomerRef}`}>{authoritativeCustomerRef}</Link></p></section>
      : result ? <section className="rounded-lg border p-5" aria-live="polite"><h2 className="font-semibold">{result.result.customerResolution === "CREATED" ? text("Đã tạo khách hàng", "Conversion created a Customer") : text("Đã sử dụng hồ sơ khách hàng hiện có", "Conversion reused a Customer")}</h2><p className="mt-2 text-sm">{text("Khách hàng:", "Customer:")} <Link className="underline" to={`/customers/${result.result.customerId}`}>{result.result.customerId}</Link></p><p className="text-sm">{text("Cách xử lý:", "Resolution:")} {result.result.customerResolution}</p><p className="text-sm">{text("Kết quả:", "Outcome:")} {result.outcome}</p></section>
      : <form className="crm-form-surface space-y-4 rounded-lg border p-5" onSubmit={submit}>
        <label className="block text-sm font-medium">{text("Loại đối tượng", "Subject type")}<select className="mt-1 block w-full rounded border p-2" disabled={busy || Boolean(intent.current)} value={subjectType} onChange={e=>{ intent.current = undefined; setError(undefined); setSubjectType(e.target.value as ConversionIntent["subjectType"]); }}><option value="CONTACT">{text("Cá nhân (B2C)", "Contact (B2C)")}</option><option value="ORGANIZATION_ACCOUNT">{text("Tổ chức (B2B)", "Organization (B2B)")}</option></select></label>
        <label className="block text-sm font-medium">{text("Mã đối tượng hiện có", "Existing subject ID")}<input className="mt-1 block w-full rounded border p-2" required disabled={busy || Boolean(intent.current)} value={subjectId} onChange={e=>{ intent.current = undefined; setError(undefined); setSubjectId(e.target.value); }} /></label>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <button type="submit" className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || query.data?.resourceVersion === undefined}>{busy ? text("Đang chuyển đổi…", "Converting…") : intent.current ? text("Thử chuyển đổi lại", "Retry conversion") : text("Chuyển thành khách hàng", "Convert to Customer")}</button>
      </form>}
    </main>
  </AuthoritativeQueryBoundary>;
};
