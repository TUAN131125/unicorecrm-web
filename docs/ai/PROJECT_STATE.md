# UnicoreCRM Current Project State

Current truth only. Not a historical record.

## Repository

Repository: `TUAN131125/unicorecrm-web`
Local: `D:\Project_All\UnicoreCRM\frontend\unicorecrm-web`
Branch: `main`
Baseline HEAD: `e6573e86e3e4e626c1468020d053de76fde86396`

Working tree: **INTENTIONALLY DIRTY**. No roadmap phase changes have been committed. The
uncommitted diff is verified M1–M12 work plus earlier financial dispatch work. Preserve it.

## Roadmap position

M0 through M12 are complete. **M12 was the final phase; there is no M13.**

Final result: **M12_FINAL_BLOCKED**.

The frontend mutation architecture is internally coherent, cross-module safe and honestly
represented, and **every gate that can run without a backend passes in its correct execution
context** (312/312; the 20 acceptance gates need credentials that do not exist here). Several
canonical production capabilities remain impossible because the required backend contract or
ownership decision is absent. Those blockers are external to this repository and must not be
closed from the frontend.

A post-M12 remediation pass re-derived both blockers from source, searched exhaustively for an
authoritative resolution, found none, and therefore implemented neither. It did fix the one
genuinely frontend-owned item — the release-artifact gate execution context.

## Release blockers (external)

Both are backend/product ownership items. Neither is a frontend defect.

**1. Order closing — DF-05.** *(re-confirmed post-M12; no authoritative resolution exists)* `order.complete-from-fulfillment-evidence` (CMD-046) is
PRODUCTION_CONTRACT_READY with a complete OpenAPI operation and a generated, versioned client
method. Its owning workflow WF-12 is `contractReadiness: BLOCKED`,
`connectedFrontendCoordinatorAllowed: false`, blocked on `DEC-WORKFLOW-ORDER-CLOSING` — a
decision recorded nowhere in the repository. Because
`runtimeImplementationMode: DEDICATED_WORKFLOW_HTTP_ADAPTER` requires dispatch through the
workflow, a ready command inside a blocked workflow is unusable. Reconciling the two canonical
records is a backend/product decision. **Do not invent that adapter.**

**2. CRM write contracts — DF-29.** *(re-confirmed post-M12; narrowed to one decision)* Contacts, Customers and Organizations own zero
production-ready write commands. All seven write operations in OpenAPI are BLOCKED while all
nine reads are READY. In connected mode a user cannot create or edit a Contact, create or edit
an Organization, link a Contact to an Organization, or advance a Customer lifecycle. The
frontend contains this correctly; the product is not shippable as a CRM without the contracts.

All eight core CRM write operations are blocked by a **single** authoritative decision,
`DEC-MUTATION-RESULT-PROJECTION` (`status: BLOCKED`, `recommendedOwner: contacts`) — the
largest blocking group in the contract. Resolving it unblocks the whole core CRM write
surface. A further 12 CRM commands (archive/restore/anonymize, relationship, conversion) have
no OpenAPI operation at all and carry unrecorded `DEC-CMD-*` decision ids. No document defines
the minimum CRM write set required for release, so that scope call is
**PRODUCT_DECISION_REQUIRED**.

## Non-blocking external gaps

```text
DF-01  historical task_deal_* refs — no clear/omission semantics on UpdateDealNextActionRequest
DF-02  Deal <-> Task next-action link needs a backend workflow
DF-08  receivable collection activity has reads only, no write contract
DF-09  invoice seller info / payment receiving / pipelines / product types are BLOCKED
DF-12  Deal timeline projection of Task activity is backend-owned
DF-13  Quote -> Deal timeline projection is backend-owned
DF-19  WF-04 partial-commit semantics await the backend contract
DF-31  customer onboarding has no contract; connected write is refused
```

`DEFERRED_FINDINGS.md` carries the final disposition, owner and release impact for every one.
Nothing is deferred to a later phase.

## What M12 changed

M12 was an adversarial audit, not a feature phase. It made two production fixes, hardened
three gates, added one gate, and gave every open finding a final disposition.

### DF-10 — connected platform configuration authority (production fix)

The one live invariant violation M12 found. `saveIntegrationConnection`,
`verifyIntegrationConnection`, `disconnectIntegrationConnection`, `saveDeveloperWebhooks` and
`saveCrmObjectSchemas` were backed by `BrowserStorageAdapter` repositories with no
runtime-mode awareness, so connected mode wrote workspace configuration — including
integration credential references — into browser storage, behind authoritative backend reads
(`listIntegrationConnections`, `listCrmObjectSchemas` are READY; every corresponding write is
BLOCKED; webhooks have no operation at all). That is MA-01 exactly, and because these are
platform singletons rather than module ports there was no connected binding to fail closed.

`src/platform/connected-configuration/connectedConfigurationAvailability.ts` now owns the
operation labels, predicates and fail-closed assertion; the connected composition declares
them before the service bundle is built; each runtime asserts before touching its repository;
each Studio view refuses first with `unavailableFeatureMessage`. Demo declares nothing and is
unchanged.

### DF-14 — workflow-owned refusal for WF-05, WF-09, WF-12 (production fix)

All three bound through `connectedOperationUnavailable` at each port without ever declaring
the workflow, so callers could only refuse by re-deriving another aggregate's availability.
Each now binds through `unavailableConnectedOperation` with its own operation constant,
exposes its own predicate, and asserts at the workflow boundary before any command. WF-12 also
refuses at all three order-completion entry points.

`quality.workflow-coordinator-ownership`: 27 coordinator-forbidden workflows, 4 blocked and
connected-bound, **4 of 4 declaring their own unavailability, 0 pinned**.

### Two gate weaknesses found by adversarial probing, both fixed

M12 tried five realistic code shapes the M11 controls do not use. Three were caught; two were
not, and both were real:

- `quality.user-facing-error-safety` tracked reads on the catch binding only. Passing the
  exception into an inline formatter — `((e) => String((e as Error).message))(caught)` — moved
  every dangerous read onto the arrow parameter and the scan saw nothing. It now follows two
  bounded aliasing forms (a direct local rebinding, and the first parameter of an inline
  function the binding is applied to). The read patterns stayed precise on purpose: a
  sanctioned formatter is routinely called inside a template literal, and a looser pattern
  flagged four correct sites.
- `quality.connected-platform-configuration-authority` checked the guard by name, so renaming
  the import specifier left every call site textually intact. It now requires the assertion to
  be imported unaliased from the availability module.

### New gate

```text
quality.connected-platform-configuration-authority
```

Everything it checks is derived: the operation set from the availability module, the write
sites from whoever consults it, the callers from whoever calls those writes, and the
legitimacy of each refusal from OpenAPI contract status. The OpenAPI check runs in both
directions, so a refusal cannot outlive its blocker — if `createIntegrationConnection` ships,
the gate fails and forces real routing.

Its preflight check is structural, not textual: the predicate must be the entire test of an
`if` whose body returns. That requirement exists because the negative-control gate caught the
first version passing with `&& false` appended.

### Findings closed as false positives, by audit rather than by fix

**DF-04 — client-generated Deal IDs.** No defect. All 20 create-shaped commands were checked:
every create request schema declares `additionalProperties: false` and exposes no property
naming its own aggregate; `mapCreateDealRequest` never forwards `deal.id`; client values come
from `createCreateCommandTarget` as `pending_<type>_<uuid>`; and `FetchHttpClient` validates
every outgoing body against the OpenAPI schema, so a client aggregate id cannot reach the
backend even if a mapper tried. Every aggregate is SERVER_ASSIGNED; client ids are
CLIENT_INTENT_ID_ONLY.

## Current invariant gates

```text
quality.dedicated-module-command-dispatch
quality.blocked-command-containment
quality.workspace-scope-reset
quality.post-commit-projection-writes
quality.server-assigned-task-identity
quality.server-assigned-task-identity-contracts
quality.connected-business-operation-availability
quality.connected-platform-configuration-authority      (M12)
quality.connected-unavailable-port-containment
quality.workflow-coordinator-ownership
quality.wf01-contact-opportunity-ownership
quality.wf04-customer-commercial-actions-ownership
quality.wf21-work-activation-ownership
quality.partial-commit-outcomes
quality.partial-commit-semantics
quality.user-facing-error-safety
quality.user-facing-error-presentation
quality.composition-presentation-dependency
quality.partial-commit-controller-runtime
quality.mutation-authority-negative-controls
quality.mutation-authority-semantic-coverage
```

`check-quality-pipeline.mts` pins the manifest at **332** gates; recompute rather than
assuming that number.

`quality.mutation-authority-negative-controls` carries **21** controls, each reintroducing a
real defect in a real source file and requiring the named gate to fail, with every file
restored byte-for-byte and verified by SHA-256.

`quality.mutation-authority-semantic-coverage`: 10 invariants, 24 distinct gates registered
and scheduled, 8 invariants with runtime-behaviour coverage, 15 gates carrying negative
controls.

MA-01 still carries no whole-invariant control and cannot: "the backend is the authority" is
not falsifiable by a local frontend edit. Its *negative* half now is — a connected browser
write standing behind an authoritative backend read is concrete, and M12 controls reintroduce
it. The exclusion stands with that limit recorded against the entry.

## Verification status

```text
typecheck              PASS
lint                   PASS
tests                  PASS
build                  PASS
api:check              PASS
architecture gates     PASS
repository inventory   PASS (consolidated in M12; the M0-M12 stale exception is retired)
release artifact       PASS (real archive built and inspected)

full pipeline          312 of 312 PASS  (npm run verify, 10 groups)
```

Gate accounting, stated precisely rather than rounded up: the manifest holds **332** gates.
`npm run verify` runs the **312** that are applicable without a backend, and all 312 pass with
zero failures. The remaining **20 are acceptance gates** — `quality.real-backend-contract`,
`quality.connected-browser-e2e` and 18 provider-contract packs — which require backend
credentials that do not exist here. They did not run, so no claim is made about them.

**Release-artifact gate context, fixed post-M12.**
`quality.backend-contract-hardening.inventory-integrity` used to fail on
`Forbidden artifact present: node_modules`. Root cause: it applied a *release-artifact* rule
to the *repository root*, using a hand-written list. In a working tree that assertion can
never hold — `node_modules` is required to run the pipeline, `dist` is produced by
`quality.build` earlier in the same run, and `.git` is the repository.

The rule was not weakened, allowlisted or skipped. It already had a correct owner:
`quality.ci-release-contract` builds the real deterministic source archive in a temp
directory and requires `isForbiddenArchiveEntry` — derived from
`scripts/release/release-policy.json` — to reject every entry. Verified directly: the archive
holds 2057 entries with **zero** forbidden, and `node_modules`, `dist` and `.git` are present
in the working tree yet absent from the archive.

Two changes were made, both increasing strength:

- the repository-scoped gate now asserts the **release policy** still forbids all six classes,
  so the artifact rule cannot be narrowed by editing the policy instead of the gate;
- the artifact gate now derives its exclusion assertions from
  `releasePolicy.excludedDirectories` instead of three hard-coded names, and additionally
  asserts `.env` never enters the release inventory.

Negative controls executed: removing each of the six classes from the release policy in turn
makes the repository-scoped pin **fail every time** (6/6), and the policy file was restored
byte-for-byte. Notably the artifact gate stays green under policy narrowing — which is exactly
why the pin is load-bearing.

**Backend E2E: NOT VERIFIED.** The `acceptance` group defines `quality.real-backend-contract`
and `quality.connected-browser-e2e`, but no configured backend environment or credentials are
available in this repository, and none were invented. Every claim above is frontend
static-source and frontend-runtime evidence only. No claim is made about backend behaviour.

## Standing rules

Do NOT add dedicated commands to `PRODUCTION_COMMAND_CONTRACTS`.

Do NOT invent the order-closing workflow adapter, mark a BLOCKED command READY, edit OpenAPI
to match frontend wishes, add frontend compensation, or restore a local projection write to
close a read-model gap.

If a blocked write contract ships, the refusal must be replaced by real routing — the
configuration gate and the workflow-ownership gate both fail in that direction on purpose.
