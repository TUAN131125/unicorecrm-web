import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HttpAuditTrailAuthority } from "../../../src/platform/audit";
import type { HttpClient, HttpRequest } from "../../../src/platform/api";

let networkCalls = 0;
const client: HttpClient = {
  async request<TResponse>(_input: HttpRequest): Promise<TResponse> {
    networkCalls += 1;
    throw new Error("Unexpected network call");
  },
};
const authority = new HttpAuditTrailAuthority(client);
await assert.rejects(
  authority.list({ workspaceId: "workspace-1", resourceKey: "orders", recordId: "order-1" }),
  /CONTRACT_OPERATION_BLOCKED|blocked until an OpenAPI audit projection/u,
);
assert.equal(networkCalls, 0, "Blocked audit authority must reject before network I/O.");

const read = (relative: string) => fs.readFileSync(path.join(repositoryRoot, relative), "utf8");
const composition = read("src/app/composition/applicationComposition.ts");
assert.match(composition, /configureAuditTrailAuthority\(new HttpAuditTrailAuthority/);
assert.match(composition, /resetAuditTrailAuthority\(\)/);
assert.match(composition, /auditTrailAuthority: mode === "connected" \? "connected-http" : "demo-local"/);

const authoritySource = read("src/platform/audit/infrastructure/HttpAuditTrailAuthority.ts");
assert.match(authoritySource, /CONTRACT_OPERATION_BLOCKED/);
assert.doesNotMatch(authoritySource, /audit\/events/);

const hook = read("src/platform/audit/react/useAuditTrail.ts");
assert.match(hook, /isAuditTrailAuthorityConfigured\(\)/);
assert.match(hook, /workspaceId: workspace\.workspaceId/);
assert.match(hook, /subscribeToOperationalAudit/);
assert.match(hook, /authority: "demo"/);

const viewer = read("src/platform/audit/react/AuditTrailViewer.tsx");
for (const marker of ["correlationId", "causationId", "requestId", "changedFields", "before", "after", "approvalId", "automationRunId", "integrationRequestId"]) {
  assert.ok(viewer.includes(marker), `Audit viewer must render ${marker}.`);
}
assert.match(viewer, /CAPABILITIES\.AUDIT_READ/);
assert.match(viewer, /Export CSV/);

const recordMenu = read("src/components/crm/RecordHeaderActionMenu.tsx");
assert.match(recordMenu, /AuditTrailViewer/);
assert.match(recordMenu, /CAPABILITIES\.AUDIT_READ/);
assert.match(recordMenu, /FileClock/);
assert.match(recordMenu, /recordId=\{audit\.recordId\}/);

for (const [file, resource] of [
  ["src/modules/deals/presentation/views/DealDetailHeaderSection.tsx", "deals"],
  ["src/modules/quotes/presentation/pages/QuoteDetailPage.tsx", "quotes"],
  ["src/modules/orders/presentation/pages/OrderDetailPage.tsx", "orders"],
] as const) {
  const source = read(file);
  assert.match(source, new RegExp(`resourceKey: "${resource}"`));
  assert.match(source, /label: locale === "vi" \? "Xem lịch sử kiểm toán"/);
}
const appShell = read("src/app/shell/layout/AppShell.tsx");
assert.doesNotMatch(appShell, /<GlobalAuditTrailHost/);

for (const [file, resource] of [
  ["src/modules/payments/presentation/pages/PaymentDetailPage.tsx", "payments"],
  ["src/modules/invoices/presentation/pages/InvoiceDetailPage.tsx", "invoices"],
  ["src/modules/returns/presentation/pages/ReturnDetailPage.tsx", "returns"],
] as const) {
  const source = read(file);
  assert.match(source, new RegExp(`<AuditTrailViewer resourceKey="${resource}"`));
  assert.doesNotMatch(source, /getOperationalAuditSnapshot/);
}

assert.ok(fs.existsSync("docs/architecture/backend-authoritative-audit-viewer.md"));
console.log("Backend audit viewer: PASS (workspace-scoped authority, strict normalization/redaction, shared record/workspace UX, correlation/evidence/diff coverage)");
