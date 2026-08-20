# Contact–Organization Relationships

## Decision

A Contact is a person identity and may be related to multiple Organization Accounts at the same time or across historical periods. `Contact.organizationRelationships` is the canonical membership ledger. The legacy `organizationAccountId`, `roleAtCompany`, `department`, `decisionRole`, and `isPrimaryContact` fields remain compatibility projections of one active relationship and must not be treated as the many-to-many authority.

## Relationship record

Each membership contains:

- Organization Account ID.
- Relationship role and job title.
- Department and decision role.
- Effective-from/effective-to dates.
- Primary-representative flag.
- Actor/time evidence for create, update, and end.

Ending a membership appends an effective-to date and reason. It never deletes the Contact or historical relationship.

## Invariants

- One Contact can have multiple active Organization relationships.
- One Organization can have only one active primary representative.
- Setting a primary representative clears the primary flag from other active representatives of that Organization.
- A primary representative must have an active membership with the Organization.
- `OrganizationAccount.contactRefs` contains active representative references; ended memberships remain on the Contact ledger.
- Generic Contact profile editing re-applies the canonical membership projection so organization-specific role data is not accidentally overwritten.
- Connected commands use the `contact-organization-relationship` workflow endpoints with idempotency and optimistic concurrency.

## Connected workflow endpoints

- `POST /workflows/contact-organization-relationship/{contactId}/upsert-relationship`
- `POST /workflows/contact-organization-relationship/{contactId}/end-relationship`
- `POST /workflows/contact-organization-relationship/{organizationId}/set-primary-representative`

The backend owns the transaction spanning Contact membership, Organization active references, primary uniqueness, audit, and outbox events.
