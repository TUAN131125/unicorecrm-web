import type { Contact } from "@/modules/contacts";

type LegacyContactRelationshipFields = {
  customerId?: string;
  legacyCustomerId?: string;
};

type LegacyContact = Contact & LegacyContactRelationshipFields;
import type { Customer } from "@/modules/customers/presentation/model/customerDisplay.types";
import type { OrganizationAccount } from "@/modules/organizations";
import type { CustomerState } from "@/modules/commercial-evidence";
import type { CustomerMigrationProfile } from "@/modules/customers/application/ports/CustomerRuntimePort";
import type { RelationshipRef } from "@/platform/identity";
import type { CanonicalMigrationIssue } from "./migrationIssues";
import { CanonicalMigrationIssueCollector } from "./migrationIssues";

export interface ContactOrganizationLinkMigration {
  contactId: string;
  organizationAccountId: string;
  legacyCustomerId: string;
}

export interface CustomerRelationshipMigrationResult {
  organizationAccounts: OrganizationAccount[];
  contactsToCreate: Contact[];
  contactOrganizationLinks: ContactOrganizationLinkMigration[];
  customerViewProfiles: CustomerMigrationProfile[];
  issues: CanonicalMigrationIssue[];
}

export function migrateCustomerRelationshipRecords(
  customers: readonly Customer[],
  contacts: readonly LegacyContact[],
  workspaceId = "ws_default",
): CustomerRelationshipMigrationResult {
  const collector = new CanonicalMigrationIssueCollector();
  const organizationAccounts: OrganizationAccount[] = [];
  const contactsToCreate: Contact[] = [];
  const contactOrganizationLinks: ContactOrganizationLinkMigration[] = [];
  const customerViewProfiles: CustomerMigrationProfile[] = [];

  for (const customer of customers) {
    const relationshipRef: RelationshipRef =
      customer.type === "COMPANY"
        ? { type: "ORGANIZATION_ACCOUNT", id: `org_${customer.id}` }
        : { type: "CONTACT", id: resolveIndividualContactId(customer, contacts, collector) };

    if (relationshipRef.type === "ORGANIZATION_ACCOUNT") {
      const linkedContacts = contacts.filter(
        (contact) =>
          contact.customerId === customer.id ||
          contact.legacyCustomerId === customer.id,
      );
      organizationAccounts.push({
        id: relationshipRef.id,
        workspaceId,
        displayName: customer.displayName,
        legalName: customer.companyName || customer.displayName,
        taxCode: customer.taxCode,
        phone: customer.phone,
        email: customer.email,
        website: customer.website,
        address: customer.address,
        industry: customer.industry,
        sizeBand: customer.segment,
        ownerId: customer.ownerId,
        source: customer.source,
        tags: [...(customer.tags ?? [])],
        contactRefs: linkedContacts.map((contact) => ({
          type: "CONTACT" as const,
          id: contact.id,
        })),
        legacyCustomerId: customer.id,
        legacyCustomerCode: customer.customerCode,
        createdAt: linkedContacts[0]?.createdAt ?? customer.lastPurchaseDate ?? "1970-01-01T00:00:00.000Z",
      });
      linkedContacts.forEach((contact) =>
        contactOrganizationLinks.push({
          contactId: contact.id,
          organizationAccountId: relationshipRef.id,
          legacyCustomerId: customer.id,
        }),
      );
    } else if (!contacts.some((contact) => contact.id === relationshipRef.id)) {
      contactsToCreate.push(buildIndividualContact(customer, relationshipRef.id));
    }

    customerViewProfiles.push(buildCustomerViewProfile(customer, relationshipRef));
  }

  return {
    organizationAccounts,
    contactsToCreate,
    contactOrganizationLinks,
    customerViewProfiles,
    issues: collector.list(),
  };
}

function resolveIndividualContactId(
  customer: Customer,
  contacts: readonly LegacyContact[],
  collector: CanonicalMigrationIssueCollector,
): string {
  const explicitLegacyMatch = contacts.find(
    (contact) => contact.legacyCustomerId === customer.id,
  );
  if (explicitLegacyMatch) return explicitLegacyMatch.id;

  const emailMatches = customer.email
    ? contacts.filter((contact) =>
        [contact.email, contact.workEmail, contact.personalEmail].some(
          (value) => normalize(value) === normalize(customer.email),
        ),
      )
    : [];
  if (emailMatches.length === 1) return emailMatches[0].id;

  const phoneMatches = customer.phone
    ? contacts.filter((contact) =>
        [contact.phone, contact.mobilePhone, contact.workPhone, contact.otherPhone].some(
          (value) => normalizePhone(value) === normalizePhone(customer.phone),
        ),
      )
    : [];
  const strongPhoneMatches = phoneMatches.filter(
    (contact) =>
      normalize(contact.fullName || contact.name) === normalize(customer.displayName),
  );
  if (strongPhoneMatches.length === 1) return strongPhoneMatches[0].id;

  const ambiguousCount = Math.max(emailMatches.length, phoneMatches.length);
  if (ambiguousCount > 0) {
    collector.add({
      sourceType: "Customer",
      sourceId: customer.id,
      disposition: "REVIEW",
      severity: "WARNING",
      rule: "INDIVIDUAL_CUSTOMER_IDENTITY_AMBIGUOUS",
      message: `Legacy individual Customer has ${ambiguousCount} conflicting Contact candidate(s); deterministic migration creates a dedicated Contact until identity review resolves the duplicate.`,
      candidateResolution: "Review duplicate Contacts and merge while preserving lineage.",
    });
  }

  return `contact_customer_${customer.id}`;
}

function buildIndividualContact(customer: Customer, contactId: string): Contact {
  return {
    id: contactId,
    contactCode: customer.customerCode,
    name: customer.displayName,
    fullName: customer.individualName || customer.displayName,
    email: customer.email,
    personalEmail: customer.email,
    phone: customer.phone,
    mobilePhone: customer.phone,
    address: customer.address,
    ownerId: customer.ownerId,
    status: customer.status === "do_not_contact" ? "do_not_contact" : "active",
    priority: customer.priority ?? "MEDIUM",
    source: customer.source,
    tags: [...(customer.tags ?? [])],
    relationshipLevel: customer.health === "Tốt" ? "good" : "warm",
    createdFrom: "customer",
    createdAt: customer.lastPurchaseDate ?? "1970-01-01T00:00:00.000Z",
    notes: `Imported from legacy individual Customer ${customer.customerCode}.`,
  };
}

function buildCustomerViewProfile(
  customer: Customer,
  relationshipRef: RelationshipRef,
): CustomerMigrationProfile {
  return {
    relationshipRef,
    legacyCustomerId: customer.id,
    legacyCustomerCode: customer.customerCode,
    customerState: inferMigrationCustomerState(customer),
    historicalPurchaseCount:
      customer.purchaseCount ?? customer.productsOwned.length,
    latestPurchaseAt: customer.lastPurchaseDate,
    nextCareAt: customer.nextCareAt,
    segment: customer.segment,
    source: customer.source,
    totalRevenue: customer.totalRevenue ?? customer.lifetimeValue ?? 0,
    outstandingDebt: customer.outstandingDebt ?? 0,
    purchaseCycleDays: customer.purchaseCycleDays,
    monthlyRecurringRevenue: customer.mrr,
    renewalAt: customer.renewalDate,
    lastCareAt: customer.lastCareAt,
    health:
      customer.health === "Cảnh báo"
        ? "RISK"
        : customer.health === "Trung bình"
          ? "WATCH"
          : "GOOD",
    ownedProducts: customer.productsOwned.map((product) => ({
      id: product.id,
      productId: product.productId,
      productName: product.productNameSnapshot,
      quantity: product.quantity,
      purchasedAt: product.purchaseDate,
      amount: product.amount,
      status:
        product.status === "renewal_due"
          ? "RENEWAL_DUE"
          : product.status.toUpperCase() as "ACTIVE" | "EXPIRED" | "CANCELLED",
      expiresAt: product.expiryDate,
    })),
  };
}

function inferMigrationCustomerState(customer: Customer): CustomerState {
  const hasHistoricalPurchase =
    (customer.purchaseCount ?? 0) > 0 ||
    customer.productsOwned.length > 0 ||
    Boolean(customer.lastPurchaseDate);
  if (!hasHistoricalPurchase) return "NONE";

  // Legacy Customer.status is not a valid source for customerState. Records with
  // purchase history remain ACTIVE as migration backfill until the canonical
  // Purchase Evidence projection determines runtime state.
  return "ACTIVE";
}

function normalize(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePhone(value?: string): string {
  return value?.replace(/\D/g, "") ?? "";
}
