# Remaining informational access notices — verification

Ngày kiểm tra: 23/10/2026. Frontend presentation only. Không sửa Backend, SQL records, permission, FLS decision, business command hoặc seeded workspace. Không commit/push/merge.

## A. Root cause

`EffectiveAccessNotice` chỉ đặt banner lớn trong `TransientInfoNotice`. Dòng `N trường được bảo vệ`, nút khiên và popover là sibling bên ngoài timer, có `mb-3` và button cao tối thiểu 32px. Vì vậy timer kết thúc vẫn còn indicator và khoảng cách trước record header.

Baseline browser tái hiện chính xác trường hợp này trên Customer (15 fields) và Deal (5 fields), cả 1440×900, 1366×768 và 390×844. Trong phiên baseline, banner lớn đã tự ẩn sau 4,5 giây; không tái hiện việc banner lớn tồn tại vô hạn trong phiên ổn định. Indicator vẫn tồn tại ở mọi viewport. Không suy diễn khác với bằng chứng.

Ngoài ra, timer cũ thuộc mount của notice. Khi boundary tạm ngừng render nội dung để xác minh lại quyền, notice có thể mount lại và nhận thêm 4 giây dù quyết định không đổi. Runtime regression fixture kiểm tra nhánh này; phiên browser ổn định không tự phát sinh refetch liên tục.

Chính sách trước giữ compact indicator cố định; yêu cầu hiện tại thay thế chính sách đó. Không thêm một badge cố định khác.

## B. Component inventory

| Component / bề mặt | Loại | Hành vi cuối |
|---|---|---|
| `EffectiveRecordAccessBoundary` → `EffectiveAccessNotice` | Informational read-only/protected fields | Banner, count, shield và popover cùng lifetime 4.000ms |
| Lead, Contact, Organization, Customer, Deal, Task, Support detail | Consumer của boundary | Kế thừa hành vi chung; không sửa riêng từng detail |
| Quote detail/builder, Order detail/form, Shipping detail/create, Return detail/form, Support form | Consumer khác của boundary | Cùng implementation; không thay đổi guard/command |
| `PermissionRouteGuard` → `ReadOnlyAccessBanner` | Informational module read-only | Tiếp tục dùng timer chung; key theo route đã có được giữ nguyên |
| Studio BusinessInformation, LocaleRegion, FeatureUsage, PipelinesStatuses, ProductTypes, InformationFields, PaymentInformation, InvoiceInformation, Integrations | Inline read-only configuration reminders | Wrap bằng `TransientInfoNotice`; điều kiện `!canConfigure` và field/action guards giữ nguyên |
| `UsersPermissionsPage` read-only mode label | Informational badge | Dùng cùng `TransientInfoNotice`; quyền cấu hình không đổi |
| `EffectiveFieldAccessScope` | FLS enforcement, không phải notice | Không sửa; HIDDEN/MASKED/READ_ONLY giữ nguyên |
| Product detail | Protected module read riêng | Không dùng informational effective-boundary banner; không thêm timer vào read/error boundary |
| Permission denied, access verification failed, authentication/security/validation/network errors, Retry, critical/business warnings | Blocking/actionable/context quan trọng | Không wrap trong timer, không tự ẩn |

Các mô tả nghiệp vụ như “trường chỉ đọc vì save contract chưa hỗ trợ”, nhãn vai trò điều hướng, cảnh báo Deal quá hạn và Telegram security/admission errors được giữ nguyên. Chúng không phải lời nhắc informational về quyền truy cập của bản ghi.

## C. Implementation

- `src/platform/access-control/react/EffectiveAccessNotice.tsx`: đặt toàn bộ group banner + indicator + portal trong **một** transient lifetime. Hết lifetime thì cả group unmount; không còn node rỗng, margin hoặc indicator thay thế.
- `src/shared/components/ui/TransientInfoNotice.tsx`: giữ timeout và cleanup tập trung; fade/collapse 180ms, reduced motion 0ms. Optional deadline giúp phục hồi cùng thời hạn khi notice remount trong một boundary còn sống.
- `useTransientInfoNoticeDeadline` trong cùng file chỉ giữ semantic key và thời điểm kết thúc bằng một ref có kích thước cố định. Không cache record data hoặc authorization result. Bỏ qua giai đoạn chưa có decision; decision thực sự thay đổi, kể cả thu hồi rồi cấp lại quyền, tạo lifetime mới.
- `src/platform/access-control/react/EffectiveRecordAccessBoundary.tsx`: cung cấp semantic deadline trước các nhánh loading/denied; giữ nguyên toàn bộ predicates, provider, canRead/canUpdate, requested commands/fields và error/Retry branches.
- Chín Studio view và một People page nêu ở inventory: thêm shared wrapper quanh đúng informational paragraph/badge. Không sửa mutation, validation, state machine hoặc quyền.
- `src/guidance/content/crm/extendedScreens.ts`, `studio/configuration.ts`, `people/screens.ts`: guidance VI/EN và version cập nhật; không còn hướng dẫn rằng shield tồn tại cố định. Walkthrough target của notice vẫn optional.
- `tests/contract/access-notice-lifetime.test.mts`: runtime fixture dùng component thật, kiểm tra cùng deadline qua rerender/refetch/remount, semantic permission change, revoke/restore, workspace/record reset, DOM removal và error ngoài timer.
- `tests/e2e/remaining-access.acceptance.ts`, nhánh opt-in trong `dashboard-connected.spec.ts`: private Connected browser acceptance. Không gọi CRM mutation hoặc giả API response.
- Lifecycle/FLS fixture và browser acceptance là các targeted checks opt-in, được chạy bằng lệnh tái kiểm tra ở cuối tài liệu. Không thêm gate vào full pipeline trong task này; đây là exclusion có chủ đích để giữ nguyên verification ownership và lỗi gate count ngoài phạm vi.
- `docs/document-status.json` và repository inventory: đăng ký tài liệu/evidence của task.

Không sửa `accessNoticeIdentity`, `useEffectiveRecordAccess`, access authority/cache/invalidation, field profiles, `EffectiveFieldAccessScope`, `PermissionRouteGuard`, Customer/Deal UI/business code hoặc Backend source.

## D. Browser evidence

Môi trường: Frontend HEAD `814cc4685b6d8f8ead2fc945f4607a2d0168320d`, Backend HEAD `13cd39eba01ebc9dc238f8b0ef98e174c1d4d3f6`, cùng local work đã có. Private ApiHost Development `127.0.0.1:5098`, Vite Connected `127.0.0.1:3039`, Playwright Chromium context riêng. Không điều khiển browser cá nhân.

Workspace `unicore-demo-anh-duong` (`ws_f2332a12d56a421d8a722bd2f65c5efb`), control `unicore-demo-anh-duong-control` (`ws_811689cfc4b446eab4f29dc109e2abf2`). Dùng tài khoản demo hiện hữu, credential chỉ trong bộ nhớ từ development configuration; không đổi account/role/permission để tạo fixture.

| Viewport | Customer sau sửa | Deal sau sửa |
|---|---|---|
| 1440×900 | [Ban đầu](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-customer-desktop-initial.png) · [Sau 4,5s](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-customer-desktop-elapsed.png) | [Ban đầu](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-deal-desktop-initial.png) · [Sau 4,5s](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-deal-desktop-elapsed.png) |
| 1366×768 | [Ban đầu](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-customer-laptop-initial.png) · [Sau 4,5s](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-customer-laptop-elapsed.png) | [Ban đầu](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-deal-laptop-initial.png) · [Sau 4,5s](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-deal-laptop-elapsed.png) |
| 390×844 | [Ban đầu](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-customer-mobile-initial.png) · [Sau 4,5s](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-customer-mobile-elapsed.png) | [Ban đầu](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-deal-mobile-initial.png) · [Sau 4,5s](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after-deal-mobile-elapsed.png) |

Baseline còn indicator sau timer: [Customer desktop](../../review-artifacts/verification/evidence/remaining-access/remaining-access-before-customer-desktop-elapsed.png), [Deal desktop](../../review-artifacts/verification/evidence/remaining-access/remaining-access-before-deal-desktop-elapsed.png), [Customer mobile](../../review-artifacts/verification/evidence/remaining-access/remaining-access-before-customer-mobile-elapsed.png), [Deal mobile](../../review-artifacts/verification/evidence/remaining-access/remaining-access-before-deal-mobile-elapsed.png). Bộ evidence có đủ 12 baseline screenshots, 12 screenshots sau sửa và một ảnh lỗi chặn.

Browser assertions kiểm tra banner/indicator/motion wrapper không còn trong DOM, header di chuyển lên và khoảng cách header với đầu boundary dưới 24px. Có kiểm tra reduced/default motion, refresh, record khác, tab/scroll không kéo dài lifetime, quay lại các route và workspace isolation. [Baseline JSON](../../review-artifacts/verification/evidence/remaining-access/remaining-access-before.json), [Final browser/API JSON](../../review-artifacts/verification/evidence/remaining-access/remaining-access-after.json).

## E. Security regression

- Source đối chiếu task-entry: Backend không đổi; access evaluator, field scope, authority binding/cache/invalidation và module command implementations không đổi. Các nhánh denied/loading/error trong boundary giữ nguyên, chỉ thêm state thời gian cho presentation.
- API evidence thực tế có 19 access decisions, gồm một `canRead=false` ở workspace kiểm soát. Sau hơn 4 giây, foreign Deal vẫn bị chặn và record header không render. Không có stale notice của workspace demo.
- Abort transport thật tới `/access/records/evaluate` để kiểm tra lỗi mạng: “Không thể xác minh quyền truy cập” và Retry vẫn hiện sau 4,5 giây; record bị giữ lại cho tới khi Retry với API thật thành công. Không fake response hoặc thay policy.
- Contact FLS component regression PASS: READ_WRITE/READ_ONLY/HIDDEN mapping, forged disabled update bị từ chối, changed-field payload, failed draft và pending access refusal. Đây là fixture kiểm thử, không phải thay role ở database thật. [Log](../../review-artifacts/verification/evidence/remaining-access/contact-fls.log).
- Lifecycle runtime fixture xác nhận object decision không bị mutate; kiểm thử timer cùng các mode HIDDEN/MASKED/READ_ONLY và giữ blocking error ngoài lifetime. Nó không thay thế kiểm thử toàn bộ Backend policy. [Log](../../review-artifacts/verification/evidence/remaining-access/lifetime.log).
- Không gọi CRM mutations, không gửi email/webhook hoặc tích hợp bên ngoài. Harness kiểm tra count/hash chín business tables của toàn bộ workspace trước/sau identical. Authentication/read audit bình thường vẫn có thể được Backend ghi. [Preservation](../../review-artifacts/verification/evidence/remaining-access/after-data-preservation.json).

Không tuyên bố đã chạy mọi live FLS policy permutation hoặc kiểm thử mọi Customer/Deal command. Các command không được thực thi để giữ nguyên dữ liệu.

## F. Verification

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| Customer 15 protected fields, Deal 5 protected fields | PASS | Cả group mất sau timer ở ba viewport; không còn gap |
| Same-decision refetch/rerender, meaningful change, revoke/restore | PASS runtime fixture | Giữ deadline trong boundary; không đổi authority cache |
| Refresh, record change, leave/return, tabs/scroll | PASS browser | Repeated detail entries có lifetime mới; tabs/scroll không restart |
| Organization / Support detail | PASS browser | Có notice thật, expiry và boundary được kiểm tra |
| Lead / Contact / Task notice activation | NOT_RUN | Detail thật đã tải; mẫu hiện tại không quan sát thấy informational notice ban đầu. Không đổi quyền/data để ép kích hoạt |
| Product Detail | FAIL có sẵn | Protected API read riêng, màn hình vào rendering error boundary; source Product identical với task-entry, không sửa trong task này |
| Studio / People read-only notice activation với account thật | NOT_RUN | Code đã wrap timer chung; phiên browser dùng demo owner, chưa kích hoạt nhánh read-only ở các trang này |
| Permission denied / verification failure / Retry / isolation | PASS | Denied decision thật và transport failure thật đều giữ blocking UI sau timer |
| FLS form regression | PASS | Runtime fixture; không phải live policy mutation |
| Typecheck | PASS 3/3 | Strict core/type regions/type-safety budget |
| Production build / bundle budget | PASS | Entry 290,42 KiB; largest guidance chunk 497,67 KiB / 500 KiB |
| Effective access, access-control contracts, People UX | PASS | Registered focused gates |
| Customer/Deal contracts, UI parity, presentation responsibility | PASS | Registered focused gates |
| Guidance contracts/runtime, Studio single authority | PASS | Registered focused gates |
| `quality.quality-pipeline` | FAIL có sẵn | Hardcoded gate count `347 !== 345`; không sửa pipeline hoặc checker |
| Full `npm run verify` | FAIL có sẵn | Dừng ở global lint với ba TypeScript diagnostics ở hai test file ngoài phạm vi; các bước phía sau không được full run thực thi |
| SQL business preservation / Git preservation | PASS | Không seed, không sửa business records, không mất file task-entry |

Full verify diagnostics: `deal-quote-transition-outcome.test.mts:42` (`model` possibly null), `studio-first-visit.spec.ts:50,51` (`string | undefined`). Hai test file này không đổi so với task-entry. Full run được gọi trước bổ sung cuối về revoke/restore; final source đã chạy lại lifecycle fixture, typecheck, production build và Connected browser. Không nhận vơ full-suite PASS. [Full report](../../review-artifacts/verification/evidence/remaining-access/full-verify.json), [Typecheck](../../review-artifacts/verification/evidence/remaining-access/typecheck.json), [Build](../../review-artifacts/verification/evidence/remaining-access/build.log).

Browser test process PASS nghĩa là luồng notice đã chạy thành công; `products: FAIL` và các `NOT_RUN` được ghi riêng trong checks JSON, không được tính là những module đã PASS toàn bộ.

## G. Git status và tái kiểm tra

Task-entry Git status/diff/hash của cả hai repo nằm trong `artifacts/remaining-access/baseline/`. Final scope nằm tại [Frontend](../../review-artifacts/verification/evidence/remaining-access/frontend-scope.json) và [Backend](../../review-artifacts/verification/evidence/remaining-access/backend-scope.json). Không reset, stash, xóa local work hoặc tạo commit. Backend có **0 file task-entry thay đổi**; mọi source change thuộc presentation, guidance và verification được liệt kê ở trên.

Private servers do harness tạo đã được dừng sau acceptance. Test artifacts/screenshot được giữ có chủ đích cho review; không thêm credential hoặc database files vào source.

Chạy từ Frontend:

```powershell
node --import tsx tests/contract/access-notice-lifetime.test.mts
node --import tsx tests/quality/integration/check-contact-fls-form.mts
npm run typecheck
npm run quality:gate -- --gate quality.effective-record-access
npm run quality:gate -- --gate quality.access-control-contracts
npm run quality:gate -- --gate quality.customers
npm run quality:gate -- --gate quality.deals
npm run quality:gate -- --gate quality.guidance-contracts
npm run build
```

Browser, chạy từ Backend với configuration Development hiện tại, không seed hoặc sửa connection string:

```powershell
$env:UNICORECRM_REMAINING_ACCESS_PHASE='after'
./scripts/verify-connected-dashboard.ps1 -Phase after
Remove-Item Env:UNICORECRM_REMAINING_ACCESS_PHASE
```

Harness có sẵn xác minh đúng local `DESKTOP-ICH225R / UnicoreCRM_Development`, dùng host-only mode chặn background delivery và fail closed nếu khác môi trường. Không sửa script Backend trong task này. Không có workflow auto-dismiss mới cho security errors hoặc business warnings.
