# Frontend structure cleanup acceptance

Thời điểm: 2026-10-29T10:35:37+07:00 (Asia/Saigon).

Baseline branch `feat/deal-compact-kanban-card`, HEAD `70436019c34ad95626222e873312ccbfa1f9c17a`, 724 dirty paths. Không commit/push/merge/reset/rebase; không tạo Git worktree.

## 1. Root structure trước/sau

| Chỉ số | Trước | Sau |
|---|---:|---:|
| Root files | 46 | 43 |
| Root Playwright configs | 30 | 27 |
| Full config implementations tại root | 13 | 2 |
| Root compatibility entrypoints | 17 inherited suite selectors | 25 thin profile selectors |
| Supported CLI suite entrypoints, toàn repository | 30 | 30 |

Hai full root config giữ nguyên byte: `playwright.config.ts` (3 browsers/default runner) và `playwright.connected.config.ts` (local HTTP fixture hoặc external backend; CI và source-level harness contract). Các suite còn lại dùng 4 profile families + 4 profiles độc lập và shared path/environment helpers trong `tests/config/playwright/`.

25 root aliases được giữ vì backend scripts gọi trực tiếp. Việc bỏ các alias sẽ đòi hỏi sửa backend, nằm ngoài phạm vi. Ba config không có executable cross-repository caller đã chuyển vào thư mục tests. Không gom các suite thành một Playwright project hoặc thay đổi authentication/database/server lifecycle.

## 2. Inventory và decision matrix

`testDir` hiệu lực của cả 30 entrypoints vẫn là `tests/e2e`. Storage state/global setup/global teardown không được thêm hoặc thay đổi. Những suite cần đăng nhập tiếp tục dùng chính E2E implementation của chúng. Reporter/output paths, projects, retries, timeouts và env guards được so sánh trên config đã load bằng Playwright hiện có.

| File trước cleanup | Suite/testMatch | References thực thi | Unique behavior | Decision |
|---|---|---|---|
| `playwright.ai-connected.config.ts` | `ai-connected.spec.ts` | `backend/scripts/verify-ai-connected-browser.ps1` | ai-connected-chromium; http://127.0.0.1:3000; test timeout 30000 ms; server timeout 180000 ms | CONSOLIDATE + KEEP alias |
| `playwright.ai-workspace.config.ts` | `ai-workspace-connected.spec.ts` | `backend/scripts/verify-ai-workspace.ps1` | ai-workspace-chromium; http://127.0.0.1:3015; test timeout 30000 ms; server timeout 180000 ms | CONSOLIDATE + KEEP alias |
| `playwright.config.ts` | `default *.spec / *.test` | npm e2e/default CLI | chromium, firefox, webkit; http://127.0.0.1:3000; test timeout 30000, 30000, 30000 ms; server timeout 120000 ms | KEEP |
| `playwright.connected.config.ts` | `connected-backend.spec.ts, lead-owner-connected.spec.ts` | `frontend/unicorecrm-web/tests/tooling/run-connected-playwright.mjs`; `frontend/unicorecrm-web/tests/quality/architecture/check-connected-acceptance-harness.mts` | connected-chromium; http://127.0.0.1:3000; test timeout 30000 ms; server timeout 120000 ms | KEEP |
| `playwright.connections.config.ts` | `studio-connections.spec.ts` | Standalone CLI; chỉ thấy inventory/historical records | (default chromium); http://127.0.0.1:3039; test timeout 180000 ms; server timeout 120000 ms | RELOCATE |
| `playwright.contact-paging-kanban-real.config.ts` | `contact-paging-kanban-real.spec.ts` | `backend/scripts/verify-contact-paging-kanban-connected-browser.ps1` | real-sql-chromium; http://127.0.0.1:3018; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.crm-real.config.ts` | `crm-real.spec.ts` | `backend/scripts/verify-activity-security.ps1` | (default chromium); http://127.0.0.1:3039; test timeout 120000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.crm-ui.config.ts` | `crm-ui-real.spec.ts` | `backend/scripts/verify-activity-security.ps1` | (default chromium); http://127.0.0.1:3039; test timeout 120000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.customer-health-connected.config.ts` | `customer-health-connected.spec.ts` | `backend/scripts/verify-customer-health-connected-browser.ps1` | customer-health-connected-chromium; http://127.0.0.1:3000; test timeout 30000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.dashboard-connected.config.ts` | `dashboard-connected.spec.ts` | `backend/scripts/verify-connected-dashboard.ps1` | (default chromium); http://127.0.0.1:3039; test timeout 120000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.deal-pipeline-review.config.ts` | `deal-pipeline-final-review.spec.ts` | `backend/scripts/review-deal-pipeline-acceptance.ps1` | (default chromium); http://127.0.0.1:3042; test timeout 300000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.deal-pipeline.config.ts` | `deal-pipeline-connected.spec.ts` | `backend/scripts/verify-deal-pipelines.ps1` | (default chromium); http://127.0.0.1:3042; test timeout 300000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.deal-presentation.config.ts` | `deal-presentation.spec.ts` | Standalone CLI; chỉ thấy inventory/historical records | (default chromium); http://127.0.0.1:3041; test timeout 180000 ms; server timeout 120000 ms | RELOCATE |
| `playwright.multicurrency-connected.config.ts` | `multicurrency-connected.spec.ts` | `backend/scripts/verify-multicurrency-connected.ps1` | (default chromium); http://127.0.0.1:3039; test timeout 120000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-acceptance.config.ts` | `quote-acceptance-connected.spec.ts` | `backend/scripts/verify-quote-verified-acceptance.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-approval.config.ts` | `quote-approval-connected.spec.ts` | `backend/scripts/verify-quote-approval-synthetic.ps1`; `backend/scripts/verify-quote-approval.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-core.config.ts` | `quote-core-connected.spec.ts` | `backend/scripts/verify-quote-core.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 300000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-customer-response.config.ts` | `quote-customer-response-connected.spec.ts` | `backend/scripts/verify-quote-customer-decisions.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-delivery.config.ts` | `quote-delivery-connected.spec.ts` | `backend/scripts/verify-quote-delivery.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-documents.config.ts` | `quote-documents-connected.spec.ts` | `backend/scripts/verify-quote-documents-browser.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-identity.config.ts` | `quote-identity-connected.spec.ts` | `backend/scripts/verify-quote-identity-authority-browser.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-independent-review.config.ts` | `quote-independent-review-connected.spec.ts` | `backend/scripts/verify-quote-independent-review-browser.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-lifecycle.config.ts` | `quote-lifecycle-connected.spec.ts` | `backend/scripts/verify-quote-lifecycle-browser.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-list-pipeline.config.ts` | `quote-list-pipeline-connected.spec.ts` | `backend/scripts/verify-quote-list-pipeline.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 240000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-manual-source.config.ts` | `quote-manual-source-connected.spec.ts` | `backend/scripts/verify-quote-manual-source-browser.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-proof.config.ts` | `quote-proof-connected.spec.ts` | `backend/scripts/verify-quote-proof-storage.ps1`; `backend/scripts/verify-quote-proof-storage-browser.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.quote-scanner.config.ts` | `quote-scanner-connected.spec.ts` | `backend/scripts/verify-quote-proof-scanner-advanced.ps1`; `backend/scripts/verify-quote-proof-scanner-reads.ps1` | (default chromium); http://127.0.0.1:3044; test timeout 180000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.realistic-demo.config.ts` | `realistic-demo-connected.spec.ts` | `backend/scripts/seed-realistic-demo.ps1` | (default chromium); http://127.0.0.1:3039; test timeout 120000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.studio-connected.config.ts` | `studio-first-visit.spec.ts` | `backend/scripts/verify-studio-first-visit.ps1` | (default chromium); http://127.0.0.1:3039; test timeout 120000 ms; server timeout 120000 ms | CONSOLIDATE + KEEP alias |
| `playwright.support-connected.config.ts` | `support-connected.spec.ts` | Standalone CLI; chỉ thấy inventory/historical records | support-connected-chromium; http://127.0.0.1:3000; test timeout 30000 ms; server timeout 180000 ms | RELOCATE |

### Environment, reporters và output compatibility

| Family | Environment requirements và khác biệt được giữ |
|---|---|
| Default | CI forbidOnly/retries/HTML-list reporters, optional Chromium path/video flag; evidence ngoài repo từ UNICORE_TEST_EVIDENCE_DIR hoặc OS temp. |
| Connected root | Optional UNICORECRM_TEST_API_BASE_URL; nếu thiếu thì dùng đúng local HTTP fixture ở 4010. Giữ inherited env và development auth adapter. |
| CRM family | API được trim + email/password bắt buộc; port 3039, trace/video off; output riêng từng suite, Connections vẫn ghi external review directory; không thêm Chromium override. |
| Quote approval family | Exact ApiHost 127.0.0.1:5098 + evidence + email/password, strict port 3044; server reuse luôn false; trace/video off. 11 suite selectors vẫn độc lập. |
| Quote core | Exact 5098 + email/password + Deal fixture; timeout 300s, navigation timeout 30s, optional reuse Vite, evidence fallback OS temp. |
| Quote list/pipeline | Exact 5098 + evidence, không thêm yêu cầu credential mà config gốc không có; timeout 240s, không thêm Chromium override. |
| Deal pipeline/review | Exact 5098 + email/password + buyer fixture; port 3042, timeout 300s, optional reuse và evidence fallback giữ nguyên. |
| AI / Health / Support | External API bắt buộc, inherited env/development adapter; port 3000; project names riêng; Health server 120s, AI/Support 180s; giữ reporter shape và retain-on-failure trace. Không có stub fallback. |
| AI Workspace | API bắt buộc; port 3015, evidence từ UNICORECRM_AI_EVIDENCE; không thêm guards hay executable override. |
| Contact paging | API + workspace ID bắt buộc; port 3018, DISABLE_HMR=true, inherited env, paging evidence path và browser override giữ nguyên. |
| Deal presentation | Demo-only standalone fixture ở 3041, không backend/SQL, test timeout 180s, output test-results/deal-presentation. |

## 3. Configs hợp nhất / di chuyển / xóa

Gom logic đã trùng vào `crm.ts`, `quote-approval.ts`, `services.ts`, `deal-pipeline.ts`; giữ riêng `quote-core.ts`, `quote-list-pipeline.ts`, `ai-workspace.ts`, `contact-paging.ts`. `shared.ts` chỉ chứa frontend-root path resolution, inherited environment và optional Chromium launch options.

| Root path cũ đã không còn | Canonical path hiện tại |
|---|---|
| `playwright.connections.config.ts` | `tests/config/playwright/connections.config.ts` |
| `playwright.deal-presentation.config.ts` | `tests/config/playwright/deal-presentation.config.ts` |
| `playwright.support-connected.config.ts` | `tests/config/playwright/support-connected.config.ts` |

Ba path gốc trên thực sự được loại khỏi root bằng relocation có backup; suite implementation/coverage được giữ. **0 suite/E2E test/source nghiệp vụ bị discard; không có REMOVE_SAFE test/helper deletion khác.** Không có policy rejection trong task. Không xóa node_modules, dist, cache hoặc evidence để dọn cấu trúc.

## 4. Package, script và documentation references

- `package.json` và lockfile không đổi; hai tài liệu Markdown mới được đăng ký CURRENT/REFERENCE trong docs/document-status.json theo contract hiện có; giữ 23 public scripts và quality pipeline authority. Các caller backend/control/CI không cần sửa vì root aliases vẫn tồn tại. Không sửa quality assertions, budgets hoặc thresholds.
- `README.md` và `tests/config/playwright/README.md` hướng dẫn canonical paths, guard/environment ownership, CLI discovery và focused tooling check. Existing `npm run e2e -- --config …` hỗ trợ ba path mới, không thêm script ngoài public command contract.
- Không có dangling executable config reference. Historical source inventories, patches và recorded evidence được giữ nguyên ý nghĩa; bảng relocation trên là mapping cho những path đã ghi trong lịch sử.
- Machine inventory được regenerate bằng công cụ chuẩn sau structural change; không thay đổi protected module/route/capability counts để làm gate PASS.

## 5. Test discovery và compatibility

| Kiểm tra | Before | After |
|---|---:|---:|
| Configs load/list thành công với synthetic discovery bindings | 30/30 | 30/30 |
| Suite/project test entries (có overlap giữa default và focused suites) | 305 | 305 |
| Config environment variants được so sánh | 90 | 90 |
| Khác biệt về test file/line/title/project/config hiệu lực | — | 0 |
| Config negative/path/lifecycle tooling checks | — | 5/5 PASS |

Cả `playwright test --list` và config loader chỉ discover/load, không khởi động ApiHost/server hay thực thi SQL. Environment cho discovery là placeholder không phải credentials, SQL server placeholder không trỏ database thật. So sánh gồm missing bindings, CI/reuse/executable override; normalize path/cwd theo semantics của Playwright đã cài. Raw native baseline cũng được lưu ngoài repo.

| Suite | Test/project entries trước = sau |
|---|---:|
| `playwright.ai-connected.config.ts` | 1 |
| `playwright.ai-workspace.config.ts` | 1 |
| `playwright.config.ts` | 237 |
| `playwright.connected.config.ts` | 5 |
| `playwright.connections.config.ts` | 1 |
| `playwright.contact-paging-kanban-real.config.ts` | 2 |
| `playwright.crm-real.config.ts` | 1 |
| `playwright.crm-ui.config.ts` | 1 |
| `playwright.customer-health-connected.config.ts` | 4 |
| `playwright.dashboard-connected.config.ts` | 1 |
| `playwright.deal-pipeline-review.config.ts` | 1 |
| `playwright.deal-pipeline.config.ts` | 2 |
| `playwright.deal-presentation.config.ts` | 1 |
| `playwright.multicurrency-connected.config.ts` | 1 |
| `playwright.quote-acceptance.config.ts` | 3 |
| `playwright.quote-approval.config.ts` | 1 |
| `playwright.quote-core.config.ts` | 1 |
| `playwright.quote-customer-response.config.ts` | 3 |
| `playwright.quote-delivery.config.ts` | 5 |
| `playwright.quote-documents.config.ts` | 4 |
| `playwright.quote-identity.config.ts` | 2 |
| `playwright.quote-independent-review.config.ts` | 4 |
| `playwright.quote-lifecycle.config.ts` | 4 |
| `playwright.quote-list-pipeline.config.ts` | 1 |
| `playwright.quote-manual-source.config.ts` | 2 |
| `playwright.quote-proof.config.ts` | 5 |
| `playwright.quote-scanner.config.ts` | 3 |
| `playwright.realistic-demo.config.ts` | 1 |
| `playwright.studio-connected.config.ts` | 1 |
| `playwright.support-connected.config.ts` | 6 |

## 6. Build, lint và focused checks

| Command/check | Result |
|---|---|
| npm run typecheck | PASS 3/3 passed across 1 groups (29.1s). |
| npm run lint | PASS 1/1 passed across 1 groups (67.6s). |
| npm run build | PASS (production bundle + budget) |
| Route smoke | PASS 8/8 passed across 1 groups (76.9s). |
| Connected harness | PASS 1/1 passed across 1 groups (0.3s). |
| Quality pipeline contract | PASS 1/1 passed across 1 groups (4.4s). |
| Repository inventory | PASS 1/1 passed across 1 groups (5.5s). |
| Canonical npm run verify | FAIL 48/328 passed across 10 groups (201.1s). |
| Config tooling tests | 5/5 PASS |
| Original captured Deal presentation E2E | 1/1 PASS (34 presentation checks across desktop/mobile) |
| Relocated Deal presentation E2E, isolated rerun | 1/1 PASS (cùng assertions/fixtures; không SQL/backend) |

Lần presentation chạy đồng thời các validation đầu gặp ERR_INSUFFICIENT_RESOURCES của Chromium; đã đối chiếu lại tuần tự với executable config baseline và config mới, cả hai PASS. Không tăng timeout, đổi browser semantics hay sửa assertion. 35 ignored presentation evidence files đã có trước được backup và khôi phục đúng hash sau replay.

Default frontend-quality E2E có hai baseline failures ở selector mật khẩu không unique; runtime-ux baseline login cũng timeout trước cleanup. Không sửa business/auth UI để giải quyết trong task này. Không tuyên bố toàn bộ browser suite PASS. Các suite real SQL/mutation chỉ được list/load, không execute hoặc khởi động disposable SQL harness.

## 7. Source preservation

- Snapshot baseline + planned-file hashes và recovery paths: `D:/Project_All/UnicoreCRM-cleanup-recovery-20261029/frontend-structure/`. 723 bản dirty-file backup cũ khớp hash đã được tái sử dụng; original deleted path vẫn có Git history.
- Toàn bộ `src/`, API clients/contracts, routes, Vite/TypeScript configs, business tests/fixtures và Backend/Control source được bảo toàn; final hash audit ghi trong `preservation-final.json` ngoài Git.
- Không thay đổi business behavior, capabilities, authorization, authentication/session handling hoặc database. Không mở Manual Quote Acceptance hoặc Deal WON; chỉ giữ các test selectors đã tồn tại.
- Thay đổi chủ động: 25 root wrappers; 3 config relocations; 9 shared/profile TS files; 1 config README; 1 focused tooling test; root README; hai metadata entries trong docs/document-status.json; 2 generated repository inventories; acceptance report này. Tooling README đã được khôi phục về original byte, không phải change cần giao.

## 8. Remaining cleanup candidates

- Giữ 25 root aliases cho tới khi một task riêng được phép phối hợp sửa backend callers; hiện không thể giảm về một root config mà vẫn giữ các command đó.
- Raw exact-source hashing tìm thấy hai nhóm barrel files chỉ chứa export tương đối: guidance/workflow `export * from "./public"`, và năm module public `export * from "./api"`. Chúng resolve đến owner khác nhau và đang được dùng qua module boundaries; giữ nguyên, không gộp implementation.
- Không thấy duplicate component/hook implementation chính xác qua byte hashing. Semantic duplication/unused exports chỉ là candidate cần review riêng với runtime/dynamic imports; không xóa theo static import scan.
- Demo runtimes/dev-memory seeds, canonical-v1 migration preview, generated clients, module/route registries và regression fixtures được giữ theo ownership/runtime purpose.
- 14 evidence duplicate groups, CSS visual baseline mismatch và những quality debt có sẵn không được sửa bằng allowlist/threshold/snapshot updates. Inventory drift được xử lý bằng regeneration thực tế cho cây hiện tại; nếu gate còn lỗi, kết quả command thực tế được ghi ở trên.

## 9. Final verdict

- `FRONTEND_STRUCTURE_CLEANUP_PASS`: root implementation gọn hơn, configs dùng chung có ownership rõ, ba config đã relocate, executable callers vẫn hợp lệ.
- `PLAYWRIGHT_COMPATIBILITY_PASS`: 30/30 discovery, 305/305 entries, 90 variant comparisons không khác biệt, 5 tooling tests và controlled moved-config E2E PASS. Không bao gồm chứng nhận real SQL suites hoặc baseline UI tests đang FAIL.
- `FRONTEND_BUILD_PASS`: TypeScript 3/3, lint 1/1, production build/bundle budget và route-smoke 8/8 đều PASS. Canonical verify vẫn FAIL ở gate 49 do 14 evidence duplicate groups đã có trước; không đồng nghĩa full quality PASS.
- `SOURCE_PRESERVATION_PASS`: final hash/changed-path audit PASS; frontend application source, fixtures, Backend/Control và original presentation evidence được bảo toàn. HEAD/branch/index giữ nguyên, không có Git delivery trong task này.
