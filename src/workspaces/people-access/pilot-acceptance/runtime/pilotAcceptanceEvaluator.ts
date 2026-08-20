import { PILOT_METRIC_DEFINITIONS, PILOT_STEP_DEFINITIONS } from "../domain/pilotAcceptanceCatalog";
import type {
  LocalizedPilotText,
  PilotAcceptanceDataset,
  PilotAcceptanceResult,
  PilotCheckResult,
  PilotCheckStatus,
  PilotManualEvidence,
  PilotStepId,
  PilotStepResult,
} from "../domain/pilotAcceptance.types";

const text = (vi: string, en: string): LocalizedPilotText => ({ vi, en });

function check(
  id: string,
  condition: boolean,
  pass: LocalizedPilotText,
  fail: LocalizedPilotText,
  recordIds?: string[],
): PilotCheckResult {
  return { id, status: condition ? "PASS" : "FAIL", summary: condition ? pass : fail, recordIds };
}

function evidenceCheck(
  id: string,
  condition: boolean,
  pass: LocalizedPilotText,
  missing: LocalizedPilotText,
): PilotCheckResult {
  return { id, status: condition ? "PASS" : "NEEDS_EVIDENCE", summary: condition ? pass : missing };
}

function blockedCheck(
  id: string,
  condition: boolean,
  pass: LocalizedPilotText,
  blocked: LocalizedPilotText,
): PilotCheckResult {
  return { id, status: condition ? "PASS" : "BLOCKED", summary: condition ? pass : blocked };
}

function stepStatus(checks: PilotCheckResult[]): PilotCheckStatus {
  if (checks.some((item) => item.status === "FAIL")) return "FAIL";
  if (checks.some((item) => item.status === "BLOCKED")) return "BLOCKED";
  if (checks.some((item) => item.status === "NEEDS_EVIDENCE")) return "NEEDS_EVIDENCE";
  return "PASS";
}

function manualEvidenceFor(stepId: PilotStepId, evidence: readonly PilotManualEvidence[]): PilotCheckResult {
  const latest = evidence
    .filter((item) => item.stepId === stepId)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  if (!latest) {
    return evidenceCheck(
      `manual-${stepId}`,
      false,
      text("Đã có bằng chứng pilot thủ công.", "Manual pilot evidence is available."),
      text("Cần người dùng pilot xác nhận trực tiếp trên trình duyệt.", "A pilot user must verify this step in a real browser."),
    );
  }
  return {
    id: `manual-${stepId}`,
    status: latest.status,
    summary: latest.status === "PASS"
      ? text(`Đã xác nhận bởi ${latest.actorRole}.`, `Verified by ${latest.actorRole}.`)
      : text(`Pilot báo lỗi: ${latest.note}`, `Pilot reported a failure: ${latest.note}`),
  };
}

interface JourneyChain {
  leadId?: string;
  contactId?: string;
  organizationId?: string;
  dealId?: string;
  quoteId?: string;
  orderId?: string;
  relationshipKey?: string;
}

function findBestJourneyChain(dataset: PilotAcceptanceDataset): JourneyChain {
  let best: JourneyChain = {};
  let bestScore = -1;

  for (const order of dataset.orders) {
    const quote = order.sourceQuoteId ? dataset.quotes.find((item) => item.id === order.sourceQuoteId) : undefined;
    const dealId = order.sourceDealId ?? quote?.dealId;
    const deal = dealId ? dataset.deals.find((item) => item.id === dealId) : undefined;
    const lead = deal?.leadId ? dataset.leads.find((item) => item.id === deal.leadId) : undefined;
    const contact = lead?.convertedContactId ? dataset.contacts.find((item) => item.id === lead.convertedContactId) : undefined;
    const organization = lead?.convertedOrganizationId ? dataset.organizations.find((item) => item.id === lead.convertedOrganizationId) : undefined;
    const relationshipKey = order.relationshipKey || quote?.relationshipKey || deal?.relationshipKey || contact?.relationshipKey || organization?.relationshipKey;
    const score = [order, quote, deal, lead, contact, organization].filter(Boolean).length
      + dataset.payments.filter((item) => item.orderId === order.id).length
      + dataset.shipping.filter((item) => item.sourceType === "ORDER" && item.sourceId === order.id).length
      + dataset.returns.filter((item) => item.orderId === order.id).length
      + dataset.support.filter((item) => item.orderId === order.id).length;
    if (score > bestScore) {
      bestScore = score;
      best = {
        orderId: order.id,
        quoteId: quote?.id,
        dealId: deal?.id,
        leadId: lead?.id,
        contactId: contact?.id,
        organizationId: organization?.id,
        relationshipKey,
      };
    }
  }
  return best;
}

function buildChecks(
  stepId: PilotStepId,
  dataset: PilotAcceptanceDataset,
  chain: JourneyChain,
): PilotCheckResult[] {
  const lead = chain.leadId ? dataset.leads.find((item) => item.id === chain.leadId) : undefined;
  const contact = chain.contactId ? dataset.contacts.find((item) => item.id === chain.contactId) : undefined;
  const organization = chain.organizationId ? dataset.organizations.find((item) => item.id === chain.organizationId) : undefined;
  const deal = chain.dealId ? dataset.deals.find((item) => item.id === chain.dealId) : undefined;
  const quote = chain.quoteId ? dataset.quotes.find((item) => item.id === chain.quoteId) : undefined;
  const order = chain.orderId ? dataset.orders.find((item) => item.id === chain.orderId) : undefined;
  const payments = order ? dataset.payments.filter((item) => item.orderId === order.id) : [];
  const shipment = order ? dataset.shipping.find((item) => item.sourceType === "ORDER" && item.sourceId === order.id && item.externalStatus === "DELIVERED") : undefined;
  const returnRequest = order ? dataset.returns.find((item) => item.orderId === order.id) : undefined;
  const support = order ? dataset.support.find((item) => item.orderId === order.id) : undefined;

  switch (stepId) {
    case "lead-ingress": {
      const channels = new Set(dataset.ingress.map((item) => item.channel));
      const webhookMatch = dataset.ingress.some((item) => item.channel === "webhook" && item.result === "MATCHED_EXISTING");
      const sourceIntegration = dataset.integrationEvidence.some((item) => item.authenticated && item.idempotencyVerified && item.retryVerified);
      const externalIntegration = dataset.integrationEvidence.some((item) => item.providerKind === "EXTERNAL_PROVIDER" && item.authenticated && item.idempotencyVerified && item.retryVerified && item.reconciliationVerified);
      return [
        check("ingress-channels", ["manual", "import", "webhook"].every((channel) => channels.has(channel as never)), text("Đã có đủ nhập tay, import và webhook.", "Manual, import, and webhook intake are covered."), text("Chưa có đủ ba kênh tiếp nhận Lead.", "The three lead-intake channels are not all covered.")),
        check("ingress-dedupe", webhookMatch, text("Webhook lặp lại khớp Lead hiện hữu.", "The repeated webhook matches an existing lead."), text("Webhook chưa chứng minh chống trùng.", "Webhook deduplication is not demonstrated.")),
        check("ingress-resilience", sourceIntegration, text("Có bằng chứng auth, idempotency và retry ở source.", "Source-level auth, idempotency, and retry evidence is available."), text("Thiếu bằng chứng auth/idempotency/retry cho connector.", "Connector auth/idempotency/retry evidence is missing.")),
        blockedCheck("ingress-external-provider", externalIntegration, text("Đã có connector nhà cung cấp thật với reconciliation.", "A real provider connector with reconciliation is verified."), text("Cần một connector nhà cung cấp thật; development webhook chưa đủ điều kiện nghiệm thu production.", "A real provider connector is required; the development webhook is not production acceptance evidence.")),
      ];
    }
    case "owner-and-sla": {
      const ownerValid = Boolean(lead && dataset.salesMemberIds.includes(lead.ownerId));
      const ownershipAudit = Boolean(lead && dataset.ownershipAudit.some((item) => item.recordId === lead.id && item.nextOwnerId === lead.ownerId && item.reason.trim()));
      return [
        check("lead-chain", Boolean(lead), text("Đã tìm thấy Lead trong chuỗi pilot.", "A lead was found in the pilot chain."), text("Không tìm thấy Lead truy vết được từ chuỗi giao dịch.", "No lead can be traced from the transaction chain."), lead ? [lead.id] : undefined),
        check("lead-owner", ownerValid, text("Lead thuộc đúng thành viên Sales.", "The lead belongs to the correct Sales member."), text("Owner Lead không thuộc nhóm Sales pilot.", "The lead owner is not a pilot Sales member."), lead ? [lead.id] : undefined),
        check("lead-owner-audit", ownershipAudit, text("Owner có bằng chứng audit và lý do.", "Ownership has audit evidence and a reason."), text("Thiếu audit tạo hoặc bàn giao owner.", "Creation or reassignment audit evidence is missing.")),
        check("lead-sla", Boolean(lead?.nextFollowUpAt && lead.firstResponseAt), text("Có next follow-up và phản hồi đầu tiên.", "Next follow-up and first response are recorded."), text("Thiếu next follow-up hoặc bằng chứng phản hồi đầu tiên.", "Next follow-up or first-response evidence is missing.")),
      ];
    }
    case "customer-conversion": {
      const sameRelationship = Boolean(
        lead?.relationshipKey
        && contact?.relationshipKey === lead.relationshipKey
        && organization?.relationshipKey === lead.relationshipKey,
      );
      return [
        check("conversion-links", Boolean(lead && contact && organization && contact.convertedFromLeadId === lead.id && organization.convertedFromLeadId === lead.id), text("Lead vẫn liên kết Contact và Organization sau chuyển đổi.", "Lead remains linked to Contact and Organization after conversion."), text("Chuỗi chuyển đổi Lead–Contact–Organization chưa đầy đủ.", "The Lead–Contact–Organization conversion chain is incomplete.")),
        check("conversion-relationship", sameRelationship, text("Các bản ghi dùng cùng một quan hệ khách hàng chuẩn.", "The records share one canonical customer relationship."), text("Contact, Organization và Lead không cùng relationship identity.", "Contact, Organization, and Lead do not share the same relationship identity.")),
        check("relationship-integrity", dataset.relationshipBlockingIssues === 0, text("Không có lỗi quan hệ blocking.", "There are no blocking relationship issues."), text(`Còn ${dataset.relationshipBlockingIssues} lỗi quan hệ blocking.`, `${dataset.relationshipBlockingIssues} blocking relationship issues remain.`)),
      ];
    }
    case "deal-pipeline":
      return [
        check("deal-chain", Boolean(deal && lead && deal.leadId === lead.id && deal.relationshipKey === chain.relationshipKey), text("Deal truy vết đúng Lead và khách hàng.", "The deal traces to the correct lead and customer."), text("Deal chưa liên kết đúng Lead hoặc relationship.", "The deal is not linked to the correct lead or relationship."), deal ? [deal.id] : undefined),
        check("deal-owner", Boolean(deal && dataset.salesMemberIds.includes(deal.ownerId)), text("Deal thuộc đúng Sales.", "The deal belongs to the correct Sales member."), text("Owner Deal không thuộc nhóm Sales pilot.", "The deal owner is not a pilot Sales member.")),
        check("deal-next-step", Boolean(deal?.nextActionAt && deal.nextActionSummary?.trim() && deal.expectedCloseDate), text("Deal có next step và ngày đóng dự kiến.", "The deal has a next step and expected close date."), text("Deal thiếu next step, nội dung hành động hoặc ngày đóng.", "The deal is missing a next step, action summary, or close date.")),
      ];
    case "quote-approval": {
      const approvalValid = Boolean(quote && (!quote.approvalRequired || (quote.approvalStatus === "APPROVED" && quote.approvedAt)));
      return [
        check("quote-chain", Boolean(quote && deal && quote.dealId === deal.id && quote.relationshipKey === deal.relationshipKey), text("Quote liên kết đúng Deal và relationship.", "The quote links to the correct deal and relationship."), text("Quote chưa liên kết đúng Deal hoặc khách hàng.", "The quote is not linked to the correct deal or customer."), quote ? [quote.id] : undefined),
        check("quote-approval", approvalValid, text("Bằng chứng phê duyệt phù hợp chính sách.", "Approval evidence satisfies the policy."), text("Quote cần phê duyệt nhưng chưa có quyết định hợp lệ.", "The quote requires approval but has no valid decision.")),
        check("quote-total", Boolean(quote && quote.grandTotal > 0 && quote.discountTotal >= 0), text("Tổng tiền và chiết khấu hợp lệ.", "Quote total and discount are valid."), text("Tổng tiền hoặc chiết khấu Quote không hợp lệ.", "Quote total or discount is invalid.")),
      ];
    }
    case "order-creation":
      return [
        check("order-chain", Boolean(order && quote && order.sourceQuoteId === quote.id && order.sourceDealId === deal?.id), text("Order truy vết đúng Quote và Deal.", "The order traces to the correct quote and deal."), text("Order chưa giữ đầy đủ nguồn Quote/Deal.", "The order does not retain its quote/deal source."), order ? [order.id] : undefined),
        check("order-relationship", Boolean(order && quote && order.relationshipKey === quote.relationshipKey), text("Order giữ đúng quan hệ khách hàng.", "The order preserves the customer relationship."), text("Quan hệ khách hàng của Order không khớp Quote.", "The order customer relationship does not match the quote.")),
        check("order-total", Boolean(order && quote && Math.abs(order.grandTotal - quote.grandTotal) < 0.01), text("Tổng Order khớp Quote được chấp nhận.", "The order total matches the accepted quote."), text("Tổng Order và Quote bị sai lệch.", "The order and quote totals do not reconcile.")),
      ];
    case "payment-reconciliation": {
      const obligations = payments.filter((item) => item.kind === "OBLIGATION");
      const transactions = payments.filter((item) => item.kind === "PAYMENT");
      const amountDue = obligations.reduce((sum, item) => sum + item.amount, 0);
      const amountPaid = transactions.filter((item) => item.status === "SUCCEEDED").reduce((sum, item) => sum + item.amount, 0);
      const reconciled = transactions.filter((item) => item.status === "SUCCEEDED").every((item) => item.reconciliationState === "MATCHED");
      return [
        check("payment-plan", Boolean(order && obligations.length > 0 && Math.abs(amountDue - order.grandTotal) < 0.01), text("Lịch thanh toán khớp tổng Order.", "The payment plan matches the order total."), text("Lịch thanh toán thiếu hoặc không khớp tổng Order.", "The payment plan is missing or does not match the order total.")),
        check("payment-transaction", amountPaid > 0, text("Đã ghi nhận giao dịch thanh toán thành công.", "A successful payment transaction is recorded."), text("Chưa có giao dịch thanh toán thành công.", "No successful payment transaction is recorded.")),
        check("payment-reconciliation", transactions.length > 0 && reconciled, text("Các giao dịch thành công đã được đối soát.", "Successful transactions are reconciled."), text("Còn giao dịch thành công chưa MATCHED.", "A successful transaction is not MATCHED.")),
      ];
    }
    case "shipping-delivery":
      return [
        check("shipping-chain", Boolean(shipment && order && shipment.sourceId === order.id), text("Vận đơn thuộc đúng Order.", "The shipment belongs to the correct order."), text("Không tìm thấy vận đơn delivered cho Order pilot.", "No delivered shipment was found for the pilot order."), shipment ? [shipment.id] : undefined),
        check("shipping-evidence", Boolean(shipment?.deliveredAt && shipment.bookingStatus === "BOOKED"), text("Có booking và deliveredAt hợp lệ.", "Valid booking and deliveredAt evidence are present."), text("Thiếu booking hoặc delivered evidence.", "Booking or delivery evidence is missing.")),
        check("shipping-attempts", Boolean(shipment && shipment.attempts >= 1), text("Lịch sử attempt được ghi nhận.", "Attempt history is recorded."), text("Không có bằng chứng attempt/retry.", "Attempt/retry evidence is missing.")),
      ];
    case "return-resolution": {
      const resolutionEvidenceExists = Boolean(returnRequest?.resolutionEvidenceId && (
        dataset.payments.some((item) => item.id === returnRequest.resolutionEvidenceId && item.kind === "REFUND" && item.status === "SUCCEEDED")
        || dataset.shipping.some((item) => item.id === returnRequest.resolutionEvidenceId && item.purpose === "REPLACEMENT_OUTBOUND" && item.externalStatus === "DELIVERED")
      ));
      return [
        check("return-chain", Boolean(returnRequest && order && returnRequest.orderId === order.id), text("Return thuộc đúng Order.", "The return belongs to the correct order."), text("Không tìm thấy Return cho Order pilot.", "No return was found for the pilot order."), returnRequest ? [returnRequest.id] : undefined),
        check("return-receipt", Boolean(returnRequest?.receivedAt), text("Đã xác nhận nhận hàng trả.", "Returned-item receipt is confirmed."), text("Return chưa có receivedAt.", "The return has no receivedAt evidence.")),
        check("return-resolution-evidence", resolutionEvidenceExists, text("Resolution có bằng chứng Payment hoặc Shipping hoàn tất.", "Resolution has completed Payment or Shipping evidence."), text("Resolution chưa liên kết bằng chứng refund/replacement hoàn tất.", "Resolution is not linked to completed refund/replacement evidence.")),
      ];
    }
    case "support-and-reconciliation": {
      const tasks = support ? dataset.tasks.filter((item) => support.taskIds.includes(item.id)) : [];
      const supportSla = Boolean(support?.firstResponseDueAt && support.firstRespondedAt && new Date(support.firstRespondedAt).getTime() <= new Date(support.firstResponseDueAt).getTime());
      return [
        check("support-chain", Boolean(support && order && support.orderId === order.id && support.relationshipKey === order.relationshipKey), text("Support liên kết đúng Order và khách hàng.", "Support links to the correct order and customer."), text("Support chưa liên kết đúng Order hoặc relationship.", "Support is not linked to the correct order or relationship."), support ? [support.id] : undefined),
        check("support-task", tasks.length > 0 && tasks.every((item) => item.assigneeId), text("Support có công việc và người phụ trách.", "Support has assigned work."), text("Support thiếu Task hoặc người phụ trách.", "Support is missing a task or assignee.")),
        check("support-sla", supportSla, text("Phản hồi Support đạt SLA.", "Support first response meets SLA."), text("Thiếu SLA hoặc phản hồi đầu tiên bị trễ.", "SLA evidence is missing or the first response is late.")),
        check("global-relationship", dataset.relationshipBlockingIssues === 0, text("Không có bản ghi mồ côi blocking.", "There are no blocking orphan records."), text(`Còn ${dataset.relationshipBlockingIssues} lỗi quan hệ.`, `${dataset.relationshipBlockingIssues} relationship errors remain.`)),
        check("global-metrics", Math.abs(dataset.dashboardReportDelta) < 0.01, text("Dashboard và Reports khớp dữ liệu gốc.", "Dashboard and Reports reconcile with source data."), text(`Sai lệch đối soát là ${dataset.dashboardReportDelta}.`, `The reconciliation delta is ${dataset.dashboardReportDelta}.`)),
        check("global-role-scope", dataset.roleScopeVerified, text("Role và data scope được kiểm chứng.", "Role and data scope are verified."), text("Quyền theo role/scope chưa được kiểm chứng.", "Role/scope access is not verified.")),
        check("global-guidance", dataset.guidanceCoverageVerified, text("Guidance đã cập nhật cho chuỗi pilot.", "Guidance covers the pilot journey."), text("Guidance chưa phủ đầy đủ chuỗi pilot.", "Guidance does not fully cover the pilot journey.")),
        check("global-audit", dataset.auditLedgerVerified, text("Chuỗi audit hợp lệ.", "The audit chain is valid."), text("Chuỗi audit không hợp lệ.", "The audit chain is invalid.")),
      ];
    }
  }
}

export function evaluatePilotAcceptance(
  dataset: PilotAcceptanceDataset,
  manualEvidence: readonly PilotManualEvidence[] = [],
  now = new Date(),
): PilotAcceptanceResult {
  const chain = findBestJourneyChain(dataset);
  const steps: PilotStepResult[] = PILOT_STEP_DEFINITIONS.map((definition) => {
    const checks = buildChecks(definition.id, dataset, chain);
    if (definition.manualEvidenceRequired) checks.push(manualEvidenceFor(definition.id, manualEvidence));
    return { definition, checks, status: stepStatus(checks) };
  });
  const passedSteps = steps.filter((step) => step.status === "PASS").length;
  const failedSteps = steps.filter((step) => step.status === "FAIL").length;
  const blockedSteps = steps.filter((step) => step.status === "BLOCKED").length;
  const needsEvidenceSteps = steps.filter((step) => step.status === "NEEDS_EVIDENCE").length;
  const blockers = steps.flatMap((step) => step.checks
    .filter((item) => item.status === "FAIL" || item.status === "BLOCKED")
    .map((item) => item.summary));
  const overallStatus = blockedSteps > 0 ? "BLOCKED" : failedSteps > 0 ? "NEEDS_ACTION" : "READY_FOR_BROWSER_PILOT";

  return {
    workspaceId: dataset.workspaceId,
    evaluatedAt: now.toISOString(),
    overallStatus,
    steps,
    passedSteps,
    failedSteps,
    blockedSteps,
    needsEvidenceSteps,
    blockers,
    metricCoverage: PILOT_METRIC_DEFINITIONS.map((definition) => ({
      definition,
      observations: dataset.metricObservations.filter((item) => item.metricId === definition.id),
    })),
  };
}
