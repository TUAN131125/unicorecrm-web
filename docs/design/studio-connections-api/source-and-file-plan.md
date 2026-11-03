# Nguồn đối chiếu và file plan

Đây là danh sách đề xuất, không phải file đã sửa. Đã inventory toàn bộ working tree; đọc chi tiết source và dirty diffs liên quan Studio/composition/runtime. Snapshot không ngụ ý review toàn bộ nghiệp vụ ngoài phạm vi.

## Source index

| ID | Nguồn | Dòng bắt đầu đối chiếu |
|---|---|---|
| FE-01 | [frontend/src/workspaces/studio/presentation/views/WebhooksApiView.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/presentation/views/WebhooksApiView.tsx:94) | `export function WebhooksApiView` |
| FE-02 | [frontend/src/workspaces/studio/presentation/views/ConnectedOutboundWebhooksView.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/presentation/views/ConnectedOutboundWebhooksView.tsx:27) | `export function ConnectedOutboundWebhooksView` |
| FE-03 | [frontend/src/workspaces/studio/presentation/views/IntegrationsView.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/presentation/views/IntegrationsView.tsx:61) | `export function IntegrationsView` |
| FE-04 | [frontend/src/platform/integrations/BrowserIntegrationConfigurationRepository.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/platform/integrations/BrowserIntegrationConfigurationRepository.ts:15) | `class BrowserIntegrationConfigurationRepository` |
| FE-05 | [frontend/src/platform/developer-configuration/BrowserDeveloperConfigurationRepository.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/platform/developer-configuration/BrowserDeveloperConfigurationRepository.ts:7) | `class BrowserDeveloperConfigurationRepository` |
| FE-06 | [frontend/src/platform/connected-configuration/connectedConfigurationAvailability.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/platform/connected-configuration/connectedConfigurationAvailability.ts:72) | `isDeveloperWebhookSaveUnavailable` |
| FE-07 | [frontend/src/platform/developer-configuration/developerConfigurationRuntime.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/platform/developer-configuration/developerConfigurationRuntime.ts:12) | `saveDeveloperWebhooks` |
| FE-08 | [frontend/src/platform/integrations/integrationConfigurationRuntime.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/platform/integrations/integrationConfigurationRuntime.ts:2) | `createWorkspaceScopedRepository` |
| FE-09 | [frontend/src/workspaces/studio/infrastructure/ConnectedOutboundWebhookApi.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/infrastructure/ConnectedOutboundWebhookApi.ts:12) | `createConnectedOutboundWebhookGateway` |
| FE-10 | [frontend/src/workspaces/studio/application/OutboundWebhookGateway.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/application/OutboundWebhookGateway.ts:50) | `interface OutboundWebhookGateway` |
| FE-11 | [frontend/src/workspaces/studio/application/outboundWebhookMutationIntents.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/application/outboundWebhookMutationIntents.ts:9) | `class OutboundWebhookMutationIntents` |
| FE-12 | [frontend/src/workspaces/studio/application/connectedOutboundWebhookBehavior.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/application/connectedOutboundWebhookBehavior.ts:11) | `class ConnectedOutboundWebhookBehavior` |
| FE-13 | [frontend/src/app/composition/applicationComposition.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/app/composition/applicationComposition.ts:1) | `configureOutboundWebhookApplicationServices` |
| FE-14 | [frontend/src/app/composition/connected/connectedPlatformConfigurationServices.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/app/composition/connected/connectedPlatformConfigurationServices.ts:18) | `declareConnectedPlatformConfigurationUnavailability` |
| FE-15 | [frontend/src/app/router/workspaces/studioWorkspaceRoutes.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/app/router/workspaces/studioWorkspaceRoutes.tsx:137) | `function createStudioWorkspaceRoutes` |
| FE-16 | [frontend/src/workspaces/studio/navigation/studioSectionRegistry.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/navigation/studioSectionRegistry.ts:57) | `STUDIO_SECTION_GROUPS` |
| FE-17 | [frontend/src/platform/api/generated/integrationConfigurationApi.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/platform/api/generated/integrationConfigurationApi.ts:207) | `getOutboundWebhookSubscription` |
| FE-18 | [frontend/docs/api/openapi.json](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/docs/api/openapi.json:49971) | `"operationId": "createOutboundWebhookSubscription"` |
| FE-19 | [frontend/src/modules/communications/presentation/components/TelegramConnectionPanel.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/modules/communications/presentation/components/TelegramConnectionPanel.tsx:22) | `const admitted` |
| BE-01 | [backend/src/UnicoreCRM.Integrations/Webhooks/Inbound/Contracts/InboundLeadWebhookEndpoints.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Integrations/Webhooks/Inbound/Contracts/InboundLeadWebhookEndpoints.cs:13) | `MapInboundLeadWebhookEndpoints` |
| BE-02 | [backend/src/UnicoreCRM.Integrations/Webhooks/Inbound/Application/InboundLeadWebhookCoordinator.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Integrations/Webhooks/Inbound/Application/InboundLeadWebhookCoordinator.cs:15) | `class InboundLeadWebhookCoordinator` |
| BE-03 | [backend/src/UnicoreCRM.Integrations/Infrastructure/Persistence/DevelopmentInboundBindingBootstrap.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Integrations/Infrastructure/Persistence/DevelopmentInboundBindingBootstrap.cs:12) | `class DevelopmentInboundBindingBootstrap` |
| BE-04 | [backend/src/UnicoreCRM.Integrations/Infrastructure/Persistence/EfInboundIntegrationBindingStore.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Integrations/Infrastructure/Persistence/EfInboundIntegrationBindingStore.cs:7) | `class EfInboundIntegrationBindingStore` |
| BE-05 | [backend/docs/architecture/INBOUND_LEAD_WEBHOOK_EXTENSION.md](D:/Project_All/UnicoreCRM/backend/docs/architecture/INBOUND_LEAD_WEBHOOK_EXTENSION.md:3) | `## Authority` |
| BE-06 | [backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/Contracts/OutboundWebhookEndpoints.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/Contracts/OutboundWebhookEndpoints.cs:4) | `MapOutboundWebhookEndpoints` |
| BE-07 | [backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/Application/OutboundWebhookService.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/Application/OutboundWebhookService.cs:16) | `class OutboundWebhookService` |
| BE-08 | [backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/Domain/OutboundWebhookModels.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/Domain/OutboundWebhookModels.cs:3) | `class OutboundWebhookSubscription` |
| BE-09 | [backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/Infrastructure/OutboundWebhookRuntime.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/Infrastructure/OutboundWebhookRuntime.cs:51) | `class SafeOutboundWebhookTransport` |
| BE-10 | [backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/OutboundModule.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Integrations/Webhooks/Outbound/OutboundModule.cs:9) | `AddOutboundModule` |
| BE-11 | [backend/src/UnicoreCRM.ApiHost/Program.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.ApiHost/Program.cs:158) | `app.MapOutboundWebhookEndpoints` |
| BE-12 | [backend/src/UnicoreCRM.Communications/Application/ChannelProviderCatalog.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Communications/Application/ChannelProviderCatalog.cs:9) | `Describe("gmail"` |
| BE-13 | [backend/src/UnicoreCRM.Communications/Contracts/ChannelEndpoints.cs](D:/Project_All/UnicoreCRM/backend/src/UnicoreCRM.Communications/Contracts/ChannelEndpoints.cs:14) | `MapChannel` |
| BE-14 | [backend/scripts/verify-outbound-webhook-management.ps1](D:/Project_All/UnicoreCRM/backend/scripts/verify-outbound-webhook-management.ps1:1) | `param(` |
| BE-15 | [backend/scripts/EventWebhookVerifier/Program.cs](D:/Project_All/UnicoreCRM/backend/scripts/EventWebhookVerifier/Program.cs:128) | `CaptureTransport` |

Contract comparison: FE 0.24 vs Design Authority 0.23.21 nằm trong review-evidence.json. Exact lookups createOutboundWebhookSubscription và receiveGenericSignedLeadWebhook không có trong index; generic create BLOCKED và list READY. Không sửa manifests.

## PR1 — dự kiến frontend files

| File | Hiện trạng lúc review | Mục đích | P0 pin manifest đã review |
|---|---|---|---|
| [frontend/src/workspaces/studio/navigation/studioSectionRegistry.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/navigation/studioSectionRegistry.ts) | hiện hữu | Năm mục, nhãn và AI/Communications placement theo D2 | Không trùng sourceFiles |
| [frontend/src/platform/navigation/routeKeys.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/platform/navigation/routeKeys.ts) | hiện hữu | Thêm ba frontend route keys, giữ hai key cũ | Không trùng sourceFiles |
| [frontend/src/app/router/workspaces/studioWorkspaceRoutes.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/app/router/workspaces/studioWorkspaceRoutes.tsx) | đã có tracked diff — bảo toàn | Ba screens mới; owner loading boundaries; giữ dirty Workspace guards | Không trùng sourceFiles |
| [frontend/src/workspaces/studio/presentation/views/IntegrationsView.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/presentation/views/IntegrationsView.tsx) | hiện hữu | Apps directory thật và unavailable, giữ entrypoint | Không trùng sourceFiles |
| [frontend/src/workspaces/studio/presentation/views/WebhooksApiView.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/presentation/views/WebhooksApiView.tsx) | hiện hữu | Đổi mô tả/entrypoint label; connected vẫn outbound, không mở demo fallback | Không trùng sourceFiles |
| [frontend/src/workspaces/studio/presentation/components/CommunicationsChannelsEntry.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/presentation/components/CommunicationsChannelsEntry.tsx) | hiện hữu | Tái sử dụng link owner, permission hiện hữu | Không trùng sourceFiles |
| [frontend/src/platform/connected-configuration/connectedConfigurationAvailability.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/platform/connected-configuration/connectedConfigurationAvailability.ts) | hiện hữu | Phân biệt browser developer save với generated connected outbound | Không trùng sourceFiles |
| [frontend/src/platform/developer-configuration/developerConfigurationRuntime.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/platform/developer-configuration/developerConfigurationRuntime.ts) | hiện hữu | Fail closed connected browser write; demo giữ nguyên | Không trùng sourceFiles |
| [frontend/src/app/composition/connected/connectedPlatformConfigurationServices.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/app/composition/connected/connectedPlatformConfigurationServices.ts) | hiện hữu | Availability declaration/comment đúng authority; không đổi CRM schema semantics | Không trùng sourceFiles |
| [frontend/src/guidance/content/studio/configuration.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/guidance/content/studio/configuration.ts) | đã có tracked diff — bảo toàn | Guidance đúng năm khu vực; giữ thay đổi AI/QuickSetup hiện có | Không trùng sourceFiles |
| [frontend/docs/quality/repository-inventory.json](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/docs/quality/repository-inventory.json) | hiện hữu | Regenerate intentional structural inventory; không compatibility baseline | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/views/ConnectionsOverviewView.tsx` | MỚI | MỚI: overview read-only theo nguồn | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/views/InboundDataView.tsx` | MỚI | MỚI: unavailable explanation | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/views/ApiAccessView.tsx` | MỚI | MỚI: API access/key unavailable | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/hooks/useConnectionsOverview.ts` | MỚI | MỚI: scoped independent queries/generation/permissions | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/components/ConnectionAreaState.tsx` | MỚI | MỚI: empty/loading/error/unsupported/read-only states | Không trùng sourceFiles |
| `frontend/tests/contract/studio-connections.test.mts` | MỚI | MỚI: route/availability/authority checks | Không trùng sourceFiles |
| `frontend/tests/e2e/studio-connections.spec.ts` | MỚI | MỚI: navigation/role/scope/reload/unavailable UX | Không trùng sourceFiles |

Không dự kiến sửa applicationComposition.ts hoặc studioCoreRuntime.ts: chỉ reuse connected gateway và giữ dirty fixes. canonicalRoutes.ts đã hỗ trợ settings paths; chưa có lý do đổi. Studio index không đổi thành Connections overview. Không sửa AI files.

## PR2 — dự kiến frontend files

| File | Hiện trạng lúc review | Mục đích | P0 pin manifest đã review |
|---|---|---|---|
| [frontend/src/workspaces/studio/presentation/views/ConnectedOutboundWebhooksView.tsx](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/presentation/views/ConnectedOutboundWebhooksView.tsx) | hiện hữu | Thin composition entrypoint | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/hooks/useOutboundWebhookConfiguration.ts` | MỚI | MỚI: controller/read and command recovery | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/components/outbound/OutboundSubscriptionList.tsx` | MỚI | MỚI: list/filter/selection | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/components/outbound/OutboundSubscriptionDetail.tsx` | MỚI | MỚI: detail/lifecycle/version | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/components/outbound/OutboundDeliveryList.tsx` | MỚI | MỚI: DTO-backed delivery window/replay | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/components/outbound/OutboundWebhookEditor.tsx` | MỚI | MỚI: DRAFT/PAUSED edit and create | Không trùng sourceFiles |
| `frontend/src/workspaces/studio/presentation/components/outbound/OneTimeSigningSecretDialog.tsx` | MỚI | MỚI: memory-only secret confirmation | Không trùng sourceFiles |
| [frontend/src/workspaces/studio/application/OutboundWebhookGateway.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/application/OutboundWebhookGateway.ts) | hiện hữu | Expose existing get-by-ID/filter/signal contracts | Không trùng sourceFiles |
| [frontend/src/workspaces/studio/infrastructure/ConnectedOutboundWebhookApi.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/infrastructure/ConnectedOutboundWebhookApi.ts) | hiện hữu | Map generated existing methods/options | Không trùng sourceFiles |
| [frontend/src/workspaces/studio/application/connectedOutboundWebhookBehavior.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/application/connectedOutboundWebhookBehavior.ts) | hiện hữu | Keep command result independent from read refresh | Không trùng sourceFiles |
| [frontend/src/workspaces/studio/application/outboundWebhookMutationIntents.ts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/src/workspaces/studio/application/outboundWebhookMutationIntents.ts) | hiện hữu | Only if scope/reset handling needed; no new persisted schema | Không trùng sourceFiles |
| [frontend/tests/quality/unit/check-connected-outbound-webhook-behavior.mts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/tests/quality/unit/check-connected-outbound-webhook-behavior.mts) | hiện hữu | Verify meaningful command/recovery cases | Không trùng sourceFiles |
| [frontend/tests/quality/unit/check-outbound-webhook-intents.mts](D:/Project_All/UnicoreCRM/frontend/unicorecrm-web/tests/quality/unit/check-outbound-webhook-intents.mts) | hiện hữu | Stable intents/version/scope cases | Không trùng sourceFiles |
| `frontend/tests/e2e/outbound-webhooks-connected.spec.ts` | MỚI | MỚI: real ApiHost/SQL browser acceptance | Không trùng sourceFiles |

### PR2 — verification files Backend, không đổi runtime/API

| File | Hiện trạng | Mục đích | P0 pin |
|---|---|---|---|
| [backend/scripts/verify-outbound-webhook-management.ps1](D:/Project_All/UnicoreCRM/backend/scripts/verify-outbound-webhook-management.ps1) | hiện hữu | Bổ sung update/lifecycle/revocation/isolation/recovery checks nếu coverage thiếu; chỉ DB test riêng | Không trùng sourceFiles |
| [backend/scripts/EventWebhookVerifier/Program.cs](D:/Project_All/UnicoreCRM/backend/scripts/EventWebhookVerifier/Program.cs) | hiện hữu | Bổ sung deterministic + SQL assertions khi cần; không gán network-provider PASS | Không trùng sourceFiles |

Không dự kiến đổi `docs/api/openapi.json`, generated clients, backend endpoints/services/runtime, schema hoặc migrations. Nếu phát hiện phải thay semantics, trả về gap/owner decision trước; không lén mở rộng PR2. Không regenerate toàn bộ API để cập nhật UI khi method đã tồn tại.

## PR3 — documentation only

- Đề xuất mới: `backend/docs/design/inbound-source-management-contract-proposal.md` và FE `docs/design/studio-connections-api/inbound-source-journey.md`. Chỉ sau khi scope được duyệt; chưa tạo trong vòng này.
- Không production file, permission mới, endpoint hoặc migration. Authority phải qua quyết định owner và re-admission trước implementation.

## PR4 — conditional scope

- Có thể sửa `IntegrationsView.tsx`, `ApiAccessView.tsx`, controller overview và capability notice/tests của PR1 để phản ánh capabilities server thật.
- Nếu generic integrations/key API vẫn thiếu hoặc BLOCKED: chỉ copy/status unavailable, không credential forms hoặc local metadata fallback.
- Communications owner components được reuse qua route, không sao chép hoặc viết lại. Catalog conflict là quyết định owner; không sửa Backend catalog trong vòng thiết kế.
- Backend provider/key implementation không nằm trong file plan này; cần admitted task riêng.

## Scope exclusions

Không sửa compatibility baseline; không waiver. SourceFiles manifest có 103 entry; không file dự kiến nào ở trên trùng manifest đã review. Recheck pin set trước từng PR; không suy ra những manifest/lock chưa được cung cấp đã được bỏ bảo vệ. Không sửa hoặc di chuyển bất kỳ dirty AI/Multi-Currency/CRM changes nào.

## Handoff gate

D1–D6 trong design.md là gói quyết định cụ thể. Chỉ thiết kế/docs được tạo ở lượt này. Không tạo GitHub PR, stage, commit hoặc push.
