# Playwright configuration ownership

The root `playwright.config.ts` owns the general Chromium/Firefox/WebKit run.
`playwright.connected.config.ts` owns the local HTTP fixture or explicit external
ApiHost run. Its fixture lifecycle is intentionally separate from real SQL suites.

This directory owns shared configuration helpers and isolated suite profiles:

| Profile | Responsibility |
|---|---|
| `crm.ts` | CRM, UI, dashboard, currencies, realistic demo and Studio on port 3039 |
| `quote-approval.ts` | The existing approval-derived Quote suites on port 3044 |
| `services.ts` | External AI, Customer Health and Support, with their original project names and timeouts |
| `deal-pipeline.ts` | Pipeline acceptance and review, with the original buyer and server-reuse guards |
| `quote-core.ts` | Quote core, requiring its Deal fixture and retaining opt-in server reuse |
| `quote-list-pipeline.ts` | Quote list fixtures with their distinct environment requirements |
| `ai-workspace.ts` | AI Workspace on port 3015 |
| `contact-paging.ts` | Disposable SQL harness and paging browser on port 3018 |
| `shared.ts` | Frontend-relative paths, inherited environment and optional Chromium executable |

Root suite files used by backend scripts remain small compatibility entrypoints.
Do not delete them without coordinating those callers. They select one profile;
they do not combine suites, sessions, database fixtures or server lifecycles.

Three independently invoked configurations live here:

```sh
npm run e2e -- --config tests/config/playwright/connections.config.ts
npm run e2e -- --config tests/config/playwright/deal-presentation.config.ts
npm run e2e -- --config tests/config/playwright/support-connected.config.ts
```

Their former root filenames have been relocated. The Connections evidence path
still resolves to the existing external review directory; Deal presentation still
writes to `test-results/deal-presentation`. All server commands run from the
frontend root, regardless of the config file location.

## Safe validation

Use `--list` to discover tests without starting web servers or executing tests.
Real-service and SQL suites still require their original environment bindings
even for discovery. Supply synthetic bindings only for discovery; they are not
credentials or evidence of a working backend. Do not execute SQL/mutation suites
until the owning disposable fixture harness has prepared and isolated their data.

```sh
npm run e2e -- --config tests/config/playwright/deal-presentation.config.ts --list
node --import tsx --test tests/tooling/playwright-config.test.mts
```

The tooling test checks config guards and path/lifecycle separation without a
browser, ApiHost or database. It is a focused tooling check, invoked explicitly;
it does not replace or change any canonical quality gate. Existing E2E assertions,
fixtures, evidence destinations and browser authentication remain owned by their
original suites.
