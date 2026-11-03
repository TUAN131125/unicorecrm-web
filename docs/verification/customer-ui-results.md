# Customer / Contact UI consistency — Connected verification

Kiểm tra ngày 23/10/2026 trên checkout local. Chưa commit, push hoặc merge. Kết quả giới hạn ở các kiểm tra ghi dưới đây; không tuyên bố toàn bộ CRM đã được nghiệm thu.

## Môi trường và phạm vi

- Frontend HEAD: `814cc4685b6d8f8ead2fc945f4607a2d0168320d` + local changes đã có từ trước và thay đổi của task này.
- Backend HEAD: `13cd39eba01ebc9dc238f8b0ef98e174c1d4d3f6` + local changes đã có từ trước và thay đổi read-only của task này.
- SQL Server local đã được người dùng cho phép: `DESKTOP-ICH225R / UnicoreCRM_Development`. Không đổi connection string, không seed, migration, cleanup hoặc sửa business records.
- Workspace demo: `unicore-demo-anh-duong`, ID `ws_f2332a12d56a421d8a722bd2f65c5efb`.
- Workspace kiểm soát: `unicore-demo-anh-duong-control`, ID `ws_811689cfc4b446eab4f29dc109e2abf2`.
- ApiHost Development riêng `127.0.0.1:5098` ở host-only mode, delivery background bị vô hiệu hóa; Vite Connected `127.0.0.1:3039`; Playwright Chromium context riêng. Không điều khiển desktop/browser cá nhân. Credential chỉ đọc vào bộ nhớ từ development configuration hiện có.
- Thư mục attachment chỉ có yêu cầu dạng text, không có bốn file ảnh tham chiếu. Dùng Contact UI thực tế trong cùng checkout/viewport làm reference và giữ ảnh trước khi sửa.

## A. UI inconsistency matrix

| Bề mặt | Customer trước | Contact reference | Customer sau |
|---|---|---|---|
| Primary identity | Mã `CU-…` ở list, tên tự nhiên ở detail | Tên + avatar | Tên được phép từ owner API; mã là metadata |
| Cột mã | Dài, xuống nhiều dòng | Hàng danh sách gọn | Một dòng ellipsis, title đầy đủ, copy mã |
| Count | 25 dễ hiểu nhầm là tổng | API Contact cung cấp tổng | `25 đang hiển thị`, cursor không có mẫu số tổng |
| Header detail | Header riêng, mã và enum thô | Shared record header | Cùng header/back/avatar/status/actions archetype |
| Tabs/content | Overview và Relationship dùng cùng nội dung | Tabs + vùng chính + context panel | Overview/profile/health riêng; Relationship/source/stakeholders riêng |
| Right panel | Shared shell nhưng typography/actions khác | Work/history/owner/collapse | Dùng cùng shell, owner display, nút phụ gọn, cùng nhãn collapse |
| Labels | `INACTIVE`, `STANDARD`, `PRIORITY`, provenance | Business labels | VI/EN labels, provenance `SYNTHETIC_DEMO` ẩn khỏi bề mặt mặc định |
| Responsive | Mã nhiều dòng làm card/table nặng | Card mobile, overflow tabs | Card mobile, code gọn, shared More menu/tabs, panel có thể collapse |

## B. Root causes

1. `CustomerListPage.buildConnectedCustomerListModel` gán `identity.displayName = customer.customerCode`. `GET /customers` trước đó chỉ có Customer documents và cursor; không có subject identity. Customer360 đã resolve Contact/Organization qua owner participant riêng. Collection cache chưa hydrate không thể là authority thay thế.
2. Customer list không trả `totalCount`. Header, saved-view badge và pagination lấy độ dài trang làm số tổng. Sau thay đổi, count/statistics chỉ mô tả trang hiện tại; không fetch mọi trang để tính tổng trong production UI.
3. Kiểm thử thực tế phát hiện thêm nhánh sai trong `useServerPagedCollection`: `(totalCount ?? items.length)` được dùng để clamp số trang. Cursor page 2 bị coi như vượt tổng một trang. Chỉ clamp khi Backend thực sự trả `totalCount`; vẫn giữ hành vi clamp khi tổng authoritative giảm.
4. Connected detail render header riêng thay vì shared `RecordDetailHeader`. Hai tab chính chưa phân vùng nội dung. Các nhãn domain được render thẳng.
5. CSS toàn ứng dụng ép `.truncate` thành wrap. Component mã dùng các utility overflow/ellipsis/nowrap cụ thể, không sửa CSS toàn hệ thống hoặc format/độ dài mã ở Backend.

## C. Implementation và files

Frontend Customer:

- `application/ports/CustomerApiRuntime.ts`: `CustomerListItem` là application read projection, không đổi Customer domain.
- `infrastructure/http/CustomerHttpApiAdapter.ts`: map identities theo Customer ID từ cùng list response, giữ cursor, không tạo total.
- `presentation/hooks/useCustomers.ts`: names đi cùng authoritative page; không ghi thêm identity vào domain snapshot.
- `presentation/model/customerConnectedListModel.ts`: model list thuần, neutral fallback khi không có tên được phép; không suy diễn primary stakeholder từ subject.
- `presentation/pages/CustomerListPage.tsx`: tên, count, statistics, refresh thật, thông tin search/sort đúng contract.
- `presentation/components/CustomerCode.tsx`, `CustomerStatusBadge.tsx`: mã một dòng/copy và localized labels.
- `presentation/list/CustomerTable.tsx`, `CustomerCardList.tsx`, `CustomerSavedViewSelector.tsx`, `CustomerStatisticsPanel.tsx`: primary name, compact code, provenance và page-scoped count.
- `presentation/hooks/useCustomerConnectedWorkspace.ts`, `detail/CustomerConnectedRecordHeader.tsx`, `CustomerConnectedWorkspace.tsx`, `CustomerDetailTabs.tsx`, `CustomerConnectedOverview.tsx`, `CustomerRelationshipPanel.tsx`: header/tabs/layout/panel, capability filtering và deep link.

Shared UI thay đổi nhỏ, mặc định của consumer khác được giữ:

- `components/crm/list-archetype/ListPaginationBar.tsx`: optional `totalKnown`, mặc định true.
- `components/crm/relationship-detail/RelationshipDetailTabs.tsx`: optional `visibleTabs`, mặc định tất cả tab hiện có.
- `shared/operations/useServerPagedCollection.ts`: sửa nhánh cursor không có tổng; có test hồi quy cho cả unknown total và authoritative count clamp.

Backend read contract:

- `Customers/Contracts/CustomerContracts.cs`: optional `identities` dictionary trên list response, keyed by Customer ID. Không đổi CustomerDocument, commands, domain hoặc schema.
- `Customers/Application/ListCustomers/Handler.cs`: resolve chỉ subject IDs của trang cuối được trả về, loại candidate thừa dùng xác định `hasNextPage`.
- `Contacts/Contracts/CustomerParticipants.cs`, `Organizations/Contracts/CustomerSubjectParticipant.cs`: internal bounded read ports tại owner.
- Owner `SubjectParticipant` / `Participant`, module DI registration: cùng workspace trusted, resource capability, required name-field read access và từng record access; FLS projection, read audit; bỏ entry khi không được phép/không tồn tại. I/O tuần tự vì chung scoped authorization DbContext.
- `Contacts/Application/Common/ContactsApplication.cs`, `Contacts/Infrastructure/Persistence/EfContactsPersistence.cs`: một bounded workspace+ID-set SELECT cho Contact. Organization tái sử dụng bounded read đã có. Giới hạn 250 IDs, empty không I/O; lỗi hạ tầng/cancellation không bị giả thành thành công.
- `UnicoreCRM.Crm.csproj`, `UnicoreCRM.Platform.csproj`: friend assembly cho focused architecture tests.

Contract/test/docs:

- `docs/api/openapi.json` + các artifact được `npm run api:generate` sinh lại. Các client module khác chỉ thay generated contract hash; không đổi nghiệp vụ AI/Auth/Sidebar.
- `tests/quality/unit/check-customers.mts`: adapter qua generated client, Customer ID mapping, omitted identity, neutral labels, cursor/no total, không suy diễn primary Contact.
- `tests/contract/customer-cursor-pagination.test.mts`: chạy hook thật trong fixture React tối giản, ba cursor pages và count clamp.
- Backend `tests/UnicoreCRM.ArchitectureTests/CustomerListIdentityTests.cs`: 13 cases; `scripts/verify-customer-ui.ps1`: SELECT-only fixture verification.
- Backend `.gitignore`: bỏ qua output local `artifacts/customer-ui-tests/`; evidence cần review được giữ có chủ đích trong Frontend docs.
- `tests/e2e/customer-ui.acceptance.ts`, nhánh opt-in trong `dashboard-connected.spec.ts`: reuse private authenticated harness; không chạy seed hoặc CRM mutation.
- `src/guidance/content/crm/extendedScreens.ts`: Customer list/detail guidance VI/EN, version tăng theo thay đổi UX. Inventory/document-status cập nhật cho artifact của task.

## D. Before / after và visual QA

32 screenshot: bốn màn hình × bốn viewport × trước/sau. Tất cả dùng dữ liệu thật, chụp sau 4,3 giây để informational notice kết thúc. Ảnh Contact được giữ để so sánh cùng viewport; không redesign Contact.

| Viewport | Customer list | Customer detail | Contact reference |
|---|---|---|---|
| 1440×900 | [Before](../../review-artifacts/verification/evidence/customer-ui/customer-ui-before-customer-list-desktop.png) · [After](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-customer-list-desktop.png) | [Before](../../review-artifacts/verification/evidence/customer-ui/customer-ui-before-customer-detail-desktop.png) · [After](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-customer-detail-desktop.png) | [List](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-contact-list-desktop.png) · [Detail](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-contact-detail-desktop.png) |
| 1366×768 | [Before](../../review-artifacts/verification/evidence/customer-ui/customer-ui-before-customer-list-laptop.png) · [After](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-customer-list-laptop.png) | [Before](../../review-artifacts/verification/evidence/customer-ui/customer-ui-before-customer-detail-laptop.png) · [After](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-customer-detail-laptop.png) | [List](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-contact-list-laptop.png) · [Detail](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-contact-detail-laptop.png) |
| 768×1024 | [Before](../../review-artifacts/verification/evidence/customer-ui/customer-ui-before-customer-list-tablet.png) · [After](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-customer-list-tablet.png) | [Before](../../review-artifacts/verification/evidence/customer-ui/customer-ui-before-customer-detail-tablet.png) · [After](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-customer-detail-tablet.png) | [List](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-contact-list-tablet.png) · [Detail](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-contact-detail-tablet.png) |
| 390×844 | [Before](../../review-artifacts/verification/evidence/customer-ui/customer-ui-before-customer-list-mobile.png) · [After](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-customer-list-mobile.png) | [Before](../../review-artifacts/verification/evidence/customer-ui/customer-ui-before-customer-detail-mobile.png) · [After](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-customer-detail-mobile.png) | [List](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-contact-list-mobile.png) · [Detail](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after-contact-detail-mobile.png) |

Quan sát ảnh: table có hàng gọn, tên là nội dung chính, code không wrap; mobile chuyển card; header không tràn nút, tabs dùng overflow menu; tablet/right panel xếp dọc theo shared breakpoint. Customer giữ profile/tier/service/health và direct work riêng. Screenshot không chứng minh mọi thao tác keyboard/zoom đã chạy.

## E. Functional verification

| Kiểm tra | Kết quả | Bằng chứng / giới hạn |
|---|---|---|
| Fresh login, chưa mở Contact list | PASS | Natural name từ Customer list API; zero per-row 360/subject HTTP requests trước mở detail |
| Contact và Organization subjects | PASS | Server B2C/B2B filters, đối chiếu tên từ response với dòng đầu |
| Code/search/filter/saved view | PASS | Full-code search, B2B/B2C filters và saved view B2B → All; copy clipboard đúng nguyên mã |
| Source-name search | BLOCKED_CONTRACT | `Customer.SearchText` không index tên ở owner Contact/Organization. UI ghi rõ tìm mã/phân khúc/nhãn. Không local-filter một trang hoặc quét toàn bộ scope |
| Alternative sort | BLOCKED_CONTRACT | Backend fixed CreatedAt DESC/id; control thể hiện Tạo gần nhất, disabled. Không sort giả riêng từng trang |
| Cursor pagination | PASS | UI đi qua 25/25/20, cuối không Next; không mẫu số tổng; refresh tải lại trang đầu |
| Selection / bulk entry / columns / row menu | PASS | Chọn/bỏ chọn, bulk entry hiển thị, drag resize/reset, settings mở/đóng, row menu → Detail |
| Statistics / Refresh | PASS | Caption page-only; Refresh có GET Backend thật |
| Header/detail/source | PASS | List/detail cùng Hoàng Đức Minh; localized status; source record đúng subject ID |
| Relationship URL / refresh | PASS | `?tab=relationship`, đúng section sau reload |
| Right work/history/collapse | PASS | Chuyển hai panel tabs, collapse/expand. Empty state phản ánh trực tiếp Customer, không mượn Contact work |
| Workspace switch/isolation | PASS | UI switch sang control không có tên demo; foreign Customer360 404; về demo hydrate lại tên |
| Compact notices / FLS guard | PASS giới hạn | Dùng boundary hiện có, protected-field indicator còn sau notice; architecture/access gates PASS, owner field negative tests PASS |
| OWN/TEAM/CUSTOM policy/FLS permutations với DB thật | NOT_RUN | Không tạo/sửa role hay permission fixtures trong task; unit authority là stub |
| Task/Activity record links từ Customer thật | NOT_RUN | Customer mẫu không có direct work/history; không tạo record mới chỉ để test. Existing panel contracts/handlers giữ nguyên |
| Onboarding/status/archive/bulk mutation saves | NOT_RUN | User yêu cầu không sửa SQL records; giữ nguyên command/workflow và entry UI, không thực thi mutation |
| Attachments và commercial joined projections | BLOCKED_CONTRACT | Không có authoritative projection hoàn chỉnh; attachments ẩn, commercial tabs chỉ báo chưa khả dụng, không fake totals/records |
| Bốn viewport, Contact parity | PASS visual | 32 ảnh và kiểm tra hình ảnh; không tuyên bố full accessibility audit |
| SQL Customer subjects và preservation | PASS | 70 Customer, không thiếu same-workspace subject; hash/count 9 business tables toàn bộ workspace trước/sau identical |

Ví dụ identity thực tế: `customer_f550944a3b644a48bdb565002d76f0db` → `CONTACT/contact_7ef89139f0754847b4a1d2d28fe44497` → **Hoàng Đức Minh**. Mã `CU-FE03DBE0EDBD4685B4B8FC5BF68519F5` giữ nguyên. [SQL](../../review-artifacts/verification/evidence/customer-ui/sql-identity.json), [browser/API log](../../review-artifacts/verification/evidence/customer-ui/customer-ui-after.json), [preservation](../../review-artifacts/verification/evidence/customer-ui/after-data-preservation.json).

Test/build:

- PASS Backend build và 13 focused tests: [TRX](../../review-artifacts/verification/evidence/customer-ui/customer-list-identity.trx).
- PASS frontend Customer contracts, cursor hook regression; typecheck 3/3; UI parity, presentation responsibility, API contract/generated drift, API boundaries, frontend/backend separation, server-side list query, guidance contracts/runtime, access authority/contracts, Customer relationship integrity/completeness/view boundary/integration/reconciliation.
- PASS production build và bundle budget: entry 290,42 KiB, largest chunk 496,84 KiB / 500 KiB. [Build](../../review-artifacts/verification/evidence/customer-ui/build.log).
- FAIL full `npm run verify` ở global lint: ba lỗi TypeScript có sẵn trong `deal-quote-transition-outcome.test.mts` và `studio-first-visit.spec.ts`. Các file này identical với task-entry hash, không sửa để vượt gate. Các gate sau lint trong full run là NOT_RUN; targeted runs riêng ghi ở trên. [Report](../../review-artifacts/verification/evidence/customer-ui/full-verify.json).
- FAIL `quality.backend-readiness`: hai tài liệu Studio có sẵn chưa đăng ký status. FAIL `quality.bilingual-ui`: tám JSX literals có sẵn ở TelegramConnectionPanel/DealBuyerPicker/LeadQualificationView. Không sửa module ngoài phạm vi. JSON kết quả riêng nằm cùng thư mục evidence.

## F. Contract/security assessment

Read extension là cần thiết vì list contract cũ không có subject identity. Frontend dùng danh sách mới ngay lần đầu, không phụ thuộc Contact navigation/cache/localStorage. Không thêm endpoint, không sửa permission/mutation/schema.

13 tests dùng real participants và authorizers, stub evaluator/persistence: HIDDEN/MASKED không trả tên và không đọc owner table; READ_ONLY vẫn đọc; capability/workspace/record denial và missing ID bỏ entry; giới hạn/empty/error/cancel; Handler mapping theo Customer ID và giữ rows/cursor khi identity bị deny. Reviewer độc lập kết luận **advisory PASS_WITH_ADVISORY**, không có canonical attestation/FROZEN.

Giới hạn: unit không chạy actual OWN/TEAM/CUSTOM evaluator hoặc EF SQL plan; không đo latency; không kiểm chứng mọi audit field, cancellation giữa SQL/audit hay batch đúng 250 record. Host DI/HTTP serialization được luồng browser thật sử dụng. Owner data SELECT được batch theo trang, nhưng tổng SQL commands có thể tăng theo record do AccessControl evidence/audit; không tuyên bố SQL command count hằng số.

## G. Git preservation và cách tái kiểm tra

Task-entry status/diff/hash được lưu dưới `artifacts/customer-ui/baseline/` trước implementation. Đối chiếu hash không có file task-entry nào bị xóa; mọi khác biệt thuộc file Customer/shared pagination/contract-generated/guidance/test/docs đã liệt kê. Auth, AI, Sidebar, conversion workflow, Customer domain, mutation implementations và access notice/security files không thay đổi so với task-entry. Generated clients ngoài Customer đổi hash do generate, không sửa tay.

Danh sách file cuối cùng: [Frontend scope](../../review-artifacts/verification/evidence/customer-ui/frontend-scope.json), [Backend scope](../../review-artifacts/verification/evidence/customer-ui/backend-scope.json). Toàn bộ dirty checkout gồm cả local work có sẵn; không nên coi `git diff HEAD` là patch riêng của task. Không reset/stash/commit/push/merge. Không lưu credential, database files hoặc node_modules vào bộ evidence. Harness dừng các process do nó tạo; artifacts test/screenshot được giữ có chủ đích để review.

Chạy lại từ Frontend bằng các gate đã đăng ký và test cursor:

```powershell
npm run typecheck
npm run quality:gate -- --gate quality.customers
npm run quality:gate -- --gate quality.customer-contact-ui-parity
npm run api:check
node --import tsx tests/contract/customer-cursor-pagination.test.mts
npm run build
```

Chạy lại từ Backend, dùng đúng configuration Development hiện tại, không sửa DB thủ công:

```powershell
dotnet test tests/UnicoreCRM.ArchitectureTests/UnicoreCRM.ArchitectureTests.csproj --filter FullyQualifiedName~CustomerListIdentityTests
./scripts/verify-customer-ui.ps1
$env:UNICORECRM_CUSTOMER_UI_PHASE='after'
./scripts/verify-connected-dashboard.ps1 -Phase after
Remove-Item Env:UNICORECRM_CUSTOMER_UI_PHASE
```

Lệnh browser tái sử dụng tài khoản demo hiện hữu và fail closed nếu SQL identity khác Development fixture. Nó chỉ đọc CRM và tạo authentication/read audit bình thường, không seed hay ghi dữ liệu kinh doanh. Các target counts/search/sort thiếu contract nêu trên là giới hạn thực, không được tính thành feature PASS.
