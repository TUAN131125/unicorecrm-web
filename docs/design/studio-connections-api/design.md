# Studio — Kết nối & API

Ngày review: 22/10/2026. Trạng thái: **PROPOSED — chờ duyệt thiết kế và phạm vi**.

Đây là AnalysisRecord và thiết kế để review, không phải bằng chứng chức năng đã nghiệm thu. Không thay đổi production code, authority, endpoint, migration, credential, baseline hay waiver. Không stage/commit/push. AI và Multi-Currency nằm ngoài phạm vi.

Tài liệu đi kèm: [wireframe tương tác](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/docs/design/studio-connections-api/wireframes.html), [capability/API matrix](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/docs/design/studio-connections-api/capability-matrix.csv), [snapshot working tree và contracts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/docs/design/studio-connections-api/review-evidence.json), [nguồn đối chiếu và phạm vi file](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/docs/design/studio-connections-api/source-and-file-plan.md), [kết quả kiểm tra artifact](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/docs/design/studio-connections-api/artifact-verification.json).

## 1. Kết luận và current-state findings

**Nên triển khai PR1 và PR2 sau khi duyệt; PR3 dừng ở contract/design; PR4 chỉ mở hành vi đã có Backend, binding và permission thật.** Năm khu vực là các mục đích sử dụng, không phải năm wizard cấu hình credential.

Phân loại bằng chứng trong tài liệu:

- **Canonical**: contract/operation admission đang được repository áp dụng; ghi rõ phiên bản và nguồn.
- **Observed**: code, binding và diff thực tế; chưa chứng minh một deployment đang vận hành.
- **Derived**: hệ quả từ code đã đọc, cần test connected để xác nhận runtime.
- **Proposal**: thiết kế cần duyệt; không tự tạo business authority.
- **AUTHORITY_GAP**: nguồn mâu thuẫn hoặc thiếu quyết định; UI không mở hành vi dựa trên suy đoán.

### 1.1 Working tree của cả hai repo

Đã review working tree hiện tại, gồm thay đổi chưa commit; không dùng riêng HEAD làm hiện trạng. Root workspace không phải Git repo. Hai repo là `backend` và `frontend/unicorecrm-web`.

- Backend: 13 tracked files đang sửa, tập trung AI/verifier/Development config; còn nhiều tài liệu và evidence chưa track. Không có tracked diff webhook/integrations trong snapshot.
- Frontend: 40 tracked files đang sửa cùng nhiều file chưa track. Có overlap với phạm vi dự kiến: `applicationComposition.ts`, `studioWorkspaceRoutes.tsx`, `guidance/content/studio/configuration.ts`, `studioCoreRuntime.ts`.
- Diff hiện tại bổ sung runtime settings connected, boundary theo Workspace và chống snapshot cũ. PR mới phải giữ các thay đổi này; không ghi đè hoặc khôi phục file về HEAD.
- Manifest P0 đã đối chiếu: `backend/docs/verification/evidence/p0-checkpoint-finalization-20261021/cumulative-candidate-manifest.json`. Danh sách file dự kiến ở tài liệu riêng ghi rõ overlap. Không sửa file pin và không tái sinh generated code lan sang file pin. Manifest đang là proposal/conditional checkpoint; việc đối chiếu không phải phê duyệt checkpoint.
- Snapshot giữ HEAD, status, diff hash, SHA-256 tracked files và hai contract. Kết quả kiểm tra cuối xác nhận tài liệu là thay đổi duy nhất của lượt thiết kế này.

### 1.2 Các điểm đã đối chiếu

| Thành phần | Hiện trạng observed | Hệ quả thiết kế |
|---|---|---|
| `WebhooksApiView` | Connected chỉ render outbound; demo có ba tab inbound/outbound/API bằng browser repository | Bỏ tên gộp gây hiểu nhầm. Không dùng demo event catalog làm danh mục production |
| `ConnectedOutboundWebhooksView` | Có create/update/lifecycle/rotate/replay thật; gọi generated client qua gateway | Giữ infrastructure; tổ chức lại list → detail → thao tác theo trạng thái |
| Load của outbound | `Promise.all` catalog/subscriptions/deliveries; generic error; thiếu loading riêng; không có Workspace generation/clear secret trực tiếp ở view | Tách tải từng vùng, chặn kết quả cũ khi đổi Workspace/session; phân biệt failure với empty |
| Outbound permissions | Có `studio.configure` ở hầu hết nút; Save edit không tự kiểm tra lại quyền; Backend vẫn kiểm tra | Controller lấy quyền hiện hành cho mọi submit; revoke phải khóa form và xóa dữ liệu nhạy cảm |
| Outbound revision | Lấy max version subscriptions làm revision trang | Hiển thị version từng subscription; không dựng global revision |
| `IntegrationsView` | Vẫn đọc browser snapshot trong connected; Configure mở được rồi Save mới báo blocked; thống kê dựa local status | Không dùng local CONNECTED/verified/count làm sự thật Backend; bỏ wizard và CTA chưa có authority |
| `BrowserIntegrationConfigurationRepository` | Save/disconnect/verify trong storage; verify chỉ đổi trạng thái, không gọi provider | Demo only. Không nghiệm thu live provider từ đường này |
| `BrowserDeveloperConfigurationRepository` | Webhooks lưu local và đưa về DRAFT; API keys chỉ metadata; không có mint/revoke thật | Không tái sử dụng cho connected outbound hay Developer API keys |
| `connectedConfigurationAvailability` | Generic integration writes bị unavailable; `isDeveloperWebhookSaveUnavailable()` luôn false; comment thiếu cập nhật outbound | Sửa fail-closed facade và lời giải thích trong PR1; không dựa vào việc route đang tránh demo để bảo vệ boundary |
| `developerConfigurationRuntime` | `saveDeveloperWebhooks` vẫn gọi browser repository; route connected hiện không dùng đường này | Latent boundary gap, chưa phải bằng chứng người dùng connected đã ghi local qua UI hiện hành |
| Studio route boundary | Integrations/outbound phụ thuộc `loadStudioConfiguration`; Communications và AI đi riêng | Khu vực kết nối dùng load boundary của owner, không bị API Studio không liên quan chặn |
| Connected composition | Outbound được bind generated client; generic integration workflows được declare unavailable | Giữ binding này; không tạo backend/framework mới |
| `InboundLeadWebhookEndpoints` | POST signed JSON nhận Lead, binding SQL và secret external config; Development bootstrap provisioning | Receive endpoint khác source management. Không có UI CRUD nguồn để bật |
| `OutboundWebhookService` + runtime | Workspace scope, permissions, versions, idempotency, one-time secret, durable fan-out/retry/leases | UI không thay đổi semantics; không hứa gửi đúng một lần hoặc hủy request đang chạy |

Các rủi ro load/scope trên đây là nhận xét từ source; chưa tuyên bố tái hiện cross-Workspace leakage hoặc production outage.

### 1.3 Readiness và các nguồn mâu thuẫn

1. FE OpenAPI `0.24.0-contract.0` đánh dấu 12 operation outbound/catalog là `PRODUCTION_CONTRACT_READY`. Generated `integrationConfigurationApi.ts`, composition và ApiHost mapping có thật.
2. Design Authority OpenAPI và `.unicore-ai` exact operation index vẫn ở `0.23.21-contract.0`: không tìm thấy `createOutboundWebhookSubscription`. Đây là **authority/provenance gap**, không phải kết luận outbound không có runtime. Trước khi admit PR2, owner cần xác nhận nguồn contract áp dụng và quy trình đồng bộ manifest. Tài liệu này không cập nhật baseline hoặc cấp waiver.
3. `listIntegrationConnections` và `listIntegrationProviders` contract READY, nhưng tài liệu Backend ghi implementation deferred và không tìm thấy handler/binding tương ứng trong source hiện tại. READY contract không đồng nghĩa gọi được ở connected runtime.
4. Create/update/disconnect/verify generic integrations vẫn BLOCKED trong cả hai nguồn; concurrency, transaction và outbox authority chưa được giải quyết.
5. Receive inbound Lead có authority extension rõ ràng trong `INBOUND_LEAD_WEBHOOK_EXTENSION.md`, không phải operation của FE OpenAPI. Vì vậy không phủ nhận receive capability; nhưng source CRUD, secret rotation, receipt query và public onboarding chưa có production management contract.
6. Communications có account metadata API và UI riêng. Telegram có credential/verify/lifecycle API và UI riêng, phụ thuộc `securityReady`, `providerAllowed`, `liveAllowed` và deployment admission. Catalog chung vẫn ghi live/inbound/outbound `NOT_IMPLEMENTED` cho mọi provider, mâu thuẫn với Telegram extension. Không gộp metadata account với kết nối live; trạng thái owner-specific là nguồn để thiết kế liên kết.

## 2. Capability matrix

“Backend ready và UI ready” dưới đây nghĩa là source/contract/binding hiện hữu, **không phải runtime acceptance PASS**. Chi tiết từng operation và gap nằm trong CSV.

| Capability | Trạng thái yêu cầu | Quyết định UI |
|---|---|---|
| Outbound catalog/list/create/update/activate/pause/resume/archive/rotate/delivery/replay | **Backend ready và UI ready**, có điều kiện provenance/admission nêu trên | Redesign PR2; giữ API hiện có |
| Outbound GET theo ID và delivery filter theo subscription | **Backend ready nhưng UI thiếu** | Bổ sung adapter/controller dùng generated methods sẵn có, không thêm endpoint |
| Outbound attempt detail, payload inspector, cursor paging, aggregate health analytics, test-send | **Không tồn tại** trong surface API đã kiểm tra | Không hiển thị CTA; chỉ các trường delivery DTO có thật |
| Generic provider/connection reads | **Backend/contract blocked** ở runtime: contract READY, implementation deferred | Hiển thị chưa khả dụng; không coi thiếu API là danh sách rỗng |
| Generic provider save/update/verify/disconnect | **Backend/contract blocked** | Không có CTA thực thi hay credential input |
| Browser integration save/verify/disconnect; demo webhook editor | **Demo only** | Chỉ demo có nhãn rõ; không phục vụ connected |
| Signed Lead receive | **Backend ready nhưng UI thiếu**, riêng extension receive, không bao gồm management | Trang Nhận dữ liệu giải thích phạm vi; không hiển thị endpoint cụ thể của Workspace khi chưa có authorized query |
| Inbound source CRUD/enable/disable/rotate/receipts | **Backend/contract blocked**: chưa có management authority/API | PR3 contract/design only |
| Developer API key list/issue/scope/rotate/revoke, key authentication | **Không tồn tại** trong phạm vi source/contract đã rà soát | Trang Truy cập API giải thích chưa hỗ trợ; không tạo key, không chép session token |
| Communications account metadata | **Backend ready và UI ready** | Deep link màn hình owner hiện có, theo `communications.channels.manage` |
| Telegram credential/verify/lifecycle | **Backend ready và UI ready**, deployment-gated | Deep link owner; live verification chưa được test trong lượt này |
| Gmail/Zalo/Messenger live connection trong catalog này | **Backend/contract blocked** / `NOT_IMPLEMENTED` | Không hứa OAuth, đồng bộ hoặc tạo connected badge |

## 3. Information architecture đề xuất

```text
Studio
  AI hiện hữu → giữ route, permission, configuration và logic hiện tại
  Kết nối & API
    Tổng quan kết nối
    Ứng dụng & dịch vụ
    Nhận dữ liệu
    Webhook gửi đi
    Truy cập API

Ứng dụng & dịch vụ → Communications / tài khoản theo ID (owner route hiện hữu)
Webhook gửi đi → danh sách → chi tiết [Cấu hình | Giao nhận | Bảo mật]
```

Communications trở thành liên kết từ Ứng dụng & dịch vụ; giữ URL và quyền hiện hữu. Không tạo màn hình credentials thứ hai. AI không phải card/provider của nhóm mới; thay đổi vị trí hiển thị nhãn điều hướng nếu cần phải nằm trong quyết định D2, không sửa AI configuration.

### 3.1 Route và compatibility

Đề xuất **giữ hai URL/key cũ và thêm ba URL**, tránh đổi đường dẫn đang được dùng chỉ vì đổi nhãn. Paths dưới đây là suffix trong Studio Workspace route hiện hữu, không là endpoint Backend.

| Khu vực | Route suffix đề xuất | Route key |
|---|---|---|
| Tổng quan | `settings/connections` | mới `SETTINGS_CONNECTIONS` |
| Ứng dụng & dịch vụ | `settings/integrations` | giữ `SETTINGS_INTEGRATIONS` |
| Nhận dữ liệu | `settings/connections/inbound` | mới `SETTINGS_CONNECTIONS_INBOUND` |
| Webhook gửi đi | `settings/webhooks-api` | giữ `SETTINGS_WEBHOOKS_API` |
| Truy cập API | `settings/connections/api-access` | mới `SETTINGS_API_ACCESS` |

Route key cũ có tên lịch sử nhưng nhãn UX mới. Không đổi old deep links. Có thể dùng query `subscriptionId` + `tab` cho detail để tránh route key mới; ID luôn được Backend scope-check, không lấy record từ browser storage. URL `settings/communications/channels` và `settings/ai` giữ nguyên. Query/tab cũ nếu có phải được inventory trước khi map, không suy đoán inbound/API đã có URL deep link.

PR1 dự kiến +3 route keys, +3 loadable screen modules nếu giữ hai entrypoint hiện tại: inventory mục tiêu tạm tính 86 keys / 70 loadables; chỉ xác nhận sau khi generator kiểm tra thực tế. Không thêm module/capability/flag/workflow. Đây là cập nhật inventory cấu trúc có chủ đích để duyệt, không sửa accepted compatibility baseline. Nếu file cần đổi nằm trong P0 pin khác chưa được cung cấp, dừng đúng file để xin ngoại lệ.

### 3.2 Quyền và dữ liệu tổng quan

- Năm trang mô tả/read dùng `studio.read`. Outbound mutations dùng `studio.configure`. Communications giữ `communications.channels.manage` kể cả read. Không tạo permission mới để lấp gap.
- Người chỉ có Communications permission vẫn dùng owner URL hiện tại. Không vô tình thêm `studio.read` làm điều kiện mới cho màn hình owner đó.
- Tổng quan có các thẻ khả dụng theo capability, mỗi thẻ tải độc lập. Không gọi Communications API khi thiếu quyền. Không dùng `Promise.all` để một API lỗi làm mất mọi thẻ.
- Chỉ subscriptions đọc thành công mới được tính theo DRAFT/ACTIVE/PAUSED/ARCHIVED. Ghi rõ phạm vi Workspace hiện tại và thời điểm đọc. Không suy từ ACTIVE ra healthy.
- Delivery là **tối đa 200 bản ghi mới nhất** của query, không phải toàn lịch sử. Không có tổng throughput, tỷ lệ thành công toàn hệ thống hoặc uptime.
- Khu vực không có API hiển thị “Chưa hỗ trợ quản lý trên môi trường này”, không hiển thị `0 kết nối` hoặc `0 API keys`.
- Luôn tách bốn trục: capability được hỗ trợ; quyền người dùng; lifecycle cấu hình; sức khỏe vận hành. Không tạo một badge “Connected” thay cho cả bốn.

## 4. Wireframes và interaction states

[Mở wireframe HTML](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/docs/design/studio-connections-api/wireframes.html) để chuyển năm khu vực, role và trạng thái. Artifact không gọi Backend, không tạo dữ liệu giả và không giữ credential. Các ô khung là cấu trúc thiết kế, không phải bản ghi mẫu. Nút xem luồng chỉ mở mô tả.

### 4.1 Tổng quan kết nối

```text
[Studio / Kết nối & API]                     [Workspace hiện tại]
Tổng quan kết nối                            [Làm mới dữ liệu đọc]
Thiết lập và theo dõi kết nối theo từng mục đích

[Webhook gửi đi]                 [Ứng dụng & dịch vụ]
Lifecycle từ subscriptions API   Communications: theo quyền và trạng thái owner
Latest deliveries: query window  Generic integrations: Chưa khả dụng
[Xem webhook]                   [Xem ứng dụng]

[Nhận dữ liệu: management chưa khả dụng] [Truy cập API: chưa hỗ trợ key]
Mỗi thẻ có loading/error/last-read riêng. Không có tổng số kết nối tổng hợp giả.
```

Empty chỉ xuất hiện cho nguồn đã trả về collection rỗng thành công. Không có “Kết nối tất cả”, “Tự động cấu hình” hoặc global health không có read model.

### 4.2 Ứng dụng & dịch vụ

```text
Ứng dụng & dịch vụ
[Kênh liên lạc — Có màn hình quản lý hiện hữu]
Metadata tài khoản và kết nối live là hai trạng thái khác nhau
[Quản lý kênh liên lạc] (đủ quyền) / [Thông báo thiếu quyền]

[Nhà cung cấp khác — Chưa khả dụng]
Chưa hỗ trợ cấu hình / xác minh qua Backend hiện tại
Không có form nhập credential, nút Connect hoặc status lấy từ localStorage
```

Đường đi: vào Apps → đọc phạm vi/permission → mở owner Communications → chọn account ID → owner render Telegram gating thật. Không copy token, tự gọi verify hoặc dựng một provider form chung ở Studio. Không đưa exchange-rate/Multi-Currency vào thiết kế.

### 4.3 Nhận dữ liệu

```text
Nhận dữ liệu
[Chưa có quản lý nguồn trong Studio]
Backend có extension nhận Lead qua signed JSON với binding được cấp từ server
Tạo nguồn / cấp credential / mapping / lịch sử nhận chưa có management API

Nhận dữ liệu → kiểm tra chữ ký + delivery → trusted binding → lệnh Lead owner
[Xem giải thích phạm vi] (chỉ nội dung thiết kế)
Không có: Tạo nguồn, Generate URL/secret, Test webhook, bật nguồn hoặc local save
```

Đường đi hiện tại kết thúc ở giải thích unavailable. Wireframe nguồn tương lai chỉ là đặc tả PR3: danh sách được query theo Workspace → chi tiết nguồn → trạng thái enabled + delegated actor + secret metadata → credential workflow → receipt read. Tất cả phần tương lai giữ **BLOCKED** đến khi được admit; không đặt nút giả disabled vô thời hạn cạnh form có vẻ dùng được.

### 4.4 Webhook gửi đi

```text
Webhook gửi đi                              [Tạo webhook] (có quyền)
[Tìm trong danh sách đã tải] [Lọc trạng thái] [Làm mới]
Tên | Event từ Backend catalog | Endpoint | Lifecycle | Version
[Hàng từ API; chọn để xem chi tiết]

Chi tiết: tên / ID / Workspace / lifecycle / version
[Cấu hình] [Giao nhận] [Bảo mật]
Cấu hình: name, catalog event, public HTTPS destination
Giao nhận: latest 200 của subscription, status/attemptCount/HTTP/error/nextAttempt
Bảo mật: signing scheme + rotate; không có GET/show lại secret
```

Danh sách không hiển thị chuỗi thao tác cho mọi row. Detail có một primary action đúng trạng thái, secondary actions trong menu có tên rõ. Drawer/modal dùng dialog primitive có focus trap, escape/cancel khi chưa submit và trả focus; detail tab có keyboard navigation. Mobile chuyển thành list card, không giấu error/permission/secret warning.

#### Lifecycle và hành vi UI

| Trạng thái | Primary | Các thao tác khác đủ quyền | Không được làm |
|---|---|---|---|
| DRAFT | Kích hoạt | Sửa, đổi signing secret, lưu trữ | Không có pause/resume |
| ACTIVE | Tạm dừng | Đổi signing secret, lưu trữ | Sửa phải tạm dừng bằng thao tác riêng trước |
| PAUSED | Tiếp tục | Sửa, đổi signing secret, lưu trữ | Không tự resume sau Save |
| ARCHIVED | Xem | Đọc deliveries | Không restore/delete/edit/rotate/activate |

**Tạo**: name/event/endpoint → POST tạo DRAFT → ghi nhận command success và secret ngay → hiện secret một lần → người dùng xác nhận đã lưu → có thể kích hoạt bằng command riêng. Không auto-activate. Confirmation “đã lưu” chỉ là UI acknowledgement, không phải Backend security guarantee.

**Version**: mọi update/lifecycle/rotate có `If-Match` từ version của bản ghi và stable `Idempotency-Key`. Create và replay chỉ yêu cầu idempotency, không thêm expectedVersion giả. 409 phải phân biệt version conflict, changed request cùng key và invalid lifecycle từ code Backend. Reload để review dữ liệu hiện hành; không tự ghi đè hoặc retry bằng version mới.

**Double click / timeout**: khóa theo operation/record, giữ cùng key và cùng payload khi retry request chưa rõ kết quả. UI không báo “thất bại chắc chắn” sau timeout. GET/list để đối chiếu, nhưng name/endpoint trùng không đủ để tự nhận một record là command vừa tạo. Replay cùng key không trả lại secret; nếu create đã thành công nhưng mất response, hướng dẫn khôi phục qua rotate trên record đã xác định. Không tự tạo lần nữa.

**Refresh giữa command chưa rõ kết quả**: mặc định an toàn của PR2 không tự resubmit sau remount; reload state, nêu kết quả chưa xác định và yêu cầu đối chiếu. Pending intent hiện chỉ ở memory. Nếu cần retry tự động xuyên refresh, phải duyệt riêng session metadata workspace+actor scoped, retention/cleanup và khả năng correlate command; không lưu secret/payload/endpoint hay business snapshot vào browser. Không bổ sung operation-status endpoint trong PR2.

**Secret**: một panel chỉ tồn tại trong memory, có Copy và “Đã lưu, đóng”. Không analytics/log/storage/URL; không lưu để refresh xem lại. Xóa ngay khi đổi Workspace, logout, account đổi, quyền thu hồi hoặc đóng. Rời panel cảnh báo sẽ không xem lại. Copy không thể đảm bảo xóa clipboard của hệ điều hành. Chỉ create/rotate response ban đầu có secret; replay/list/GET không có.

**Rotate**: giải thích secret cũ bị thay ngay, không có dual-secret grace. Confirmation riêng; response hiển thị một lần. Không hứa zero downtime; các delivery đang queue dùng secret/endpoint hiện tại lúc gửi. Không tự pause/rotate/resume như một transaction tự tạo.

**Pause/resume**: pause ngừng lấy lượt gửi mới nhưng ACTIVE và PAUSED đều được fan-out delivery. Resume có thể gửi backlog. Không hứa hủy HTTP đang chạy. ACTIVE là lifecycle, chưa chứng minh receiver hoạt động.

**Archive**: confirm theo tên/ID, thông báo không có restore API, không tự xóa deliveries hay hủy in-flight. Không đổi thành Delete.

**Replay**: chỉ hiện command khi server `replayable=true` và có quyền. DEAD_LETTER → PENDING, giữ DeliveryId/EventId; attemptCount là tích lũy, không reset tổng lượt. Hiển thị “Đã đưa vào hàng đợi”. UI đề xuất chỉ cho replay khi subscription ACTIVE; PAUSED hướng dẫn resume trước, ARCHIVED chỉ đọc vì không thể resume. Đây là UI guard cần duyệt D4: Backend hiện cho enqueue khi paused/archived nhưng sender chỉ gửi ACTIVE. Không sửa rule Backend hoặc gọi đó là invalid state mới.

Không có nút test-send, raw payload viewer, attempt timeline, mẫu full event payload hay historical export nếu API không cung cấp. HMAC documentation có thể mô tả từ runtime: ký SHA-256 `${timestamp}\n${deliveryId}\n` + raw body, headers delivery/timestamp/signature/event. Ví dụ request chỉ dùng placeholder, không tạo subscription/secret để minh họa.

### 4.5 Truy cập API

```text
Truy cập API
[Chưa hỗ trợ quản lý Developer API keys]
Hiện có authenticated API cho ứng dụng; chưa có contract cấp key/scope/rotate/revoke
Developer API key ≠ signing secret outbound ≠ inbound credential ≠ provider token

[Thông tin API] nội dung mô tả, chỉ link tài liệu thực sự được xuất bản
Không có Create key, Copy token, revoke giả hoặc bảng metadata từ localStorage
```

Đường đi hiện tại kết thúc ở unavailable explanation. Không lấy access token/refresh token phiên đăng nhập làm Developer API credential. URL docs/server base phải lấy từ cấu hình/contract đã xác minh của deployment, không hard-code host trong thiết kế.

### 4.6 Bảng interaction states dùng chung

| State | Nội dung / phản hồi | Hành động cho phép |
|---|---|---|
| Loading | Skeleton + `aria-busy`, đúng Workspace; không số 0 tạm | Chuyển mục; chưa cho mutate trước khi đọc version/catalog |
| Loaded empty | “Chưa có webhook trong Workspace này” sau GET 200 rỗng | Tạo nếu configure; read-only giải thích nếu không |
| Unsupported / not admitted | Mô tả capability và phần còn thiếu, không giả empty | Chỉ điều hướng/tài liệu có thật |
| Read-only | Đọc dữ liệu cho phép; nhãn quyền cần để cấu hình | Không submit/mutation; không tạo permission mới |
| 401 / logout | Xóa dữ liệu và secret, đưa về flow đăng nhập hiện hữu | Đăng nhập lại; không tự gửi lại command |
| 403 / permission revoked | Khóa và đóng editor; xóa phần bị thu hồi | Tải lại quyền qua authority hiện hữu; không retry vô hạn |
| 404 detail | “Không tìm thấy trong Workspace hiện tại” | Về danh sách; không lộ Workspace khác |
| 404 route / 501 | “Chưa khả dụng trên máy chủ này” | Không fallback browser repository |
| 400 / 422 | Lỗi field hoặc policy/event/endpoint theo response | Sửa field, review; không auto-transform HTTPS/DNS |
| 409 / 412 | Đổi version, idempotency conflict hoặc lifecycle theo error code | Reload và review; không tự overwrite |
| 429 | Thời gian thử lại nếu response có; giữ command intent | Không spam/retry lập tức |
| Network / timeout | Read có retry; write ghi “chưa xác định kết quả” | Reconcile hoặc retry cùng intent trong phiên |
| 5xx / outage | Thông báo an toàn, correlation ID nếu có | Retry read độc lập; không báo command failure chắc chắn khi ambiguous |
| Mutation OK + refresh fail | Giữ command success/secret, cảnh báo list chưa cập nhật | Retry read; không replay command chỉ để refresh |
| Workspace switch / stale response | Hủy request nếu hỗ trợ + generation guard | Xóa selection/form/secret/cache, tải scope mới; response cũ bị bỏ |

Abort không bảo đảm command chưa thực thi ở server. Response body và error code đi qua typed error mapping; không đưa raw response/secret ra toast. Khi gateway chưa expose `signal`, PR2 có thể truyền option qua generated methods sẵn có; generation check vẫn bắt buộc.

## 5. Component reuse và ownership

| Reuse | Phạm vi |
|---|---|
| `StudioPageFrame`, `StudioPrimitives` | Khung trang, field, section, read-only/dirty hints. Không dùng max subscription version làm page revision |
| `StudioExperiencePrimitives` | Status notice, segmented/detail tabs, metrics chỉ khi có dữ liệu Backend. Kiểm tra keyboard behavior khi reuse |
| Shared `Dialog`, buttons, badges, unsaved-work registry | Editor, confirmation, one-time secret panel; không tự xây modal framework |
| `ConnectedOutboundWebhookApi` + generated IntegrationConfiguration client | Transport duy nhất. Expose GET by ID và subscription filter đã có, giữ DTO mapping ở infrastructure |
| `OutboundWebhookMutationIntents` và behavior hiện có | Giữ intent semantics; chuyển orchestration vào render-free controller, tránh sao chép commands vào view |
| Permission guard / workspace context / typed API error | Route và submit guard; cùng generation/session scope cho đọc và command |
| `CommunicationsChannelsEntry` / owner route | Deep link có quyền; không import UI internals hoặc lưu Telegram token tại Studio |
| Browser repositories | Chỉ demo path. Chặn facade ghi khi connected; không dùng làm fallback outage |

Đề xuất các component nhỏ trong Studio: `ConnectionCapabilityNotice`, `ConnectionsOverviewView`, `ConnectionAreaState`, `OutboundSubscriptionList`, `OutboundSubscriptionDetail`, `OutboundDeliveryList`, `OutboundWebhookEditor`, `OneTimeSigningSecretDialog`. Controller `useOutboundWebhookConfiguration` giữ load/selection/mutations/errors/scope. Không tạo framework AI/integrations hay service mới.

## 6. API gap matrix và authority decisions

CSV đi kèm liệt kê surface cụ thể. Những gap chặn mở chức năng mới:

| Gap ID / owner | Blocking question | Điều đã biết | Risk nếu tự suy đoán / đề nghị |
|---|---|---|---|
| G1 / contract + Integrations owner | Contract outbound 0.24 áp dụng/admitted theo provenance nào khi exact index còn 0.23? | FE generated client, ready flags và runtime có; canonical lookup thiếu | Đừng tự cập nhật baseline/waive. Owner xác nhận authority và admission workflow trước PR2 |
| G2 / platform/integrations | Khi nào admit/implement generic read và bốn commands? | Reads deferred; writes BLOCKED, concurrency/transaction/outbox unresolved | UI unavailable; PR4 không tạo lifecycle hay credential custody giả |
| G3 / Integrations + Leads + Security | Inbound source management thuộc owner/permission nào, scope/delegated actor/revocation/custody/rotation ra sao? | Receive extension + SQL binding + external secret; chỉ Development provisioning được tìm thấy | PR3 viết contract proposal với owner/version/idempotency/audit. Không biến bootstrap thành admin endpoint |
| G4 / Identity/Security + platform API owner | Developer key issuance/auth/scope/expiry/revoke/rotation/audit/retention thuộc authority nào? | Không có operation tương ứng; session JWT không phải API key | Chỉ unavailable. Chưa chọn capability, endpoint hoặc schema |
| G5 / Communications owner | Reconcile catalog NOT_IMPLEMENTED và Telegram-specific admitted status như thế nào? | Metadata accounts + conditional Telegram backend/UI có thật | PR1 chỉ link owner; PR4 resolve catalog truth trước aggregate provider status |
| G6 / Integrations + product | Replay khi paused/archived nên hiển thị thế nào? | Server queue được; sender ACTIVE only | Đề nghị UI guard ACTIVE + server replayable, nêu giới hạn. Không tự đổi Backend semantics |

PR3 contract/design phải trả lời: source CRUD và identifier server-owned; trusted Workspace/actor; delegated member revoke; permission/FLS trong Lead ingress; event/field allowlist; inbound credentials tách outbound; secret custody và rotation grace có/không; stable delivery dedupe + payload hash conflict; concurrency/idempotency/transaction; inbox receipt authorization/retention/PII; disable effect trên in-flight và retry; error codes; transport/admission; recovery. Chưa có quyết định thì vẫn AUTHORITY_GAP, không tự đặt endpoint/capability/migration.

## 7. Phạm vi PR và file plan

Danh sách path, trạng thái dirty/pin và proposed new files ở [source-and-file-plan.md](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/docs/design/studio-connections-api/source-and-file-plan.md). Đây là phạm vi dự kiến, chưa sửa file nào trong đó.

**PR1 — navigation và trạng thái trung thực**: group label/five destinations; overview đọc outbound và Communications khi có quyền; owner load boundaries; giữ existing outbound commands/layout; apps/inbound/API unavailable views; connected browser facade fail-closed; copy/guidance và route inventory có chủ đích. Không Backend, không đổi AI flow hoặc Multi-Currency. Không biến việc chặn browser fallback thành triển khai integration mới.

**PR2 — outbound connected experience**: controller/list/detail/editor/secret/delivery components; GET by ID và filter mapping từ API sẵn có; per-record version/intent/permission; error classification và Workspace/session invalidation; acceptance connected và SQL. Không endpoint/migration/test-send/bulk/paging/attempt API mới. Review gap G1 trước admission.

**PR3 — inbound source management design**: chỉ tài liệu contract/gap/UX/acceptance và owner decision. Không production file trước khi API được admit.

**PR4 — provider integrations & API access**: chỉ owner deep links/status thật ở capabilities có server query + binding + permission + admission. Generic integration writes và Developer key management giữ unavailable đến khi authority riêng được giải quyết. Không cam kết chúng sẽ hoàn thành trong PR4 nếu Backend chưa tồn tại.

Không tạo PR GitHub, không stage/commit/push ở vòng này. Các tên PR là đơn vị phạm vi đề nghị.

## 8. Acceptance criteria và kế hoạch verification

### 8.1 PR1

- Năm nhãn/đích đúng IA; hai URL cũ vẫn truy cập được; Communications và AI owner URLs/quyền không đổi.
- Overview không lấy Browser repositories làm connected truth; mỗi nguồn có loading/error riêng; lỗi Studio configuration không khóa outbound/Communications không phụ thuộc nó.
- Unsupported khác empty; không có nút mở form credentials cho blocked integrations/inbound/API keys; không có count 0 giả.
- `studio.read`/`studio.configure` và Communications manage đúng theo owner; browser facade connected không ghi local.
- Workspace switch/refresh/logout/login/role khác nhau không giữ status nhạy cảm của scope cũ. Keyboard/mobile/VI/EN và route reload hoạt động.
- Inventory/guidance cập nhật có chủ đích; không thay accepted compatibility baseline, capabilities hoặc pin.

### 8.2 PR2 — bắt buộc ApiHost + SQL thật

| Luồng | Bằng chứng cần giữ |
|---|---|
| Create DRAFT | HTTP request ID/idempotency (không secret), status/version; SQL chỉ một subscription và một idempotency record khi double-submit |
| Activate | If-Match đúng + version tăng; SQL ACTIVE; admitted owner event tạo delivery qua outbox → journal → consumer |
| Pause → resume | SQL PAUSED vẫn fan-out nhưng không lấy gửi mới; resume xử lý backlog. In-flight được ghi nhận đúng giới hạn |
| Update | Chỉ DRAFT/PAUSED, name/event/URL; SQL version tăng; ACTIVE bị từ chối; stale version không overwrite |
| Rotate | Một response ban đầu có secret, retry không có; GET/list không raw secret; SQL protected secret; receiver chứng minh ký bằng generation mới |
| Archive | SQL ARCHIVED, không restore/edit/rotate; giữ delivery lịch sử; không dùng Delete semantics |
| Replay | DEAD_LETTER + server replayable → PENDING; giữ ID/event, append attempts, idempotency chống thao tác lặp; UI không báo đã gửi ngay |
| Security | Workspace A/B (cả thành viên hai Workspace và nonmember), role read/manage/none, quyền thu hồi sau mở editor, expired login; SQL không có cross-scope mutation |
| Recovery | Refresh/lost response/restart/logout/login, deployment outage, invalid endpoint/event, 409/429/5xx; không fallback local, không mất truth command success khi refresh read lỗi |
| Secrets after restart | Data Protection application name/key ring/mount/ACL hiện hữu, decrypt được secret cũ; log/screenshots/traces phải redact. Nếu thiếu ring custody, ghi BLOCKED, không sửa host trong PR UI |

Backend source tests với transport deterministic, ApiHost+SQL HTTP tests, HTTPS receiver integration và browser E2E là **bốn lớp riêng**. Có SQL thật nhưng transport fake không được gọi là real external delivery PASS. Endpoint security không nới localhost/DNS/public HTTPS chỉ để chạy test. Dùng receiver được kiểm soát với HTTPS/DNS hợp lệ nếu cần test network thật.

Harness hiện hữu đã đọc, **chưa chạy trong vòng thiết kế**:

- `backend/scripts/verify-outbound-webhook-management.ps1`: ApiHost/LocalDB lifecycle, auth, concurrency/idempotency và cross-Workspace; có reset/drop database test và seed/SQL setup DEAD_LETTER. Không dùng kết quả đó để chứng minh natural delivery failure hoặc receiver nhận thật. Chưa thấy update coverage trong script này; PR2 cần bổ sung kiểm chứng update.
- `backend/scripts/EventWebhookVerifier/Program.cs`: SQL journal/consumer/sender leases/retry/replay; dùng `CaptureTransport` deterministic. SQL thật không làm transport trở thành external network integration.
- `verify-outbound-webhook-retry-upgrade.ps1`: upgrade-data/migration harness, không phải browser hoặc management E2E.
- FE `check-outbound-webhook-intents.mts` và `check-connected-outbound-webhook-behavior.mts`: unit/deterministic behavior, không ApiHost/SQL.

Chạy các harness reset DB chỉ trên database test riêng đã xác nhận; không chạy trên database CRM đang dùng. Vòng thiết kế không tạo connection/key/secret hay mutation test. PR3/4 chưa authority chỉ nghiệm thu unavailable UX; không tuyên bố chức năng integration/key/inbound management hoạt động.

### 8.3 Trạng thái verification của chính lượt này

| Hạng mục | Trạng thái | Ý nghĩa |
|---|---|---|
| Working tree + source/contract/binding review | PASS | Đã review hai repo, scoped dirty diffs và đối chiếu 0.24/0.23; không phải runtime PASS |
| Design deliverables | PASS | IA, năm wireframes/states, journeys, reuse, gaps, file plan, criteria, decisions có trong package |
| Authority alignment outbound | BLOCKED | Cần owner giải quyết G1 trước admission PR2; không cấp waiver |
| Generic integration mutations / inbound management | BLOCKED | Chưa có authority/API đủ để mở UI commands |
| Developer API key functions | BLOCKED | Chưa có Backend/contract; matrix phân loại capability là Không tồn tại |
| Deterministic backend/FE tests | NOT_RUN | Không chạy code verification cho thiết kế-only |
| ApiHost + SQL connected acceptance | NOT_RUN | Không tạo dữ liệu hoặc chạy reset/seed ở vòng này |
| Live Telegram / external HTTPS receiver integration | NOT_RUN | Không cung cấp credential và không thực hiện request provider/receiver; không tuyên bố PASS |
| Production browser E2E | NOT_RUN | HTML wireframe inspection là artifact QA riêng, không thay thế connected E2E |
| Artifact navigation/render + source unchanged | Xem artifact-verification.json | Kết quả thực thi riêng, không đánh đồng runtime acceptance |

Không có kết quả runtime FAIL/PASS mới được suy ra từ việc test chưa chạy. Các kiểm tra failing/pre-existing của working tree không được baseline/waive trong thiết kế này. Khi triển khai, chạy các quality gates của repo theo phần thực sự đổi: inventory/repo check, presentation responsibility, mutation authority/retention, strict boundaries và api:check; chỉ regenerate API khi có intentional admitted contract change.

## 9. Quyết định cần phê duyệt

| ID | Đề nghị cụ thể | Ai quyết định / chặn gì |
|---|---|---|
| D1 | Duyệt PR1: năm khu vực, hai URL/key cũ + ba route mới, unavailable UX và independent owner loading; không Backend | Product/UX; cho phép bắt đầu PR1 |
| D2 | AI giữ cấu hình/URL hiện hữu và hiển thị ngoài năm mục; Communications đi qua Apps nhưng owner URL và quyền giữ nguyên | Product/UX; chỉ vị trí điều hướng, không mở scope AI |
| D3 | Duyệt PR2 UI list/detail và secret/timeout/conflict/rotate/archive semantics ở mục 4.4; không auto-activate/auto-resume | Product + Integrations owner; chỉ bắt đầu khi G1 được xác nhận admission |
| D4 | Chỉ cho replay qua UI khi subscription ACTIVE và `replayable=true`; PAUSED hướng dẫn resume, ARCHIVED chỉ đọc | Product + Integrations owner; không sửa Backend rule |
| D5 | Timeout xuyên refresh: không auto-resubmit; reconcile và hướng dẫn recover. Không thêm session persistence hay command-status endpoint trong PR2 | Product + Security; nếu muốn recovery tự động phải có thiết kế/authority riêng |
| D6 | PR3 chỉ contract/design; PR4 chỉ capabilities đã có thật. Generic integrations và Developer keys giữ unavailable | Product + Security + owner tương ứng; không admit capability mới bằng việc duyệt UX |

G1–G5 là các quyết định authority của owner, khác với duyệt UX D1–D6. Đồng ý thiết kế không tự giải quyết chúng. Không có yêu cầu ngoại lệ P0 trong package hiện tại; nếu phạm vi triển khai mới buộc đụng file pin, cần phân tích và duyệt chính xác file/thay đổi trước.

**Điểm dừng:** bàn giao thiết kế và phạm vi để duyệt theo yêu cầu người dùng; chưa thay production code.
