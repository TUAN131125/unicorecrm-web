import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeContactCanonicalProfile,
  resolveOrganizationContacts,
  type Contact,
} from "@/modules/contacts";
import { auditCustomerRelationshipDataQuality, type Customer } from "@/modules/customers";
import type { OrganizationAccount } from "@/modules/organizations";
import { identityTextSimilarity } from "@/platform/identity";
import { CAPABILITIES } from "@/platform/access-control";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const now = "2026-07-21T00:00:00.000Z";

const contact: Contact = {
  id: "contact-1",
  name: "Nguyen Van A",
  fullName: "Nguyễn Văn A",
  email: " PERSON@EXAMPLE.COM ",
  mobilePhone: "+84 912 345 678",
  phone: "0912345678",
  zalo: "zalo-a",
  workspaceId: "workspace-default",
  status: "active",
  organizationRelationships: [{
    id: "rel-1",
    organizationAccountId: "org-1",
    role: "decision_maker",
    isPrimaryRepresentative: true,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: now,
};
const normalized = normalizeContactCanonicalProfile(contact, { workspaceId: "workspace-default", now });
assert.equal(normalized.name, normalized.fullName, "Canonical Contact aliases must resolve to one display name.");
assert.equal(normalized.phone, normalized.mobilePhone, "Canonical Contact phone aliases must remain synchronized.");
assert.equal(normalized.zalo, normalized.zaloId, "Canonical Contact Zalo aliases must remain synchronized.");
assert.equal(normalized.workspaceId, "workspace-default");

const organization: OrganizationAccount = {
  id: "org-1",
  workspaceId: "workspace-default",
  displayName: "Acme Vietnam",
  taxCode: "0101234567",
  domain: "acme.vn",
  primaryContactId: "contact-1",
  contactRefs: [],
  createdAt: now,
};
assert.deepEqual(resolveOrganizationContacts("org-1", [normalized], organization).map((item) => item.id), ["contact-1"], "Organization Contact resolution must understand the canonical relationship ledger even when compatibility refs are absent.");

const customer: Customer = {
  id: "customer-1",
  workspaceId: "workspace-default",
  customerCode: "KH0001",
  type: "B2B",
  relationshipRef: { type: "ORGANIZATION_ACCOUNT", id: "org-1" },
  status: "NEW",
  health: "GOOD",
  onboardingStatus: "PENDING",
  firstPurchaseAt: now,
  lastPurchaseAt: now,
  tags: [],
  createdAt: now,
  updatedAt: now,
};
const quality = auditCustomerRelationshipDataQuality({ customers: [customer], contacts: [normalized], organizations: [organization], now });
assert.ok(quality.issues.some((item) => item.type === "CUSTOMER_ONBOARDING_PENDING"));
assert.ok(quality.issues.some((item) => item.type === "ORGANIZATION_RELATIONSHIP_ONE_SIDED"), "Data quality audit must detect an unprojected relationship side.");
assert.ok(identityTextSimilarity("Công ty Cổ phần Acme Việt Nam", "ACME Viet Nam") >= 0.5, "Fuzzy identity matching must handle punctuation, casing and Vietnamese accents.");

assert.equal(CAPABILITIES.CUSTOMERS_ONBOARD_EXISTING, "customers.onboard_existing");
const onboardingWorkflow = read("src/workflows/customer-onboarding/index.ts");
assert.match(onboardingWorkflow, /CUSTOMERS_ONBOARD_EXISTING/);
assert.match(onboardingWorkflow, /EXTERNAL_PURCHASE_CONFIRMED/);
assert.match(onboardingWorkflow, /HISTORICAL_PURCHASE_IMPORTED/);
assert.match(onboardingWorkflow, /recordCommercialEvidence/);

const contactCreate = read("src/modules/contacts/presentation/list/ContactCreateModal.tsx");
assert.match(contactCreate, /ContactFormDraft/);
assert.doesNotMatch(contactCreate, /Pick<ContactFormDraft/, "Contact create must not silently narrow the canonical form payload.");
const relationshipWorkflow = read("src/workflows/contact-organization-relationship/index.ts");
assert.match(relationshipWorkflow, /createOrganizationWithRepresentativeWorkflow/);
assert.match(relationshipWorkflow, /replaceContacts\(contactsBefore\)/);
assert.match(relationshipWorkflow, /replaceOrganizationAccounts\(organizationsBefore\)/);
const customerIdentity = read("src/workflows/customer-identity/index.ts");
assert.match(customerIdentity, /resolveOrganizationPrimaryContact/);
assert.match(customerIdentity, /updateConsentProfile/);
assert.match(customerIdentity, /doNotSms/);
assert.match(customerIdentity, /doNotZalo/);
const leadQualification = read("src/workflows/lead-qualification/runtime/createLeadQualificationRuntime.ts");
assert.match(leadQualification, /consent:/);
assert.match(leadQualification, /companyAddress/);
const directSale = read("src/workflows/lead-qualification/application/executeLeadDirectSale.ts");
assert.match(directSale, /state: "DRAFT"/);
assert.doesNotMatch(directSale, /state: "CONFIRMED"/);

const spec = JSON.parse(read("docs/api/openapi.json")) as { paths: Record<string, Record<string, { operationId?: string }>>; components: { schemas: Record<string, { properties?: Record<string, unknown> }> } };
assert.equal(spec.paths["/customers"]?.post, undefined, "OpenAPI must not expose unrestricted direct Customer creation.");
assert.equal(spec.paths["/customer-onboarding"]?.post?.operationId, "onboardExistingCustomer");
for (const field of ["workspaceId", "customerCode", "relationshipRef", "onboardingStatus", "createdFromEvidenceId", "tier", "serviceLevel", "careCadenceDays"]) {
  assert.ok(spec.components.schemas.CustomerDocument?.properties?.[field], `CustomerDocument is missing ${field}.`);
}
for (const field of ["workspaceId", "consent", "organizationRelationships", "doNotSms", "doNotZalo"]) {
  assert.ok(spec.components.schemas.ContactDocument?.properties?.[field], `ContactDocument is missing ${field}.`);
}
for (const field of ["workspaceId", "legalName", "taxCode", "addressDetails", "primaryContactId", "contactRefs"]) {
  assert.ok(spec.components.schemas.OrganizationDocument?.properties?.[field], `OrganizationDocument is missing ${field}.`);
}

console.log("Customer relationship P0/P1/P2 completeness: PASS");
