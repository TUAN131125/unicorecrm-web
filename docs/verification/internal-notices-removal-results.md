# Internal Backend/access presentation removal

Ngày kiểm tra: 23/10/2026. Yêu cầu mới thay thế chính sách tự ẩn 4 giây: informational access notices không được render ngay từ đầu. Không commit/push/merge.

## A. Root cause

`EffectiveRecordAccessBoundary` chủ động render banner về Backend/field restrictions sau khi có quyền đọc. `EffectiveAccessNotice` thêm counter/shield/popover; `TransientInfoNotice` chỉ ẩn chúng sau 4 giây. `PermissionRouteGuard` còn mount `ReadOnlyAccessBanner`. Đây là nguyên nhân notice vẫn xuất hiện khi mở trang, refresh hoặc đổi record.

Rà soát còn tìm thấy inline read-only reminders ở Studio/People, loading copy có chữ “from backend”, giải thích kiểm tra quyền trong Customer Relationship, placeholder integrity/health và mô tả chưa hỗ trợ nhắc đến Backend. Các phần này được loại bỏ hoặc đổi sang thông điệp nghiệp vụ. Loading, unavailable data và actionable warnings vẫn được giữ.

Error mapper trước đây ưu tiên `userMessage`, trong khi HTTP adapter có thể lấy giá trị đó từ ProblemDetails title. Startup failure còn render trực tiếp exception message trong `<pre>`, workspace gate có thể gắn diagnostic vào câu lỗi. Những đường hiển thị này được sửa ở Presentation; không đổi API contract, error classification hoặc quyết định quyền.

## B. Notice inventory

| Loại | Kết quả |
|---|---|
| Backend read-only banner, “Quyết định từ backend”, protected-field count, FLS shield/popover | Bỏ render branch; không tạo DOM, badge, placeholder hoặc timer |
| Generic module read-only banner | Bỏ khỏi `PermissionRouteGuard`; giữ nguyên read-only mode/guard predicates |
| Chín Studio read-only paragraphs và People read-only label từ task trước | Bỏ informational JSX; quyền sửa/lưu không đổi |
| Customer Relationship explanation về Backend/source permission | Bỏ paragraph; source links vẫn có access checks |
| Customer integrity UNKNOWN placeholder | Không render; các data-integrity errors/warnings thực sự vẫn hiển thị |
| Customer health absence, unavailable commercial data, Dashboard unavailable reports | Giữ trạng thái đúng, dùng product copy; không fake zero hoặc fake data |
| Loading ở Customer, Deal, Contact-related/module detail, Order, Quote, Product, Support… | Giữ loading/cancel; bỏ chữ Backend khỏi copy |
| Organization archive confirmation/export unavailable, Customer onboarding help | Giữ thông tin hành động nghiệp vụ; bỏ giải thích kiến trúc |
| Permission denied, command denied, verification error, Retry, validation, conflict, network failure, critical warnings | Giữ và kiểm thử; không đặt trong auto-dismiss wrapper |
| Dedicated People/Access configuration, field permissions và internal DOM test attributes | Giữ chức năng quản trị/semantics; không phải decorative informational notices |

## C. Implementation

Core:

- `src/platform/access-control/react/EffectiveRecordAccessBoundary.tsx`: bỏ informational branch/import/count/deadline; giữ provider với `access.data`, required command check, canRead/canUpdate và các nhánh loading/denied/error/Retry. Legacy `showNotice` prop còn được nhận để không phá callers, nhưng không còn tạo UI.
- `src/components/PermissionRouteGuard.tsx`: bỏ banner và route-key plumbing chỉ phục vụ banner; các permission predicates, read-only semantics và denied UI không đổi.
- Xóa bốn file không còn consumer: `EffectiveAccessNotice.tsx`, `accessNoticeIdentity.ts`, `TransientInfoNotice.tsx`, `ReadOnlyAccessBanner.tsx`. Không giữ dead timer để che notice.
- Chín Studio view và `UsersPermissionsPage.tsx`: xóa đúng paragraph/badge informational đã bọc timer ở task trước. Không bỏ fieldset, form, save guard hoặc operational errors.

Error presentation:

- `src/shared/operations/errorPresentation.ts`: HTTP status-bearing errors không đưa remote `userMessage`/ProblemDetails title trực tiếp lên UI. Dùng copy theo category, fallback theo ngữ cảnh và curated code mapping. Ví dụ `CUSTOMER_CREDIT_BLOCKED` vẫn hướng dẫn cần phê duyệt; không bị gộp vào một lỗi chung.
- `backendAvailability.ts`: hành động chưa khả dụng vẫn báo rõ chưa thay đổi dữ liệu, bỏ giải thích “server support has not been released”. Không biến refusal thành thành công.
- `mutationState.ts`: field hints từ HTTP chỉ được trình bày cho validation; business blockers từ HTTP chỉ được trình bày cho business-rule errors. Infrastructure/auth errors không mượn các slot đó để đưa diagnostics ra UI. Structured validation hints và local business feedback được giữ.
- `src/main.tsx`: bỏ exception `<pre>` và copy startup nhắc API/identity internals. Lỗi khởi động vẫn là blocking alert với hướng dẫn tải lại/liên hệ quản trị.
- `RequireWorkspaceContext.tsx`: chỉ đổi error presentation sang normalized code/category và friendly fallback; không đổi membership/bootstrap/access workflow. Không render diagnostic hoặc phân nhánh theo `error.message`.
- `AppErrorBoundary.tsx`, `LazyRouteErrorBoundary.tsx`: public console không còn log nguyên exception/component stack từ các catch này; giữ metadata định tuyến/kind phù hợp và giữ error handling/actions.

Customer/Deal và các module khác chỉ đổi informational/loading/help copy hoặc bỏ placeholder; không redesign hoặc sửa commands. Guidance CRM/Studio/People được cập nhật VI/EN và version, bỏ target/tài liệu hướng dẫn timer/shield đã hết hiệu lực.

Tests:

- `tests/contract/access-notice-lifetime.test.mts` nay kiểm tra policy không render thông qua **actual boundary và field scope**, với authority fixture được ghi rõ là fixture: zero notice DOM/timer, READ_ONLY/HIDDEN/MASKED, required-command denial, record denial và verification Retry.
- Hai source contracts có yêu cầu banner theo policy cũ được cập nhật đúng yêu cầu mới: `check-effective-record-access-authority.mts`, `check-read-only-cross-domain.mts`. Các assertions về authority/provider/guards/write routes được giữ; không xóa security checks để vượt gate.
- `check-user-facing-error-presentation.mts`: thêm HTTP diagnostic/token/SQL-like payload fixtures, category distinctions, retained diagnostics/correlation ID, safe validation và non-success assertions.
- `tests/e2e/internal-notices.acceptance.ts`: private Connected browser; MutationObserver ghi nhận mọi lần các notice selectors được thêm vào DOM, kể cả thêm/rút trong cùng khoảng tải. Không fake API response. Nhánh opt-in trong dashboard harness không đổi startup hoặc CRM behavior.

Các regression fixtures opt-in có lệnh tái kiểm tra bên dưới; không thêm gate mới vào full pipeline. Danh sách file đầy đủ: [scope](../../review-artifacts/verification/evidence/internal-notices/frontend-scope.json).

## D. Before / after

Frontend HEAD `814cc4685b6d8f8ead2fc945f4607a2d0168320d`; Backend HEAD `13cd39eba01ebc9dc238f8b0ef98e174c1d4d3f6`, cùng local work đã có. Private Development host `127.0.0.1:5098`, Vite Connected `127.0.0.1:3039`, Playwright Chromium context riêng. Không điều khiển browser/desktop cá nhân.

Workspace demo `unicore-demo-anh-duong` (`ws_f2332a12d56a421d8a722bd2f65c5efb`); control `unicore-demo-anh-duong-control` (`ws_811689cfc4b446eab4f29dc109e2abf2`). Không seed lại hoặc thay account permissions.

| Viewport | Customer | Deal |
|---|---|---|
| 1440×900 | [Before](../../review-artifacts/verification/evidence/internal-notices/internal-notices-before-customer-desktop-initial.png) · [After](../../review-artifacts/verification/evidence/internal-notices/internal-notices-after-customer-desktop.png) | [Before](../../review-artifacts/verification/evidence/internal-notices/internal-notices-before-deal-desktop-initial.png) · [After](../../review-artifacts/verification/evidence/internal-notices/internal-notices-after-deal-desktop.png) |
| 1366×768 | [Before](../../review-artifacts/verification/evidence/internal-notices/internal-notices-before-customer-laptop-initial.png) · [After](../../review-artifacts/verification/evidence/internal-notices/internal-notices-after-customer-laptop.png) | [Before](../../review-artifacts/verification/evidence/internal-notices/internal-notices-before-deal-laptop-initial.png) · [After](../../review-artifacts/verification/evidence/internal-notices/internal-notices-after-deal-laptop.png) |
| 390×844 | [Before](../../review-artifacts/verification/evidence/internal-notices/internal-notices-before-customer-mobile-initial.png) · [After](../../review-artifacts/verification/evidence/internal-notices/internal-notices-after-customer-mobile.png) | [Before](../../review-artifacts/verification/evidence/internal-notices/internal-notices-before-deal-mobile-initial.png) · [After](../../review-artifacts/verification/evidence/internal-notices/internal-notices-after-deal-mobile.png) |

19 screenshots: 12 baseline initial/elapsed, sáu final Customer/Deal, một final blocking error. Baseline chứng minh notice hiện ban đầu rồi cả banner/indicator biến mất theo policy cũ; final chứng minh không render từ đầu. Baseline helper tái sử dụng có một mô tả legacy “indicator persists” không đúng với assertions/capture của lần này; không dùng dòng mô tả đó làm kết luận. Baseline assertions thực tế yêu cầu indicator count bằng 0 sau 4,5s; ảnh và raw API records được giữ nguyên để đối chiếu.

Final browser kiểm tra zero MutationObserver hits, zero notice/counter/wrapper selectors, refresh ở cả ba viewport, Customer khác, sau 4,5s vẫn không có notice và header gap dưới 24px. [Final JSON](../../review-artifacts/verification/evidence/internal-notices/internal-notices-after.json), [Baseline JSON](../../review-artifacts/verification/evidence/internal-notices/internal-notices-before.json).

## E. Security verification

- Actual boundary runtime fixture PASS: hidden value không có DOM; masked value chỉ có fallback; read-only fieldset disabled; `canUpdate=false` vẫn được truyền tới consumer. Denied command/record không render children; verification failure giữ Retry và không đưa diagnostic ra UI. Zero timeout 4.000ms được đăng ký trong fixture.
- Contact FLS form regression PASS: mapped READ_WRITE/READ_ONLY/HIDDEN, forged disabled update bị chặn, changed-field payload, failed draft và pending/missing access refusal. Đây là fixture, không đổi role ở SQL. [Log](../../review-artifacts/verification/evidence/internal-notices/contact-fls.log).
- Live browser abort transport thật `/access/records/evaluate`: blocking error/Retry còn sau 4,5s, Deal header bị giữ lại; Retry với API thật khôi phục được. Không trả success giả.
- Live control workspace không đọc được Demo Deal; denied UI còn sau thời gian chờ và không có stale record/header/notice.
- API contracts, generated clients, `EffectiveFieldAccessScope`, authority binding/evaluator, access caching/invalidation, field profiles và Backend source không thay đổi so với task-entry.
- SQL count/hash chín business tables ở toàn bộ workspace trước/sau identical. Không sửa SQL/connection string, seed, migration hoặc CRM records. Authentication/read audit bình thường vẫn do Backend ghi. [Preservation](../../review-artifacts/verification/evidence/internal-notices/after-data-preservation.json).

Remote HTTP error presentation và non-validation diagnostic slots đã có negative tests; validation/business messages vẫn có recovery cụ thể. Không tuyên bố đã kiểm toán mọi hệ thống logging hoặc mọi live FLS permutation của Backend.

## F. Quality results

| Kiểm tra | Kết quả |
|---|---|
| Customer/Deal immediate entry, refresh, record switch, desktop/laptop/mobile | PASS; zero notice flashes |
| Lead/Contact/Organization/Task/Support list + detail, Dashboard, Customer/Deal/Product list | PASS trong phạm vi absence checks và scoped API reads |
| Product Detail | FAIL có sẵn: rendering error boundary. Chỉ đổi loading copy, không sửa lỗi Product trong task |
| Verification failure, command/record denied, Retry, tenant isolation | PASS |
| Real Studio/People read-only account activation | NOT_RUN; browser session dùng demo owner. Informational JSX đã xóa, không tạo role fixture |
| Actual boundary presentation fixture / Contact FLS fixture | PASS |
| Error handling / user-facing error safety / error presentation / mutation conflict UX | PASS |
| Effective-record-access / read-only cross-domain / access-control contracts | PASS |
| Customer / Deal / UI parity / presentation responsibility | PASS |
| Guidance contracts/runtime / API contract / frontend-backend separation | PASS |
| Typecheck | PASS 3/3 |
| Production build + bundle budget | PASS: entry 290,08 KiB; largest guidance chunk 490,60 KiB / 500 KiB |
| Full verify | FAIL: ba TypeScript diagnostics có sẵn ở `deal-quote-transition-outcome.test.mts:42`, `studio-first-visit.spec.ts:50,51`; các file đó không đổi |
| `quality.quality-pipeline` | FAIL có sẵn: `347 !== 345`; không sửa checker/manifest để che lỗi |
| Git diff whitespace / repository inventory | PASS; scope proof kèm theo |

[Typecheck](../../review-artifacts/verification/evidence/internal-notices/typecheck.json), [Build](../../review-artifacts/verification/evidence/internal-notices/build.log), [Full verify](../../review-artifacts/verification/evidence/internal-notices/full-verify.json), [Boundary fixture](../../review-artifacts/verification/evidence/internal-notices/access-presentation.log). JSON từng targeted gate được lưu cùng thư mục.

Full verify dừng ở lint nên các bước phía sau trong full run là NOT_RUN; targeted checks được chạy riêng như bảng. Browser process PASS nghĩa là acceptance cho notice/error đã hoàn tất; Product failure được ghi riêng trong checks JSON. Các copy/error-mapping chỉnh cuối được kiểm tra lại bằng targeted error tests, typecheck/build; không nhận vơ full-suite PASS.

## G. Git preservation và reproduction

Task-entry status/diff/hash nằm tại `artifacts/internal-notices/baseline/`. Bốn source files đã xóa là cleanup có chủ đích của feature notice/timer, có bản sao `.snapshot` riêng dưới baseline; không phải mất local work. Những file khác được đối chiếu hash, mọi thay đổi thuộc presentation/guidance/tests/docs đã liệt kê. [Frontend scope](../../review-artifacts/verification/evidence/internal-notices/frontend-scope.json), [Backend scope](../../review-artifacts/verification/evidence/internal-notices/backend-scope.json).

Không reset/stash, sửa Backend, permission hoặc seeded workspace; chưa commit/push/merge. Private test processes được dừng sau acceptance. Screenshots/reports là artifacts có chủ đích; không lưu credential hoặc database files vào source.

Frontend:

```powershell
node --import tsx tests/contract/access-notice-lifetime.test.mts
node --import tsx tests/quality/integration/check-contact-fls-form.mts
npm run typecheck
npm run quality:gate -- --gate quality.effective-record-access
npm run quality:gate -- --gate quality.read-only-cross-domain
npm run quality:gate -- --gate quality.user-facing-error-presentation
npm run quality:gate -- --gate quality.error-handling
npm run build
```

Browser, từ Backend với Development configuration hiện hữu:

```powershell
$env:UNICORECRM_INTERNAL_NOTICES_PHASE='after'
./scripts/verify-connected-dashboard.ps1 -Phase after
Remove-Item Env:UNICORECRM_INTERNAL_NOTICES_PHASE
```

Harness có sẵn fail closed nếu không đúng local `DESKTOP-ICH225R / UnicoreCRM_Development`, chạy host-only mode không delivery/bootstrap/seed. Không sửa script Backend trong task này. Các notice bị loại bỏ không có timer, placeholder, opacity/visibility hack hoặc badge thay thế.
