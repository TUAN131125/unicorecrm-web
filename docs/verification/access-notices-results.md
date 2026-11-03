# CRM Detail access notices — verification

Ngày kiểm tra: 2026-10-23. Phạm vi: Frontend presentation, không thay đổi Backend, SQL, seed, policy hoặc business command. Chưa commit/push/merge.

## Root causes và thay đổi

1. `EffectiveRecordAccessBoundary` render informational notice cố định theo `canUpdate` / số field restrictions. Component này độc lập với `ReadOnlyAccessBanner` đã sửa trước đó.
2. Hai loại notice nay dùng `TransientInfoNotice`: lifetime 4.000 ms, collapse/fade 180 ms, reduced motion 0 ms, cleanup khi unmount. Record notice được key theo workspace/resource/record và nội dung quyết định quyền. Thời điểm đánh giá, thứ tự field/command không làm reset; quyền hoặc record thay đổi làm reset. Refresh tạo lifetime mới.
3. `EffectiveAccessNotice` giữ indicator nhỏ và popover có keyboard/Escape/focus restoration. Chỉ nhận access decision, không nhận record values. Popover trình bày field key và access mode, không trình bày giá trị HIDDEN/MASKED. Không dùng raw server diagnostic/reason message.
4. Khi chuyển loading → error, translation bridge cũ ghi lại chữ “Hủy” lên nút Retry tái sử dụng DOM. Vùng verification/denied nay dùng `data-i18n-skip` vì component đã cung cấp VI/EN. Handler Retry/Cancel và điều kiện chặn truy cập không đổi. Lỗi vẫn nằm ngoài transient wrapper.
5. Header Deal fallback sang `buyerRef.id`; Deal read model authoritative chưa có buyer display-name projection. Header nay đọc đúng một Contact/Organization qua public module API theo quyền hiện tại, không đọc tên từ collection cache và không list toàn bộ. Hook hủy request cũ, kiểm tra authority và che kết quả của scope cũ. Buyer ref HIDDEN/MASKED không khởi chạy lookup. Failed read dùng trạng thái trung tính, không dùng raw ID/cached name. Deal ID chuyển vào More actions → Thông tin kỹ thuật.

Không sửa `canRead`, `canUpdate`, `allowedCommands`, `fieldAccess`, `EffectiveFieldAccessScope`, authority binding, permission guard, route, model, Quote/Stage hoặc command implementation. Card Buyer cũ trong sidebar Deal vẫn có technical relationship ID; thay đổi này giới hạn ở business header theo yêu cầu.

## File thay đổi trong task

- `src/shared/components/ui/TransientInfoNotice.tsx`: lifetime chung.
- `src/components/access/ReadOnlyAccessBanner.tsx`: dùng lại lifetime chung.
- `src/platform/access-control/react/EffectiveRecordAccessBoundary.tsx`: wrap informational notice, key quyết định, bảo vệ nhãn VI/EN của verification state.
- `src/platform/access-control/react/EffectiveAccessNotice.tsx`: compact indicator/popover.
- `src/platform/access-control/react/accessNoticeIdentity.ts`: identity của presentation, không thay đổi quyền.
- `src/modules/deals/presentation/hooks/useDealBuyerLabel.ts`: bounded authorized buyer lookup.
- `src/modules/deals/presentation/hooks/useDealDetailController.tsx`: kết nối read-only label state.
- `src/modules/deals/presentation/views/DealDetailHeaderSection.tsx`: tên buyer và metadata kỹ thuật.
- `src/guidance/content/crm/extendedScreens.ts`: VI/EN, version và optional shield walkthrough cho các detail dùng boundary.
- `tests/quality/architecture/check-effective-record-access-authority.mts`: semantic identity regression.
- `tests/e2e/access-notices.acceptance.ts`, `tests/e2e/dashboard-connected.spec.ts`: real Connected acceptance branch.
- `docs/document-status.json`, báo cáo/evidence này, `docs/quality/repository-inventory.json`/`.md`: tài liệu và structural inventory.

## Audit theo trang

| Trang | Informational access | Trạng thái giữ nguyên/persistent | UI mẫu thật |
|---|---|---|---|
| Lead | Boundary có `showNotice=false` từ trước; không bật thêm notice | Verification, permission denial, qualification/mutation errors | PASS: detail mở; không có informational notice |
| Contact | Boundary chung; mẫu không có restrictions | Verification/denial, pending request, outreach restriction/confirmation | PASS: detail mở; không có informational notice |
| Organization | Boundary chung: tự ẩn + indicator | Verification/denial, query errors, validation, contact restriction | PASS: notice ẩn, indicator còn |
| Customer | Boundary chung; module read-only notice dùng lifetime chung | Verification/denial, query/mutation errors, archived/contact restriction | PASS: notice ẩn, indicator còn |
| Deal | Boundary chung + header metadata | Verification/denial, progressive/lifecycle validation, lost/won warnings | PASS: 5 fields, desktop/mobile, refresh/record switch |
| Task | Boundary chung; mẫu không có restrictions | Verification/denial, pending/validation/mutation errors | PASS: detail mở; không có informational notice |
| Product | Không dùng EffectiveRecordAccessBoundary; protected authoritative GET riêng. Read-only custom-field help là giải thích field, không phải banner | Query errors, validation, rendering error boundary | FAIL: API 200 nhưng màn hình gặp lỗi resource-version projection; không sửa Product |
| Support | Boundary chung | Verification/denial, lifecycle/assignment/SLA validation và command guards | PASS: notice ẩn, indicator còn |

Quotes/Orders/Shipping/Returns và các form dùng chung boundary kế thừa lifetime informational; các command/field owners không sửa. Guidance cập nhật tương ứng. Browser các trang thương mại ngoài danh sách yêu cầu: NOT_RUN.

## Environment và dữ liệu

- Frontend HEAD: `814cc4685b6d8f8ead2fc945f4607a2d0168320d`, có nhiều thay đổi chưa commit từ trước task.
- Backend HEAD: `13cd39eba01ebc9dc238f8b0ef98e174c1d4d3f6`; không sửa Backend trong task này.
- Existing local Development SQL: `DESKTOP-ICH225R / UnicoreCRM_Development`; không đổi connection string.
- Demo: `unicore-demo-anh-duong` / `ws_f2332a12d56a421d8a722bd2f65c5efb`.
- Control: `unicore-demo-anh-duong-control` / `ws_811689cfc4b446eab4f29dc109e2abf2`.
- Playwright Chromium riêng, Vite `127.0.0.1:3039`, ApiHost Development host-only `127.0.0.1:5098`. Host-only không seed/bootstrap/migrate và tắt background delivery. Không dùng cửa sổ cá nhân.
- Browser chỉ gửi GET, POST access evaluation và session refresh; harness dùng tài khoản Development có sẵn để đăng nhập. Không gửi CRM mutation, email, webhook hay integration command.

## Verification

| Kiểm tra | Trạng thái / giới hạn |
|---|---|
| Baseline desktop/mobile | PASS: banner vẫn còn sau 4,5 giây; raw Contact/Deal ID trên header |
| Deal initial → 4,5 giây → indicator/popover | PASS |
| Escape/focus, thao tác menu/scroll không reset notice | PASS |
| Refresh và Deal khác | PASS |
| 390 px mobile, default/reduced motion | PASS |
| Buyer name so với GET Contact thật | PASS; không dùng mock response |
| Buyer lookup mất kết nối → neutral → refresh phục hồi | PASS; không fallback ID/cache |
| Access evaluation mất kết nối → lỗi + Retry còn sau 4,5 giây | PASS; không giả response API |
| Control workspace mở ID Deal demo | PASS: không render Deal hoặc buyer name; quay về demo khôi phục |
| Thay đổi quyền thật trong runtime | NOT_RUN: không thay đổi policy/user permission; semantic identity test bao phủ thay đổi permission/field/command |
| HIDDEN/MASKED/READ_ONLY enforcement | Existing projection/transport/access-control gates PASS; popover chỉ có metadata. Live restrictive-policy write scenarios NOT_RUN vì không tạo/chỉnh policy hoặc CRM dữ liệu |
| SQL preservation | Xem evidence: số lượng + hash của 9 bảng CRM trong mọi workspace phải giống hệt trước/sau; demo giữ 1.050 records |
| Typecheck | PASS: strict-core, strict-type-regions, type-safety budget |
| Production build | PASS; bundle budget giữ nguyên |
| Targeted gates | PASS: effective-record-access, access-control-contracts, contact-effective-field-profile, read-only-cross-domain, guidance-contracts/runtime, presentation-responsibility, role-based-navigation, API management boundaries, frontend/backend separation, OpenAPI check |
| Full `npm run verify` | FAIL ở gate đầu `quality.lint`: 3 TypeScript errors trong `deal-quote-transition-outcome.test.mts` và `studio-first-visit.spec.ts`; 326 gate tiếp theo NOT_RUN trong full pipeline. Những gate focused ở trên đã chạy riêng |
| Other quality debt | FAIL: backend-readiness thiếu status entry cho 2 tài liệu Studio đã có từ trước; quality-pipeline đếm 347 so với assertion 345; bilingual-ui có 8 literals trong TelegramConnectionPanel/DealBuyerPicker/LeadQualificationView ngoài thay đổi này |
| Git diff whitespace | PASS; toàn bộ thay đổi giữ uncommitted; đối chiếu snapshot không có file ngoài phạm vi bị đổi/xóa, 49 Product source files giữ nguyên |

Các lần phát triển acceptance đã sửa sai giả định test về route Support, product list envelope/path, session refresh POST và xử lý body của response bị retire khi điều hướng. Lượt cuối: 1 test PASS trong 57,1 giây, 14 checks; Product được ghi issue FAIL riêng, không được tính thành Product acceptance PASS. Các lỗi render Product và nhãn Retry được ghi nhận riêng; không giả kết quả PASS của module Product.

## Contract gaps và issues ngoài phạm vi

- **BLOCKED_CONTRACT — Deal access profile aliases:** profile hiện gửi `title`, `stage`, `currency`, `probability`, `nextAction`. Backend Deals dùng vocabulary canonical `name`, `stageCode`, `amount` (Money), `opportunityScore`, `nextActionAt`/`nextActionSummary`/`nextActionRef`. Backend trả HIDDEN cho key không hỗ trợ. Do đó “5 fields” hiện bao gồm các alias không có projection, không chứng minh có 5 actual field policies. Không sửa catalog, field decisions hoặc business enforcement để đạt UI test. Cần task riêng chuẩn hóa requestedFields với owning contracts và kiểm thử permission fixtures.
- **BLOCKED_CONTRACT — buyer display projection:** Deal DTO không có tên Contact/Organization. Đã dùng public single-record read hiện có nên gap này không chặn Header fix; không thêm endpoint hoặc Backend projection. Khi không có quyền đọc buyer, header hiển thị unavailable/restricted đúng thực tế.
- **FAIL — Product detail:** runtime `PRODUCT_RESOURCE_VERSION_REQUIRED` khi `loadProductAvailability` đòi resource version hợp lệ. GET Product trả 200; page gọi projection helper ném lỗi đồng bộ trong effect. Product sources giữ nguyên; không nới kiểm tra version hoặc sửa dữ liệu.
- **NOT_RUN:** browser policy mutation fixtures cho HIDDEN/MASKED/READ_ONLY và thay đổi quyền thật, cùng Organization-buyer lookup branch. Không thay đổi permission hoặc CRM để tạo fixture.
- Console còn cảnh báo setState-during-render từ `DealFollowUpTasks` → `CrmAiFloatingUtility` (file ngoài thay đổi này); không coi toàn ứng dụng là console-clean.
- Full repository quality debt được ghi rõ trong quality evidence; không sửa unrelated tests để tạo PASS.

## Evidence

- [Before desktop](../../review-artifacts/verification/evidence/access-notices/access-before-desktop-elapsed.png), [before mobile](../../review-artifacts/verification/evidence/access-notices/access-before-mobile.png).
- [After desktop](../../review-artifacts/verification/evidence/access-notices/access-after-desktop-elapsed.png), [desktop explanation](../../review-artifacts/verification/evidence/access-notices/access-after-desktop-explanation.png).
- [After mobile](../../review-artifacts/verification/evidence/access-notices/access-after-mobile.png), [mobile explanation](../../review-artifacts/verification/evidence/access-notices/access-after-mobile-explanation.png).
- [Verification failure](../../review-artifacts/verification/evidence/access-notices/access-after-verification-failed.png), [workspace isolation](../../review-artifacts/verification/evidence/access-notices/access-after-workspace-isolation.png), [buyer unavailable](../../review-artifacts/verification/evidence/access-notices/access-after-buyer-unavailable.png).
- [Product error](../../review-artifacts/verification/evidence/access-notices/access-after-product-existing-error.png).
- [Acceptance decisions/HTTP metadata](../../review-artifacts/verification/evidence/access-notices/acceptance.json), [SQL preservation](../../review-artifacts/verification/evidence/access-notices/data-preservation.json), [quality](../../review-artifacts/verification/evidence/access-notices/quality.json), [source preservation](../../review-artifacts/verification/evidence/access-notices/source-preservation.json).

## Reproduction

Từ `frontend/unicorecrm-web`, với Development user-secrets đã cấu hình sẵn và đúng database đã xác minh:

```powershell
$env:UNICORECRM_ACCESS_NOTICE_PHASE='after'
& ../../backend/scripts/verify-connected-dashboard.ps1 -Phase after
Remove-Item Env:UNICORECRM_ACCESS_NOTICE_PHASE
npm run typecheck
npm run quality:gate -- --gate quality.effective-record-access
npm run quality:gate -- --gate quality.access-control-contracts
npm run quality:gate -- --gate quality.contact-effective-field-profile
npm run quality:gate -- --gate quality.read-only-cross-domain
npm run quality:gate -- --gate quality.guidance-contracts
npm run quality:gate -- --gate quality.guidance-runtime
npm run build
npm run verify
```

Không đưa password vào source/report. Harness fail closed nếu local Development database identity sai; không tự đổi database. Các screenshot before là evidence đã thu trước thay đổi, không chạy lại baseline trên code hiện tại.

Temporary cleanup: NOT_RUN. Automatic approval review từ chối xóa bản sao snapshot/evidence tạm với lý do “blocked by policy”. Giữ nguyên các bản sao trong temp/ignored artifacts; không xóa dữ liệu CRM.
