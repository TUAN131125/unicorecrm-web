# Authoritative Deal pipelines

Deals owns workspace pipeline configuration and lifecycle stage policy. Studio is its administration surface. Connected mode reads `/crm-configuration/pipelines` through the generated `CrmConfigurationApiClient` and `DealPipelineHttpAdapter`; browser storage remains a Demo-only authority.

The collection contains full pipeline and stage documents, including inactive definitions. The connected read projection stores that collection once; stage consumers select a pipeline by stable ID. A Deal carries `pipelineId` and the backend `stageCategory`. A workspace default only selects the pipeline for a new Deal; changing it never moves existing Deals.

Studio creates a complete pipeline with OPEN, WON and LOST stages. It saves one selected aggregate through POST or PATCH, awaits the response and reloads the collection. PATCH carries the pipeline's original server version in If-Match; local field edits never increment it. A default change may increment another pipeline's version, so a single returned document is insufficient to refresh defaults. Existing stage identities, codes and categories remain stable. Terminal outcomes cannot be removed, disabled or reached using an ordinary stage transition. The backend rejects removal/deactivation of referenced stages.

Save intents retain an idempotency key across ambiguous outcomes. Editing and discarding remain unavailable until replay confirms that outcome. A committed save whose subsequent collection refresh fails retains its backend mutation evidence, invalidates Deal reads, and shows a reload requirement; the UI does not describe that committed write as an uncommitted failure. Dirty drafts retain their original version when background reads refresh.

Pipeline reads are shared across Studio, Kanban, forms and Detail. Workspace/session changes reset and abort the resource; a completion must still match the captured workspace and session before it can project. Cross-workspace response documents are rejected. Connected reads never repair an invalid response by inserting default stages, changing IDs, or applying legacy aliases.

Kanban requests bounded windows per stage with `pipelineId` and `stageCode`, retaining inactive columns for historical records. Configuration versions participate in its reset key. Each window has cancellation and a request version; responses must match the requested pipeline and stage. The table query uses the same server pipeline filter. Creation offers active pipelines and active OPEN stages. Pipeline reassignment of existing Deals is unavailable.

Create validation resolves stage policy from the pipeline selected in the form, even when the page is showing another pipeline with the same stage code. Edit validation resolves it from the Deal's assigned pipeline. Missing authoritative stage metadata fails closed rather than using another pipeline's rules.

Detail V5 selects the Deal's assigned pipeline, displays administrator labels and the current inactive stage, and supports variable stage counts with horizontal overflow. Stage choices contain active OPEN stages; Won/Lost retain their separate commands. Display order does not imply a mandatory transition sequence or historical visitation. Default stage probability never automatically changes Opportunity Score; backend `forecastCategory`, `forecastFloor` and `requiresPositiveAmount` retain policy authority.

Verification entry points:

- `npx tsx tests/quality/integration/check-deal-pipeline-authority.mts` exercises generated transport, mutation metadata, authoritative mapping, malformed responses, cancellation, workspace isolation, custom labels/stages and committed-save refresh failures.
- `npx playwright test --config playwright.deal-pipeline.config.ts` runs isolated real-backend UI acceptance using synthetic control-workspace records. It requires process-only test credentials and buyer identity. Outputs are written outside source when `UNICORECRM_TEST_EVIDENCE_DIR` is supplied.
- Existing API, strict-core, mutation authority, presentation, guidance and architecture gates continue to apply. Passing compilation alone does not establish connected acceptance.

The browser implementations of Lead qualification and Customer commercial actions retain Demo-only defaults. Their Connected workflow coordinators remain unavailable; the deployed backend Lead qualification workflow selects its authoritative default pipeline and first active OPEN stage. Connected forecast badges omit a category withheld by the server rather than deriving one from a stage code.
