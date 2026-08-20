import React from "react";
import { Download, RefreshCw, ShieldAlert, ShieldCheck, Workflow } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/shared/components/ui";
import { ListStatePanel } from "@/components/crm/list-archetype";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import type { AuditEventCategory, AuditEventOutcome, AuditEvidence, AuditTrailEntry } from "../application/auditTrail";
import { useAuditTrail } from "./useAuditTrail";

const categories: readonly AuditEventCategory[] = ["DATA_CHANGE", "AUTHORIZATION", "CONFIGURATION", "APPROVAL", "AUTOMATION", "INTEGRATION", "SECURITY", "BACKUP"];
const outcomes: readonly AuditEventOutcome[] = ["SUCCEEDED", "FAILED", "DENIED", "PENDING"];

export interface AuditTrailViewerProps {
  resourceKey?: string;
  recordId?: string;
  title?: string;
  embedded?: boolean;
  limit?: number;
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({ resourceKey, recordId, title, embedded = false, limit = 50 }) => {
  const { locale } = useI18n();
  const access = useEffectiveAccess();
  const vi = locale === "vi";
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query.trim());
  const [category, setCategory] = React.useState<"ALL" | AuditEventCategory>("ALL");
  const [outcome, setOutcome] = React.useState<"ALL" | AuditEventOutcome>("ALL");
  const audit = useAuditTrail({
    resourceKey,
    recordId,
    categories: category === "ALL" ? undefined : [category],
    outcomes: outcome === "ALL" ? undefined : [outcome],
    search: deferredQuery || undefined,
    limit,
  });

  if (!access.can(CAPABILITIES.AUDIT_READ)) {
    return <ListStatePanel kind="permission" title={vi ? "Bạn không có quyền xem nhật ký kiểm toán" : "You cannot view audit logs"} />;
  }

  const items = audit.data?.items ?? [];
  const body = (
    <div className="space-y-4" data-audit-viewer-authority={audit.data?.authority ?? (audit.connected ? "backend-pending" : "demo")}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input label={vi ? "Tìm trong nhật ký" : "Search audit trail"} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={vi ? "Action, actor, correlation…" : "Action, actor, correlation…"} />
        </div>
        <Select label={vi ? "Loại sự kiện" : "Category"} value={category} onChange={(event) => setCategory(event.target.value as "ALL" | AuditEventCategory)}>
          <option value="ALL">{vi ? "Tất cả" : "All"}</option>
          {categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </Select>
        <Select label={vi ? "Kết quả" : "Outcome"} value={outcome} onChange={(event) => setOutcome(event.target.value as "ALL" | AuditEventOutcome)}>
          <option value="ALL">{vi ? "Tất cả" : "All"}</option>
          {outcomes.map((value) => <option key={value} value={value}>{value}</option>)}
        </Select>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} loading={audit.refreshing} onClick={() => void audit.refresh()}>{vi ? "Làm mới" : "Refresh"}</Button>
        <Button variant="secondary" size="sm" icon={<Download size={14} />} disabled={items.length === 0} onClick={() => exportCsv(items, locale)}>{vi ? "Xuất CSV" : "Export CSV"}</Button>
      </div>

      {audit.stale && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">{vi ? "Đang hiển thị dữ liệu cũ vì lần làm mới gần nhất thất bại." : "Showing stale data because the latest refresh failed."}</div>}
      {audit.loading && !audit.data ? <ListStatePanel kind="loading" title={vi ? "Đang tải nhật ký kiểm toán" : "Loading audit trail"} /> : null}
      {audit.error && !audit.data ? <ListStatePanel kind="error" title={vi ? "Không thể tải nhật ký kiểm toán" : "Audit trail could not be loaded"} action={<Button variant="secondary" size="sm" onClick={() => void audit.refresh()}>{vi ? "Thử lại" : "Retry"}</Button>} /> : null}
      {!audit.loading && !audit.error && items.length === 0 ? <ListStatePanel kind="empty" title={vi ? "Chưa có sự kiện kiểm toán phù hợp" : "No matching audit events"} /> : null}

      <div className="space-y-3">
        {items.map((entry) => <AuditEntryCard key={entry.id} entry={entry} locale={locale} />)}
      </div>

      {audit.data?.nextCursor ? <div className="flex justify-center"><Button variant="secondary" loading={audit.loadingMore} onClick={() => void audit.loadMore()}>{vi ? "Tải thêm" : "Load more"}</Button></div> : null}
    </div>
  );

  if (embedded) return body;
  return <Card className="space-y-4"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-violet-700" /><h2 className="text-sm font-semibold text-slate-950">{title ?? (vi ? "Nhật ký kiểm toán" : "Audit trail")}</h2></div>{body}</Card>;
};

const AuditEntryCard: React.FC<{ entry: AuditTrailEntry; locale: "vi" | "en" }> = ({ entry, locale }) => {
  const vi = locale === "vi";
  const evidence = entry.evidence ? Object.entries(entry.evidence).filter(([, value]) => Boolean(value)) : [];
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-audit-event-id={entry.id}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={outcomeVariant(entry.outcome)}>{entry.outcome}</Badge>
          <Badge variant="neutral">{entry.category}</Badge>
          <span className="break-words text-sm font-semibold text-slate-950">{entry.action}</span>
        </div>
        {entry.summary ? <p className="mt-2 break-words text-sm leading-6 text-slate-600">{entry.summary}</p> : null}
      </div>
      <div className="text-right text-[11px] leading-5 text-slate-500">
        <div>{new Date(entry.occurredAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</div>
        <div>{entry.actor.displayName ?? entry.actor.id} · {entry.actor.type}</div>
      </div>
    </div>

    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
      {entry.changedFields.map((field) => <span key={field} className="rounded-full bg-violet-50 px-2.5 py-1 font-medium text-violet-700">{field}</span>)}
      {entry.reasonCode ? <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">{entry.reasonCode}</span> : null}
    </div>

    <div className="mt-3 grid gap-2 text-[11px] text-slate-500 md:grid-cols-2">
      {entry.requestId ? <AuditMeta label="Request" value={entry.requestId} /> : null}
      {entry.correlationId ? <AuditMeta label="Correlation" value={entry.correlationId} /> : null}
      {entry.causationId ? <AuditMeta label="Causation" value={entry.causationId} /> : null}
      <AuditMeta label={vi ? "Nguồn" : "Source"} value={entry.source} />
    </div>

    {evidence.length ? <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/70 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-sky-900"><Workflow size={14} />{vi ? "Bằng chứng liên quan" : "Related evidence"}</div>{evidence.map(([key, value]) => <AuditMeta key={key} label={evidenceLabel(key as keyof AuditEvidence, vi)} value={String(value)} />)}</div> : null}

    {entry.before !== undefined || entry.after !== undefined ? <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-700">{vi ? "Xem thay đổi trước/sau" : "View before/after diff"}</summary><div className="mt-3 grid gap-3 lg:grid-cols-2"><JsonPanel title={vi ? "Trước" : "Before"} value={entry.before} /><JsonPanel title={vi ? "Sau" : "After"} value={entry.after} /></div></details> : null}

    {entry.authority === "demo" ? <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900"><ShieldAlert size={14} className="mt-0.5 shrink-0" />{vi ? "Đây là bằng chứng Demo Mode trong trình duyệt, không thay thế kho audit bất biến của backend." : "This is browser-level Demo Mode evidence and does not replace an immutable backend audit sink."}</div> : null}
  </div>;
};

const AuditMeta: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="min-w-0"><span className="font-semibold text-slate-600">{label}:</span> <span className="break-all">{value}</span></div>;
const JsonPanel: React.FC<{ title: string; value: unknown }> = ({ title, value }) => <div className="min-w-0"><div className="mb-1 text-[11px] font-semibold text-slate-600">{title}</div><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-[10px] leading-5 text-slate-100">{value === undefined ? "—" : JSON.stringify(value, null, 2)}</pre></div>;


function evidenceLabel(key: keyof AuditEvidence, vi: boolean): string {
  const labels: Record<keyof AuditEvidence, { vi: string; en: string }> = {
    approvalId: { vi: "Phê duyệt", en: "Approval" },
    automationRunId: { vi: "Lần chạy tự động", en: "Automation run" },
    integrationRequestId: { vi: "Yêu cầu tích hợp", en: "Integration request" },
    providerReference: { vi: "Mã nhà cung cấp", en: "Provider reference" },
    exportReference: { vi: "Mã xuất dữ liệu", en: "Export reference" },
  };
  return vi ? labels[key].vi : labels[key].en;
}

function outcomeVariant(outcome: AuditEventOutcome): "success" | "danger" | "warning" | "neutral" {
  if (outcome === "SUCCEEDED") return "success";
  if (outcome === "FAILED" || outcome === "DENIED") return "danger";
  if (outcome === "PENDING") return "warning";
  return "neutral";
}

function exportCsv(items: readonly AuditTrailEntry[], locale: "vi" | "en"): void {
  const header = ["time", "category", "outcome", "action", "actor", "resource", "record", "requestId", "correlationId", "causationId", "source"].join(",");
  const rows = items.map((entry) => [entry.occurredAt, entry.category, entry.outcome, entry.action, entry.actor.displayName ?? entry.actor.id, entry.resourceKey, entry.recordId ?? "", entry.requestId ?? "", entry.correlationId ?? "", entry.causationId ?? "", entry.source].map(csvCell).join(","));
  const url = URL.createObjectURL(new Blob([`\uFEFF${[header, ...rows].join("\n")}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `unicorecrm-audit-${new Date().toISOString().slice(0, 10)}-${locale}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string { return `"${value.replace(/"/gu, '""')}"`; }
