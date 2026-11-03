# Deal Detail workspace verification

## A. Baseline và authority

Frontend branch `feat/deal-compact-kanban-card`, HEAD `814cc4685b6d8f8ead2fc945f4607a2d0168320d`. Backend branch `master`, HEAD `13cd39eba01ebc9dc238f8b0ef98e174c1d4d3f6`. Checkout có nhiều local changes từ trước; task-entry status, diff và SHA-256 nằm trong `artifacts/deal-detail-design/baseline/`. Không reset, stash, commit, push hoặc merge.

Đã đọc HTML/CSS `C:/Users/welcome/Downloads/UniCoreCRM_DealDetail_V5_StudioPipeline.html`. Dùng bố cục, spacing, pipeline ngang, hierarchy và năm tab làm reference; không đưa scenario controls, dữ liệu, JavaScript mô phỏng hoặc fake success của prototype vào ứng dụng.

Trước sửa, Detail xếp nhiều khối theo chiều dọc; phép tính có trọng số bị gọi là AI; sidebar trộn chuyển stage, báo giá và kết quả. Quote lấy từ collection snapshot chưa chắc hydrate. Link List → Detail qua legacy redirect làm mất `returnTo`; browser đã phát hiện Back mất view sau refresh.

| Operation | Bằng chứng owner hiện tại | Kết luận |
|---|---|---|
| Get Deal | `DealsEndpoints`, GetDeal handler, existing HTTP runtime | Authoritative Connected read |
| Change stage | ChangeDealStage handler + `Deal.ChangeStage` | Canonical open stages khác current; terminal/archive bị chặn, progressive validation vẫn tại Backend |
| Mark Lost | Existing typed command, reason/recycle/revisit validation | Giữ workflow; không mutate shared demo trong acceptance |
| Mark Won | Command tồn tại nhưng validation hiện chỉ kiểm tra shape evidence | **BLOCKED_CONTRACT**: không đủ xác minh chứng từ liên owner; Connected confirm bị vô hiệu |
| Forecast / next action | Existing owner commands và read-model fields | Giữ thông tin, không thay workflow ghi tại List |
| Quote | Backend `QuotesEndpoints` chỉ map GET list/detail | Read qua owner; **BLOCKED_CONTRACT** với create/send/accept/order workflows trong Connected Detail |
| Follow-up Task | Task API + existing `DealFollowUpTasks` | Giữ scoped read, mở Task và TaskCreateModal; không giả atomic Deal + Task |
| Deal Activity | GET `/activities` có record filters; LogActivityValidation chỉ nhận leads/contacts/organizations/customers | Empty read được đối chiếu; **BLOCKED_CONTRACT** cho ghi trực tiếp Deal Activity |
| Studio pipeline | `useDealStages` → official stages service; Connected composition hiện mirror danh mục chuẩn, chưa hydrate pipeline cấu hình | UI động; **BLOCKED_CONTRACT** cho live custom Studio configuration |

Các giới hạn trên được giữ nguyên; không sửa Backend, Studio UI, schema, OpenAPI, generated clients hoặc permissions để vượt chúng.

## B. Implementation

- Header dùng shared RecordDetailHeader, Back thật, buyer name qua authorized detail query; ID chỉ sao chép trong More menu. Summary hợp nhất amount/currency, score, expected close, weighted forecast và stage. Không fallback currency sang VND trong summary/forecast/Quote mới.
- Forecast dùng decimal-string `percentageOfMoney`: **Amount × Opportunity Score / 100**, giữ đúng score 0; đây là phép tính hiển thị, không phải AI hoặc doanh thu đã ghi nhận. DateOnly giữ ngày lịch; timestamps theo timezone của workspace.
- Pipeline đọc `stageConfigs` từ hook/runtime hiện hữu, sắp theo order; open stages cuộn ngang trong container. Current inactive vẫn hiện; terminal Won/Lost tách khỏi open sequence. Chỉ đánh dấu visited khi có history thật, không coi mọi stage đứng trước current là đã đi qua.
- Năm tab Overview/Quotes/Tasks/Activity/Forecast, có ARIA tab semantics, keyboard Left/Right/Home/End, overflow nội bộ trên mobile. Panel phải gồm next action, management và buyer; tablet/mobile xếp lại theo grid. Task panel/tab cập nhật khi owner phát invalidation sau command; reference Task của next action có link riêng khi được phép đọc.
- Stage selector chỉ đưa canonical open choices được deployed Backend nhận trong Connected Mode. Submit có pending lock, stable idempotency key và expected version; giữ stage cũ đến khi command commit. Lỗi/conflict hiển thị với Retry. Không có Settings hoặc icon mũi tên trên nút lifecycle.
- Quote dùng public `readQuotePage`, một page 10 bản ghi lọc `sourceDealId`, không thay toàn bộ global collection. Loading/error/Retry/denied/empty và pagination được phân biệt. Amount/currency/status/ngày thuộc Quote owner; không suy từ Deal. Overview ưu tiên khi có relationship thật; không hardcode `PROPOSAL`. Chưa có owner semantic xác định custom stage “cần báo giá” khi chưa có relationship.
- Activity đọc một page 30 bản ghi từ Tasks owner, scoped theo Deal; giữ filter và timeline history cũ nếu runtime cung cấp. Không tạo SYSTEM Activity. Connected không hiện note-write CTA khi owner chưa nhận Deal reference.
- Deal Detail yêu cầu đúng vocabulary FLS của owner (`name`, `stageCode`, `opportunityScore`, v.v.) qua boundary hiện hữu, thay vì dựa vào alias `title/stage/probability` mà owner báo HIDDEN. Không đổi policy, evaluator hoặc catalog toàn hệ thống. Giá trị HIDDEN không render; MASKED không render giá trị gốc; lifecycle buttons cần quyết định command và field write tương ứng.
- Sáu entry mở Detail từ Deal List đi thẳng canonical workspace route, giữ path/query đang có trong history state. Back giữ Kanban/Table qua refresh; deep link fallback về Deal list của workspace hiện tại. Filter/search local của List chưa có URL restoration contract, không tuyên bố đã bổ sung.

Các nhóm file: `DealDetailView`, HeaderSection, PipelineWorkspace, CommercialWorkspace, QuoteWorkspace, ActivityTimeline, Sidebar/SidebarActions/RelatedRecords/Dialogs; thêm Overview, Forecast, Products, NextActionPanel, Field và presentation helpers; controller + scoped Quote/Activity hooks; `DealFollowUpTasks`, DetailPage, List detail links; public Quote read facade; bilingual Deal guidance; tests/fixtures và tài liệu. Danh sách chính xác trong [scope evidence](../../review-artifacts/verification/evidence/deal-workspace/scope.json).

## C. Functional preservation matrix

| Existing function | Vị trí mới | Trạng thái |
|---|---|---|
| Loading/error/Retry/record denied | Existing query/access boundaries | Preserved |
| Deal name, buyer, ID, audit | Compact header, More menu | Preserved; không đưa raw ID lên header |
| Stage badge/progress | Header + horizontal pipeline | Changed presentation; dynamic configs |
| Next stage | Management select + Update stage | Changed; typed command/acknowledgement/concurrency retained |
| Won/Lost | Management + existing dialogs | Preserved; Connected Won confirm blocked pending evidence verification |
| Lost reason, notes, recycle, revisit, dirty guard | Lost dialog | Preserved; friendly labels, existing versioned command semantics retained |
| Forecast history/amount/score/category | Forecast tab | Preserved; no fake AI/healthy assessment |
| Expected-close overdue / provided risk warning | Summary date + Next Action panel | Preserved; overdue uses workspace calendar day, no fabricated risk assessment |
| Next-step draft copy | More menu | Preserved; copy acknowledgement/error |
| Deal notes | Overview | Preserved |
| Commercial product lines/picker/edit/remove | Overview products + existing picker modal | Preserved in supported demo runtime; Connected commercial-line writes unavailable, controls omitted |
| Quote relationships/status/amount | Quotes tab + relationship spotlight | Authoritative bounded read; Connected writes blocked; supported demo actions retained |
| Follow-up Task list/create/open | Tasks tab + Next Action panel | Preserved; independent Task command |
| Activity filters/history/manual note | Activity tab | Existing history preserved + scoped read; Connected Deal-note write blocked by owner contract |
| Buyer navigation | Buyer panel | Authorized Contact/Organization name and link |
| Contact phone/email details | Buyer → authorized Contact detail | Changed location; no communication fields inferred from Deal snapshots |
| Legacy Customer segment/health/MRR/owned-product card | Canonical buyer navigation | Connected enrichment in Deal is BLOCKED_CONTRACT pending an admitted authoritative relationship projection; no cached/default-zero financial claims |
| Linked orders/commercial lineage | Management detail link + More menu list link + existing lineage panel | Retained where authoritative data is supplied; no fake order/payment totals |
| Access/FLS/workspace authority | Existing mechanisms + field presentation | Preserved; no permission/config mutations |

## D. Dynamic pipeline verification

Presentation fixtures use a separate Vite entry under `tests/fixtures/`, demo service bindings and isolated browser storage; **no Connected Backend or SQL**. The entry is not imported by the application or a production route.

| Scenario | Presentation result | Connected result |
|---|---|---|
| Default pipeline | PASS | PASS; existing canonical catalogue |
| 3 active open stages | PASS | BLOCKED_CONTRACT for configurable live catalogue |
| 8 open stages / long labels / custom current stage | PASS | BLOCKED_CONTRACT for custom-code configuration/transitions |
| Current inactive / reordered stages | PASS | NOT_RUN on shared configuration; no Studio mutation |
| Won / Lost | PASS; outcome separated, ordinary selector absent | Outcome mutations NOT_RUN; Won guard PASS |

Fixtures deactivate stages or add custom stages through the demo runtime; they do not prove Studio can delete system stages. `normalizeDealStageConfigs()` still preserves required system entries. Domain normalization and deployed state machine are unchanged.

Minimum future owner work: expose/hydrate the admitted workspace stage catalogue and have the Deal command validate the same catalogue; define quote-related stage semantics if required. No substitute catalogue endpoint was added here.

## E. Quote state matrix

| State | Presentation desktop/mobile | Connected functional |
|---|---|---|
| No Quote | PASS | PASS scoped empty API/UI |
| DRAFT | PASS | NOT_RUN: dataset has no Quote rows |
| REVIEW | PASS | NOT_RUN |
| SENT | PASS | NOT_RUN |
| ACCEPTED | PASS | NOT_RUN; never treated as automatic Won permission |
| REJECTED | PASS | NOT_RUN |
| EXPIRED | PASS | NOT_RUN |
| Multiple Quotes | PASS | NOT_RUN |

Fixture Quote amount is USD 12,500.50, deliberately different from the VND Deal amount; display comes from Quote data. Full fixture results and screenshots: [presentation evidence](../../review-artifacts/verification/evidence/deal-workspace/presentation/results.json). Quote network-error/permission permutations are not claimed as live PASS; friendly states are implemented and shared error/access regressions are run separately.

## F. UI before / after

| Viewport | Before | After |
|---|---|---|
| 1440×900 | [Before](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-before-desktop.png) | [After](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-after-desktop.png) |
| 1366×768 | [Before](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-before-laptop.png) | [After](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-after-laptop.png) |
| 1024×768 | [Before](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-before-small-desktop.png) | [After](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-after-small-desktop.png) |
| 768×1024 | [Before](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-before-tablet.png) | [After](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-after-tablet.png) |
| 390×844 | [Before](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-before-mobile.png) | [After](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-after-mobile.png) |

Connected browser uses the existing demo owner and workspace `unicore-demo-anh-duong` (`ws_f2332a12d56a421d8a722bd2f65c5efb`); private ApiHost 5098/Vite 3039/Playwright Chromium. No personal browser/desktop interaction. Browser checks page overflow, header, all tabs, refresh, selector/terminal exclusions, Won guard, Lost dialog, Task navigation, Back for both views, deep link fallback, and foreign Deal refusal in `unicore-demo-anh-duong-control`.

Live CRM writes intentionally NOT_RUN: no disposable Deal with rollback setup was created, and shared demo records were not mutated. Test-runtime controller acceptance separately verifies commit/pending/conflict behavior. Do not interpret a fixture PASS as a Connected mutation PASS.

## G. Quality, security và data preservation

Evidence: [Connected checks](../../review-artifacts/verification/evidence/deal-workspace/deal-workspace-after.json), [SQL preservation](../../review-artifacts/verification/evidence/deal-workspace/after-data-preservation.json), [Activity references](../../review-artifacts/verification/evidence/deal-workspace/sql-activity-relations.json), [controller fixture](../../review-artifacts/verification/evidence/deal-workspace/workspace-contract.log).

SQL identity remains `DESKTOP-ICH225R / UnicoreCRM_Development`; connection string unchanged. All nine CRM business-table counts/hashes across all workspaces remain identical. Demo retains 180 Deals, 160 Tasks, 300 Activities, and all other seeded records. SQL confirms **all 300 Activities reference contacts**, zero direct Deal Activity rows. Empty Deal Activity UI matches the scoped API; non-empty Connected timeline remains NOT_RUN/BLOCKED_CONTRACT rather than borrowing Contact history. Normal auth/read audits are Backend-owned side effects.

| Check | Result |
|---|---|
| Connected read/layout/navigation/refresh/Back/Task/Won guard/isolation | PASS; see final JSON |
| Pipeline/Quote presentation matrix | PASS, 34 desktop/mobile scenarios |
| Actual controller pending/duplicate/conflict/retry/version + field DOM fixture | PASS; test runtime only |
| Existing Deal/Product real-form regression + scoped Task integration contract | PASS; controller fixture bổ sung authority boundary, giữ nguyên assertions về draft/version/pending |
| HIDDEN/MASKED withheld, FLS READ_ONLY cannot stage-update/close | PASS fixture; explicit close-command authority remains distinct from generic profile update; no role changes |
| Effective record access / read-only cross-domain / mutation authority/conflict UX | PASS |
| Deal lifecycle/stage localization/module/API boundary | PASS |
| Quote presentation, guidance contracts/runtime, presentation responsibility | PASS |
| API contract / frontend-backend separation | PASS |
| Typecheck | PASS 3/3 |
| Production build / bundle budget | PASS; recorded build log |
| Repository inventory / git diff whitespace | PASS |
| Full verify | FAIL pre-existing: `deal-quote-transition-outcome.test.mts:42`, `studio-first-visit.spec.ts:50,51`; source hashes unchanged |
| Quality pipeline | FAIL pre-existing count `347 !== 345`; manifest/checker unchanged |
| Bilingual gate | FAIL pre-existing eight literals in TelegramConnectionPanel, DealBuyerPicker, LeadQualificationView; files unchanged |
| Backend-readiness gate | FAIL pre-existing missing status entries for two Studio design documents; unrelated docs not changed |
| Live stage/mark-lost/create-task/note-write mutations | NOT_RUN on shared demo; direct Deal note-write BLOCKED_CONTRACT |

Initial test failures helped identify the Back regression and selector semantics. The final Activity assertion compares actual API item count and empty state; it does not assume the workspace's Contact activities belong to a Deal. Full verify stops at lint; later full-pipeline gates are NOT_RUN, with focused gates executed independently. No gate assertions were weakened and no unrelated failures fixed. Một lượt compiler/browser chạy đồng thời gặp heap OOM; chạy lại tuần tự với Node heap 4 GiB chỉ còn ba diagnostics có sẵn đã liệt kê.

## H. Git status và reproduction

Only the frontend presentation, necessary public Quote read facade, related guidance/tests/docs were edited. Backend source, permissions, seed/configuration, SQL records and existing user work were not changed. Scope proof lists task-entry files changed and files added; no baseline files were deleted. No commit/push/merge. Private servers are stopped after acceptance; screenshots/logs are deliberate evidence artifacts, with no bearer token, password, raw trace or local database file.

Frontend reproduction:

```powershell
node --import tsx tests/contract/deal-workspace.test.mts
npx playwright test --config playwright.deal-presentation.config.ts
npm run typecheck
npm run quality:gate -- --gate quality.deals
npm run quality:gate -- --gate quality.deal-lifecycle-contracts
npm run quality:gate -- --gate quality.quote-presentation-contracts
npm run quality:gate -- --gate quality.effective-record-access
npm run quality:gate -- --gate quality.presentation-responsibility
npm run build
```

Nếu compiler chạm heap mặc định, chạy full verify với heap chỉ áp dụng cho process hiện tại (không đổi project config):

```powershell
cmd /d /c 'set "NODE_OPTIONS=--max-old-space-size=4096" && npm run verify'
```

Connected read-only acceptance, from Backend with existing Development configuration and secrets:

```powershell
$env:UNICORECRM_DEAL_WORKSPACE_PHASE='after'
./scripts/verify-connected-dashboard.ps1 -Phase after
Remove-Item Env:UNICORECRM_DEAL_WORKSPACE_PHASE
```

Existing harness fails closed unless the verified local Development SQL identity matches, starts host-only mode without bootstrap/migration/seed/delivery, and checks business data preservation. It was not modified for this task. New test helper is opt-in in the existing frontend browser harness. Report and fixture outputs describe a UI implementation with explicit owner-contract gaps, not an assertion that custom Studio pipelines or commercial completion are live-ready.
