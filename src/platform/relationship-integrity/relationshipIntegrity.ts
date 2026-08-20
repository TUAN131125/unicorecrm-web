import {
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  normalizeTaxCode,
  relationshipRefKey,
  type RelationshipRef,
} from "@/platform/identity";
import type {
  RelationshipCommercialRecord,
  RelationshipCustomerRecord,
  RelationshipIntegrityIssue,
  RelationshipIntegritySnapshot,
  RelationshipIntegritySummary,
  RelationshipSupportRecord,
  RelationshipWorkRecord,
} from "./relationshipIntegrity.types";

export function auditRelationshipIntegrity(snapshot: RelationshipIntegritySnapshot): RelationshipIntegritySummary {
  const issues: RelationshipIntegrityIssue[] = [];
  const contactIds = new Set(snapshot.contacts.map((record) => record.id));
  const organizations = snapshot.organizations.filter((record) => record.workspaceId === snapshot.workspaceId);
  const organizationIds = new Set(organizations.map((record) => record.id));
  const relationshipExists = (ref?: RelationshipRef): boolean => Boolean(ref && (
    ref.type === "CONTACT" ? contactIds.has(ref.id) : organizationIds.has(ref.id)
  ));

  for (const organization of snapshot.organizations) {
    if (organization.workspaceId !== snapshot.workspaceId) {
      issues.push(issue(
        "CROSS_WORKSPACE_REFERENCE",
        "ERROR",
        "Organization",
        organization.id,
        `Organization belongs to workspace ${organization.workspaceId}, not ${snapshot.workspaceId}.`,
      ));
    }
    for (const contactRef of organization.contactRefs ?? []) {
      if (!contactIds.has(contactRef.id)) {
        issues.push(issue(
          "ORPHAN_RELATIONSHIP",
          "ERROR",
          "Organization",
          organization.id,
          `Organization references missing Contact ${contactRef.id}.`,
          undefined,
          [contactRef.id],
        ));
      }
    }
    if (organization.primaryContactId && !contactIds.has(organization.primaryContactId)) {
      issues.push(issue(
        "ORPHAN_RELATIONSHIP",
        "ERROR",
        "Organization",
        organization.id,
        `Organization primary Contact ${organization.primaryContactId} does not exist.`,
        undefined,
        [organization.primaryContactId],
      ));
    }
  }

  for (const contact of snapshot.contacts) {
    if (contact.organizationAccountId && !organizationIds.has(contact.organizationAccountId)) {
      issues.push(issue(
        "ORPHAN_RELATIONSHIP",
        "ERROR",
        "Contact",
        contact.id,
        `Contact references missing Organization ${contact.organizationAccountId}.`,
        undefined,
        [contact.organizationAccountId],
      ));
    }
  }

  const customerById = new Map<string, RelationshipCustomerRecord>();
  const customerByAlias = new Map<string, RelationshipCustomerRecord>();
  const customerByRelationship = new Map<string, RelationshipCustomerRecord>();
  for (const customer of snapshot.customers) {
    customerById.set(customer.id, customer);
    for (const alias of [customer.id, customer.customerCode, ...(customer.legacyAliases ?? [])]) customerByAlias.set(alias, customer);
    const key = relationshipRefKey(customer.relationshipRef);
    const existing = customerByRelationship.get(key);
    if (existing && existing.id !== customer.id) {
      issues.push(issue(
        "CUSTOMER_RELATIONSHIP_MISMATCH",
        "ERROR",
        "Customer",
        customer.id,
        `Customer relationship ${key} is already owned by ${existing.id}.`,
        customer.relationshipRef,
        [existing.id],
      ));
    }
    customerByRelationship.set(key, customer);
    if (customer.workspaceId !== snapshot.workspaceId) {
      issues.push(issue(
        "CROSS_WORKSPACE_REFERENCE",
        "ERROR",
        "Customer",
        customer.id,
        `Customer belongs to workspace ${customer.workspaceId}, not ${snapshot.workspaceId}.`,
        customer.relationshipRef,
      ));
    }
    if (!relationshipExists(customer.relationshipRef)) {
      issues.push(issue(
        "ORPHAN_RELATIONSHIP",
        "ERROR",
        "Customer",
        customer.id,
        `Customer source ${relationshipRefKey(customer.relationshipRef)} does not exist.`,
        customer.relationshipRef,
      ));
    }
  }

  detectContactDuplicates(snapshot, issues);
  detectOrganizationDuplicates(snapshot, issues);

  const dealById = new Map(snapshot.deals.map((record) => [record.id, record]));
  const quoteById = new Map(snapshot.quotes.map((record) => [record.id, record]));
  const orderById = new Map(snapshot.orders.map((record) => [record.id, record]));
  const returnById = new Map(snapshot.returns.map((record) => [record.id, record]));

  auditCommercialRecords("Deal", snapshot.deals, relationshipExists, customerById, customerByAlias, issues);
  auditCommercialRecords("Quote", snapshot.quotes, relationshipExists, customerById, customerByAlias, issues);
  auditCommercialRecords("Order", snapshot.orders, relationshipExists, customerById, customerByAlias, issues);

  for (const quote of snapshot.quotes) {
    if (!quote.sourceDealId) continue;
    const deal = dealById.get(quote.sourceDealId);
    if (!deal) {
      issues.push(issue("BROKEN_SOURCE_CHAIN", "ERROR", "Quote", quote.id, `Quote source Deal ${quote.sourceDealId} does not exist.`, quote.buyerRef, [quote.sourceDealId]));
      continue;
    }
    if (relationshipRefKey(deal.buyerRef) !== relationshipRefKey(quote.buyerRef)) {
      issues.push(issue("BROKEN_SOURCE_CHAIN", "ERROR", "Quote", quote.id, "Quote buyer does not match its source Deal buyer.", quote.buyerRef, [deal.id]));
    }
  }

  for (const order of snapshot.orders) {
    const sources = [
      order.sourceDealId ? { type: "Deal", id: order.sourceDealId, record: dealById.get(order.sourceDealId) } : undefined,
      order.sourceQuoteId ? { type: "Quote", id: order.sourceQuoteId, record: quoteById.get(order.sourceQuoteId) } : undefined,
    ].filter(Boolean) as Array<{ type: string; id: string; record?: RelationshipCommercialRecord }>;
    for (const source of sources) {
      if (!source.record) {
        issues.push(issue("BROKEN_SOURCE_CHAIN", "ERROR", "Order", order.id, `Order source ${source.type} ${source.id} does not exist.`, order.buyerRef, [source.id]));
      } else if (relationshipRefKey(source.record.buyerRef) !== relationshipRefKey(order.buyerRef)) {
        issues.push(issue("BROKEN_SOURCE_CHAIN", "ERROR", "Order", order.id, `Order buyer does not match its source ${source.type} buyer.`, order.buyerRef, [source.id]));
      }
    }
  }

  for (const payment of [...snapshot.paymentObligations, ...snapshot.paymentTransactions]) {
    if (!orderById.has(payment.orderId)) issues.push(issue("BROKEN_SOURCE_CHAIN", "ERROR", "Payment", payment.id, `Payment references missing Order ${payment.orderId}.`, undefined, [payment.orderId]));
  }

  for (const booking of snapshot.shippingBookings) {
    if (booking.workspaceId && booking.workspaceId !== snapshot.workspaceId) {
      issues.push(issue("CROSS_WORKSPACE_REFERENCE", "ERROR", "Shipping", booking.id, `Shipping belongs to workspace ${booking.workspaceId}, not ${snapshot.workspaceId}.`));
    }
    const sourceExists = booking.sourceType === "ORDER" ? orderById.has(booking.sourceId) : returnById.has(booking.sourceId);
    if (!sourceExists) issues.push(issue("BROKEN_SOURCE_CHAIN", "ERROR", "Shipping", booking.id, `Shipping references missing ${booking.sourceType} ${booking.sourceId}.`, undefined, [booking.sourceId]));
  }

  for (const request of snapshot.returns) {
    if (request.workspaceId !== snapshot.workspaceId) {
      issues.push(issue("CROSS_WORKSPACE_REFERENCE", "ERROR", "Return", request.id, `Return belongs to workspace ${request.workspaceId}, not ${snapshot.workspaceId}.`, request.buyerRef));
    }
    const order = orderById.get(request.orderId);
    if (!order) {
      issues.push(issue("BROKEN_SOURCE_CHAIN", "ERROR", "Return", request.id, `Return references missing Order ${request.orderId}.`, request.buyerRef, [request.orderId]));
    } else if (relationshipRefKey(order.buyerRef) !== relationshipRefKey(request.buyerRef)) {
      issues.push(issue("BROKEN_SOURCE_CHAIN", "ERROR", "Return", request.id, "Return buyer does not match its source Order buyer.", request.buyerRef, [request.orderId]));
    }
  }

  for (const supportCase of snapshot.supportCases) auditSupportRecord(supportCase, relationshipExists, customerById, customerByAlias, contactIds, orderById, issues);
  for (const task of snapshot.tasks) auditWorkRecord("Task", task, relationshipExists, customerById, customerByAlias, issues);
  for (const activity of snapshot.activities) auditWorkRecord("Activity", activity, relationshipExists, customerById, customerByAlias, issues);

  return {
    checkedRelationshipCount: contactIds.size + organizationIds.size + snapshot.customers.length,
    checkedRecordCount:
      snapshot.deals.length + snapshot.quotes.length + snapshot.orders.length +
      snapshot.paymentObligations.length + snapshot.paymentTransactions.length +
      snapshot.shippingBookings.length + snapshot.returns.length + snapshot.supportCases.length +
      snapshot.tasks.length + snapshot.activities.length,
    errorCount: issues.filter((entry) => entry.severity === "ERROR").length,
    warningCount: issues.filter((entry) => entry.severity === "WARNING").length,
    issueCount: issues.length,
    issues: issues.sort((left, right) => left.severity.localeCompare(right.severity) || left.recordType.localeCompare(right.recordType) || left.recordId.localeCompare(right.recordId)),
  };
}

function auditCommercialRecords(
  recordType: string,
  records: readonly RelationshipCommercialRecord[],
  relationshipExists: (ref?: RelationshipRef) => boolean,
  customerById: Map<string, RelationshipCustomerRecord>,
  customerByAlias: Map<string, RelationshipCustomerRecord>,
  issues: RelationshipIntegrityIssue[],
): void {
  for (const record of records) {
    if (!relationshipExists(record.buyerRef)) {
      issues.push(issue("ORPHAN_RELATIONSHIP", "ERROR", recordType, record.id, `${recordType} buyer ${relationshipRefKey(record.buyerRef)} does not exist.`, record.buyerRef));
    }
    if (!record.customerId) continue;
    const customer = customerById.get(record.customerId) ?? customerByAlias.get(record.customerId);
    if (!customer) {
      issues.push(issue("CUSTOMER_RELATIONSHIP_MISMATCH", "ERROR", recordType, record.id, `${recordType} references unknown Customer ${record.customerId}.`, record.buyerRef, [record.customerId]));
      continue;
    }
    if (relationshipRefKey(customer.relationshipRef) !== relationshipRefKey(record.buyerRef)) {
      issues.push(issue("CUSTOMER_RELATIONSHIP_MISMATCH", "ERROR", recordType, record.id, `${recordType} Customer and buyer relationship do not match.`, record.buyerRef, [customer.id]));
    }
  }
}

function auditSupportRecord(
  record: RelationshipSupportRecord,
  relationshipExists: (ref?: RelationshipRef) => boolean,
  customerById: Map<string, RelationshipCustomerRecord>,
  customerByAlias: Map<string, RelationshipCustomerRecord>,
  contactIds: Set<string>,
  orderById: Map<string, RelationshipCommercialRecord>,
  issues: RelationshipIntegrityIssue[],
): void {
  if (!record.relationshipRef || !relationshipExists(record.relationshipRef)) {
    issues.push(issue("ORPHAN_RELATIONSHIP", "ERROR", "Support", record.id, "Support Case is missing a valid canonical relationship.", record.relationshipRef));
  }
  if (record.customerId) {
    const customer = customerById.get(record.customerId) ?? customerByAlias.get(record.customerId);
    if (!customer) issues.push(issue("CUSTOMER_RELATIONSHIP_MISMATCH", "ERROR", "Support", record.id, `Support Case references unknown Customer ${record.customerId}.`, record.relationshipRef, [record.customerId]));
    else if (record.relationshipRef && relationshipRefKey(customer.relationshipRef) !== relationshipRefKey(record.relationshipRef)) issues.push(issue("CUSTOMER_RELATIONSHIP_MISMATCH", "ERROR", "Support", record.id, "Support Case Customer and relationship do not match.", record.relationshipRef, [customer.id]));
  }
  if (record.contactId && !contactIds.has(record.contactId)) issues.push(issue("ORPHAN_RELATIONSHIP", "ERROR", "Support", record.id, `Support Case references missing Contact ${record.contactId}.`, record.relationshipRef, [record.contactId]));
  if (record.relatedOrderId && !orderById.has(record.relatedOrderId)) issues.push(issue("BROKEN_SOURCE_CHAIN", "ERROR", "Support", record.id, `Support Case references missing Order ${record.relatedOrderId}.`, record.relationshipRef, [record.relatedOrderId]));
}

function auditWorkRecord(
  recordType: string,
  record: RelationshipWorkRecord,
  relationshipExists: (ref?: RelationshipRef) => boolean,
  customerById: Map<string, RelationshipCustomerRecord>,
  customerByAlias: Map<string, RelationshipCustomerRecord>,
  issues: RelationshipIntegrityIssue[],
): void {
  if (record.relationshipRef && !relationshipExists(record.relationshipRef)) issues.push(issue("ORPHAN_RELATIONSHIP", "ERROR", recordType, record.id, `${recordType} relationship does not exist.`, record.relationshipRef));
  if (!record.customerId) return;
  const customer = customerById.get(record.customerId) ?? customerByAlias.get(record.customerId);
  if (!customer) issues.push(issue("CUSTOMER_RELATIONSHIP_MISMATCH", "ERROR", recordType, record.id, `${recordType} references unknown Customer ${record.customerId}.`, record.relationshipRef, [record.customerId]));
  else if (record.relationshipRef && relationshipRefKey(customer.relationshipRef) !== relationshipRefKey(record.relationshipRef)) issues.push(issue("CUSTOMER_RELATIONSHIP_MISMATCH", "ERROR", recordType, record.id, `${recordType} Customer and relationship do not match.`, record.relationshipRef, [customer.id]));
}

function detectContactDuplicates(snapshot: RelationshipIntegritySnapshot, issues: RelationshipIntegrityIssue[]): void {
  const indexes = [
    { label: "email", value: (record: RelationshipIntegritySnapshot["contacts"][number]) => normalizeEmail(record.workEmail || record.personalEmail || record.email) },
    { label: "phone", value: (record: RelationshipIntegritySnapshot["contacts"][number]) => normalizePhone(record.mobilePhone || record.workPhone || record.phone) },
  ];
  for (const index of indexes) {
    const grouped = groupByNormalizedValue(snapshot.contacts, index.value);
    for (const [value, records] of grouped) {
      if (!value || records.length < 2) continue;
      const ids = records.map((record) => record.id).sort();
      issues.push(issue("DUPLICATE_CONTACT_IDENTITY", "WARNING", "Contact", ids[0], `Multiple Contacts share normalized ${index.label} ${value}.`, undefined, ids));
    }
  }
}

function detectOrganizationDuplicates(snapshot: RelationshipIntegritySnapshot, issues: RelationshipIntegrityIssue[]): void {
  const organizations = snapshot.organizations.filter((record) => record.workspaceId === snapshot.workspaceId);
  const indexes = [
    { label: "tax code", value: (record: RelationshipIntegritySnapshot["organizations"][number]) => normalizeTaxCode(record.taxCode) },
    { label: "domain", value: (record: RelationshipIntegritySnapshot["organizations"][number]) => normalizeDomain(record.domain || record.website) },
  ];
  for (const index of indexes) {
    const grouped = groupByNormalizedValue(organizations, index.value);
    for (const [value, records] of grouped) {
      if (!value || records.length < 2) continue;
      const ids = records.map((record) => record.id).sort();
      issues.push(issue("DUPLICATE_ORGANIZATION_IDENTITY", "WARNING", "Organization", ids[0], `Multiple Organizations share normalized ${index.label} ${value}.`, undefined, ids));
    }
  }
}

function groupByNormalizedValue<T>(records: readonly T[], resolver: (record: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const value = resolver(record);
    if (!value) continue;
    grouped.set(value, [...(grouped.get(value) ?? []), record]);
  }
  return grouped;
}

function issue(
  code: RelationshipIntegrityIssue["code"],
  severity: RelationshipIntegrityIssue["severity"],
  recordType: string,
  recordId: string,
  message: string,
  relationshipRef?: RelationshipRef,
  relatedRecordIds?: string[],
): RelationshipIntegrityIssue {
  return { code, severity, recordType, recordId, message, relationshipRef, relatedRecordIds };
}
