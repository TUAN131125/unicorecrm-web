import React from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock3,
  KeyRound,
  Plus,
  RadioTower,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { unavailableFeatureMessage } from "@/shared/operations";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { isDeveloperWebhookSaveUnavailable } from "@/platform/connected-configuration/connectedConfigurationAvailability";
import {
  getDeveloperConfiguration,
  saveDeveloperWebhooks,
  subscribeToDeveloperConfiguration,
  type WebhookDefinition,
  type WebhookDirection,
} from "@/platform/developer-configuration";
import { useSubscribableSnapshot } from "@/platform/react";
import { ConfirmDialog } from "@/shared/components/ui";
import { cn } from "@/shared/lib/classnames/cn";
import {
  StudioCallout,
  StudioCodePreview,
  StudioMetricCard,
  StudioMetricsGrid,
  StudioProgressChecklist,
  StudioSegmentedControl,
} from "../components/StudioExperiencePrimitives";
import {
  StudioButton,
  StudioDialog,
  StudioEmpty,
  StudioField,
  StudioInput,
  StudioPageFrame,
  StudioSaveBar,
  StudioSection,
  StudioSelect,
  StudioStatus,
} from "../components/StudioPrimitives";

type DeveloperTab = "INBOUND" | "OUTBOUND" | "API";

const eventCatalog: Record<WebhookDirection, ReadonlyArray<{ key: string; vi: string; en: string; descriptionVi: string; descriptionEn: string }>> = {
  INBOUND: [
    { key: "lead.created", vi: "Tạo khách hàng tiềm năng từ nguồn ngoài", en: "Create a lead from an external source", descriptionVi: "Nhận dữ liệu khách hàng tiềm năng từ nguồn đã đăng ký.", descriptionEn: "Receive lead data from a registered source." },
    { key: "contact.updated", vi: "Cập nhật liên hệ", en: "Update contact", descriptionVi: "Nhận thay đổi thông tin liên hệ từ hệ thống nguồn.", descriptionEn: "Receive contact changes from a source system." },
    { key: "order.updated", vi: "Cập nhật đơn hàng", en: "Update order", descriptionVi: "Nhận trạng thái đơn hàng từ hệ thống vận hành đã đăng ký.", descriptionEn: "Receive order status from a registered operational system." },
  ],
  OUTBOUND: [
    { key: "deal.stage_changed", vi: "Cơ hội đổi giai đoạn", en: "Opportunity stage changed", descriptionVi: "Thông báo khi cơ hội chuyển sang giai đoạn khác.", descriptionEn: "Notify when an opportunity moves to another stage." },
    { key: "order.confirmed", vi: "Đơn hàng được xác nhận", en: "Order confirmed", descriptionVi: "Thông báo sau khi đơn hàng hoàn tất điều kiện xác nhận.", descriptionEn: "Notify after an order satisfies confirmation requirements." },
    { key: "invoice.issued", vi: "Hóa đơn được phát hành", en: "Invoice issued", descriptionVi: "Thông báo khi hóa đơn được ghi nhận là đã phát hành.", descriptionEn: "Notify when an invoice is recorded as issued." },
    { key: "payment.recorded", vi: "Thanh toán được ghi nhận", en: "Payment recorded", descriptionVi: "Thông báo khi bản ghi thanh toán hợp lệ được tạo.", descriptionEn: "Notify when a valid payment record is created." },
  ],
};

function createWebhook(direction: WebhookDirection): WebhookDefinition {
  return {
    id: `webhook_${crypto.randomUUID()}`,
    name: "",
    direction,
    eventKey: eventCatalog[direction][0]?.key ?? "",
    endpointUrl: "",
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    lastDeliveryAt: null,
    version: 0,
  };
}

function samplePayload(item: WebhookDefinition): string {
  return JSON.stringify({
    id: "evt_example_01",
    event: item.eventKey,
    workspaceId: "workspace_example",
    occurredAt: "2026-07-22T10:30:00.000Z",
    data: {
      recordId: "record_example_01",
      version: 1,
      source: item.direction === "INBOUND" ? "external-provider" : "unicorecrm",
    },
  }, null, 2);
}

export function WebhooksApiView() {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const [unavailableNotice, setUnavailableNotice] = React.useState<string | null>(null);
  const source = useSubscribableSnapshot(getDeveloperConfiguration, subscribeToDeveloperConfiguration);
  const [workingWebhooks, setWorkingWebhooks] = React.useState(source.webhooks);
  const [editing, setEditing] = React.useState<WebhookDefinition | null>(null);
  const [selectedId, setSelectedId] = React.useState(source.webhooks[0]?.id ?? "");
  const [pendingRemoval, setPendingRemoval] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<DeveloperTab>("INBOUND");

  React.useEffect(() => setWorkingWebhooks(source.webhooks), [source.webhooks]);
  React.useEffect(() => {
    const direction = tab === "API" ? null : tab;
    if (direction && workingWebhooks.some((item) => item.id === selectedId && item.direction === direction)) return;
    setSelectedId(direction ? workingWebhooks.find((item) => item.direction === direction)?.id ?? "" : "");
  }, [selectedId, tab, workingWebhooks]);

  const dirty = JSON.stringify(workingWebhooks) !== JSON.stringify(source.webhooks);
  const visible = tab === "API" ? [] : workingWebhooks.filter((item) => item.direction === tab);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const dialogIssues = editing ? [
    !editing.name.trim() ? text("Cần tên webhook.", "Webhook name is required.") : "",
    !editing.eventKey.trim() ? text("Cần chọn sự kiện.", "An event is required.") : "",
    editing.direction === "OUTBOUND" && !isValidHttpsUrl(editing.endpointUrl) ? text("Webhook gửi ra cần endpoint HTTPS hợp lệ.", "Outbound webhooks require a valid HTTPS endpoint.") : "",
  ].filter(Boolean) : [];

  // OpenAPI publishes no webhook operation in either direction, so connected mode has no
  // authoritative write. Refuse rather than persist workspace webhook registrations in one
  // browser and present them as workspace configuration.
  const save = () => {
    if (isDeveloperWebhookSaveUnavailable()) {
      setUnavailableNotice(unavailableFeatureMessage({ vi: "Chưa thể lưu cấu hình webhook", en: "The webhook configuration cannot be saved yet" }, { locale }));
      return;
    }
    setWorkingWebhooks(saveDeveloperWebhooks(workingWebhooks).webhooks);
  };
  const saveDialog = () => {
    if (!editing || dialogIssues.length > 0) return;
    setWorkingWebhooks((items) => items.some((item) => item.id === editing.id)
      ? items.map((item) => item.id === editing.id ? { ...editing, status: "DRAFT" } : item)
      : [...items, { ...editing, status: "DRAFT" }]);
    setSelectedId(editing.id);
    setTab(editing.direction);
    setEditing(null);
  };
  const removeWebhook = () => {
    if (!pendingRemoval) return;
    setWorkingWebhooks((items) => items.filter((item) => item.id !== pendingRemoval));
    setPendingRemoval(null);
  };
  const openNew = (direction: WebhookDirection) => setEditing(createWebhook(direction));
  const eventDefinition = (item: WebhookDefinition) => eventCatalog[item.direction].find((event) => event.key === item.eventKey);
  const formatDate = (value: string | null) => {
    if (!value) return text("Chưa có lần gửi", "No delivery yet");
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  const statusLabel = (status: WebhookDefinition["status"]) => status === "ACTIVE"
    ? text("Đang hoạt động", "Active")
    : status === "PAUSED"
      ? text("Tạm dừng", "Paused")
      : text("Chưa kích hoạt", "Not active");

  return (
    <StudioPageFrame
      title={text("Webhook & API", "Webhooks & API")}
      description={text("Quản lý đăng ký sự kiện, endpoint và khóa truy cập cho các kết nối hệ thống.", "Manage event subscriptions, endpoints, and access keys for system connections.")}
      locale={locale}
      dirty={dirty}
      revision={source.revision}
      actions={tab !== "API" ? <><StudioButton tone="accent" icon={<Plus size={14} />} disabled={!canConfigure} onClick={() => openNew(tab)}>{text("Thêm webhook", "Add webhook")}</StudioButton><StudioButton tone="primary" icon={<Save size={14} />} disabled={!canConfigure || !dirty} onClick={save}>{text("Lưu", "Save")}</StudioButton></> : undefined}
    >
      <StudioMetricsGrid>
        <StudioMetricCard label={text("Webhook nhận vào", "Inbound webhooks")} value={workingWebhooks.filter((item) => item.direction === "INBOUND").length} description={text("Nhận dữ liệu vào CRM qua endpoint riêng.", "Receive CRM data through a dedicated endpoint.")} icon={<ArrowDownToLine size={17} />} tone="violet" />
        <StudioMetricCard label={text("Webhook gửi ra", "Outbound webhooks")} value={workingWebhooks.filter((item) => item.direction === "OUTBOUND").length} description={text("Gửi sự kiện CRM đến endpoint HTTPS.", "Send CRM events to HTTPS endpoints.")} icon={<ArrowUpFromLine size={17} />} />
        <StudioMetricCard label={text("Đang hoạt động", "Active")} value={workingWebhooks.filter((item) => item.status === "ACTIVE").length} description={text("Các webhook đang sẵn sàng nhận hoặc gửi sự kiện.", "Webhooks currently ready to receive or send events.")} icon={<RadioTower size={17} />} tone="success" />
        <StudioMetricCard label={text("Khóa API", "API keys")} value={source.apiKeys.filter((item) => !item.revokedAt).length} description={text("Thông tin định danh, phạm vi và trạng thái sử dụng.", "Identity, scope, and usage status metadata.")} icon={<KeyRound size={17} />} tone="warning" />
      </StudioMetricsGrid>

      <div className="mt-5">
        <StudioSegmentedControl<DeveloperTab>
          ariaLabel={text("Chọn khu vực tích hợp", "Select integration area")}
          value={tab}
          onChange={setTab}
          items={[
            { id: "INBOUND", label: text("Nhận vào", "Inbound"), count: workingWebhooks.filter((item) => item.direction === "INBOUND").length },
            { id: "OUTBOUND", label: text("Gửi ra", "Outbound"), count: workingWebhooks.filter((item) => item.direction === "OUTBOUND").length },
            { id: "API", label: "API", count: source.apiKeys.length },
          ]}
        />
      </div>

      {tab === "API" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <StudioSection title={text("Khóa API", "API keys")} description={text("Quản lý tên, phạm vi và trạng thái của các khóa truy cập workspace.", "Manage workspace access-key names, scopes, and status.")}>
            {source.apiKeys.length === 0 ? (
              <StudioEmpty title={text("Chưa có khóa API", "No API keys yet")} description={text("Tính năng tạo khóa API chưa được bật cho workspace này.", "API-key creation is not enabled for this workspace yet.")} action={<StudioButton tone="accent" disabled>{text("Tạo khóa API", "Create API key")}</StudioButton>} />
            ) : (
              <div className="space-y-3">{source.apiKeys.map((key) => <article key={key.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-950">{key.name}</p><p className="mt-1 text-xs text-slate-500"><code>{key.id}</code></p></div><StudioStatus tone={key.revokedAt ? "danger" : "success"}>{key.revokedAt ? text("Đã thu hồi", "Revoked") : text("Đang hiệu lực", "Active")}</StudioStatus></div><div className="mt-3 flex flex-wrap gap-2">{key.scopes.map((scope) => <span key={scope} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">{scope}</span>)}</div><dl className="mt-4 grid gap-2 border-t border-slate-100 pt-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">{text("Tạo bởi", "Created by")}</dt><dd className="text-slate-700">{key.createdBy}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">{text("Dùng gần nhất", "Last used")}</dt><dd className="text-slate-700">{formatDate(key.lastUsedAt)}</dd></div></dl></article>)}</div>
            )}
          </StudioSection>
          <StudioCallout title={text("Bảo mật khóa API", "API-key security")} description={text("Giá trị bí mật chỉ nên hiển thị một lần khi tạo và không thể xem lại. Hãy lưu tại nơi quản lý thông tin xác thực an toàn.", "A secret should be shown only once when created and cannot be viewed again. Store it in a secure credential manager.")} tone="warning" icon={<ShieldAlert size={16} />} />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
          <StudioSection
            title={tab === "INBOUND" ? text("Webhook nhận vào", "Inbound webhooks") : text("Webhook gửi ra", "Outbound webhooks")}
            description={tab === "INBOUND" ? text("Chọn nguồn và sự kiện nhận vào; endpoint sẽ xuất hiện sau khi đăng ký được kích hoạt.", "Choose inbound sources and events; the endpoint appears after the subscription is activated.") : text("Chọn sự kiện và endpoint nhận thông báo từ CRM.", "Choose events and endpoints that receive CRM notifications.")}
            actions={canConfigure ? <StudioButton tone="accent" size="sm" icon={<Plus size={13} />} onClick={() => openNew(tab)}>{text("Thêm", "Add")}</StudioButton> : undefined}
          >
            {visible.length > 0 ? (
              <div className="space-y-3">{visible.map((item) => {
                const definition = eventDefinition(item);
                return (
                  <article key={item.id} className={cn("rounded-xl border p-4 transition-colors", selected?.id === item.id ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white hover:bg-slate-50")}>
                    <button type="button" onClick={() => setSelectedId(item.id)} className="w-full text-left focus-visible:outline-none">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-medium text-slate-950">{item.name || text("Webhook chưa đặt tên", "Untitled webhook")}</p><p className="mt-1 text-xs text-slate-500"><code>{item.eventKey}</code></p></div><StudioStatus tone={item.status === "ACTIVE" ? "success" : item.status === "PAUSED" ? "warning" : "neutral"}>{statusLabel(item.status)}</StudioStatus></div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">{definition ? (locale === "vi" ? definition.descriptionVi : definition.descriptionEn) : text("Sự kiện tùy chỉnh.", "Custom event.")}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Clock3 size={13} /><span>{formatDate(item.lastDeliveryAt)}</span></div>
                    </button>
                    <div className="mt-3 flex gap-2 border-t border-slate-200/70 pt-3"><StudioButton size="sm" disabled={!canConfigure} onClick={() => setEditing(structuredClone(item))}>{text("Cấu hình", "Configure")}</StudioButton><StudioButton size="sm" tone="danger" icon={<Trash2 size={13} />} disabled={!canConfigure} onClick={() => setPendingRemoval(item.id)}>{text("Gỡ cấu hình", "Remove configuration")}</StudioButton></div>
                  </article>
                );
              })}</div>
            ) : <StudioEmpty title={text("Chưa có webhook", "No webhooks yet")} description={text("Tạo đăng ký sự kiện và hoàn tất các điều kiện cần thiết trước khi kích hoạt.", "Create an event subscription and complete the required setup before activation.")} action={<StudioButton tone="accent" icon={<Plus size={13} />} disabled={!canConfigure} onClick={() => openNew(tab)}>{text("Tạo webhook", "Create webhook")}</StudioButton>} />}
          </StudioSection>

          {selected ? (
            <div className="min-w-0 space-y-5">
              <StudioSection title={text("Chi tiết đăng ký sự kiện", "Event subscription details")} description={text("Tóm tắt cấu hình và trạng thái vận hành của đăng ký.", "A summary of the subscription configuration and operating status.")} actions={<StudioButton size="sm" disabled={!canConfigure} onClick={() => setEditing(structuredClone(selected))}>{text("Chỉnh sửa", "Edit")}</StudioButton>}>
                <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-[0.08em] text-slate-400">{text("Sự kiện", "Event")}</dt><dd className="mt-1 text-sm text-slate-800"><code>{selected.eventKey}</code></dd></div><div><dt className="text-xs uppercase tracking-[0.08em] text-slate-400">Endpoint</dt><dd className="mt-1 break-all text-sm text-slate-800">{selected.direction === "INBOUND" ? text("Có sau khi kích hoạt", "Available after activation") : selected.endpointUrl || "—"}</dd></div><div><dt className="text-xs uppercase tracking-[0.08em] text-slate-400">{text("Tạo lúc", "Created")}</dt><dd className="mt-1 text-sm text-slate-800">{formatDate(selected.createdAt)}</dd></div><div><dt className="text-xs uppercase tracking-[0.08em] text-slate-400">{text("Lần gửi gần nhất", "Last delivery")}</dt><dd className="mt-1 text-sm text-slate-800">{formatDate(selected.lastDeliveryAt)}</dd></div></dl>
              </StudioSection>

              <StudioSection title={text("Mẫu dữ liệu", "Sample payload")} description={text("Mẫu cấu trúc dữ liệu để kiểm tra ánh xạ trường và định dạng sự kiện.", "A sample data structure for checking field mapping and event format.")}>
                <StudioCodePreview value={samplePayload(selected)} label="JSON" copyLabel={text("Sao chép", "Copy")} />
              </StudioSection>

              <StudioSection title={text("Trạng thái vận hành", "Operational readiness")}>
                <StudioProgressChecklist items={[
                  { label: text("Hoàn tất cấu hình", "Complete configuration"), description: text("Tên, hướng dữ liệu và sự kiện đã được lưu.", "The name, data direction, and event are saved."), state: "complete" },
                  { label: text("Kích hoạt kết nối", "Activate connection"), description: text("Endpoint và chữ ký sẽ sẵn sàng khi đăng ký được kích hoạt.", "The endpoint and signature become available when the subscription is activated."), state: selected.status === "ACTIVE" ? "complete" : "current" },
                  { label: text("Theo dõi lần gửi", "Track deliveries"), description: text("Lịch sử gửi, thử lại và lỗi sẽ xuất hiện khi có dữ liệu vận hành.", "Delivery, retry, and failure history appears when operating data is available."), state: selected.lastDeliveryAt ? "complete" : "pending" },
                ]} />
              </StudioSection>
            </div>
          ) : null}
        </div>
      )}

      {unavailableNotice ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{unavailableNotice}</p> : null}
      {tab !== "API" ? <StudioSaveBar dirty={dirty && canConfigure} saving={false} onSave={save} saveLabel={text("Lưu", "Save")} cleanLabel={text("Đã lưu.", "Saved.")} dirtyLabel={text("Có thay đổi chưa lưu.", "Unsaved changes.")} /> : null}

      <StudioDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={text("Cấu hình webhook", "Configure webhook")}
        description={text("Chọn hướng dữ liệu, sự kiện và endpoint phù hợp cho kết nối.", "Choose the data direction, event, and endpoint for the connection.")}
        size="lg"
        footer={<><StudioButton onClick={() => setEditing(null)}>{text("Hủy", "Cancel")}</StudioButton><StudioButton tone="primary" disabled={dialogIssues.length > 0} onClick={saveDialog}>{text("Lưu cấu hình", "Save configuration")}</StudioButton></>}
      >
        {editing ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <StudioField label={text("Tên webhook", "Webhook name")}><StudioInput autoFocus value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></StudioField>
              <StudioField label={text("Hướng dữ liệu", "Direction")}><StudioSelect value={editing.direction} onChange={(event) => { const direction = event.target.value as WebhookDirection; setEditing({ ...editing, direction, eventKey: eventCatalog[direction][0]?.key ?? "", endpointUrl: direction === "INBOUND" ? "" : editing.endpointUrl }); }}><option value="INBOUND">{text("Nhận vào CRM", "Inbound to CRM")}</option><option value="OUTBOUND">{text("Gửi ra từ CRM", "Outbound from CRM")}</option></StudioSelect></StudioField>
              <StudioField label={text("Sự kiện", "Event")} hint={eventDefinition(editing) ? (locale === "vi" ? eventDefinition(editing)?.descriptionVi : eventDefinition(editing)?.descriptionEn) : undefined}><StudioSelect value={editing.eventKey} onChange={(event) => setEditing({ ...editing, eventKey: event.target.value })}>{eventCatalog[editing.direction].map((event) => <option key={event.key} value={event.key}>{locale === "vi" ? event.vi : event.en} · {event.key}</option>)}</StudioSelect></StudioField>
              {editing.direction === "OUTBOUND" ? <StudioField label={text("Endpoint HTTPS", "HTTPS endpoint")} hint={text("URL HTTPS sẽ được kiểm tra trước khi webhook được kích hoạt.", "The HTTPS URL is checked before the webhook is activated.")}><StudioInput type="url" value={editing.endpointUrl} onChange={(event) => setEditing({ ...editing, endpointUrl: event.target.value })} placeholder="https://example.com/webhooks/unicorecrm" /></StudioField> : <StudioCallout title={text("Endpoint nhận vào", "Inbound endpoint")} description={text("Endpoint sẽ xuất hiện sau khi bạn hoàn tất và kích hoạt đăng ký.", "The endpoint appears after you complete and activate the subscription.")} />}
              {dialogIssues.length > 0 ? <StudioCallout title={text("Chưa thể áp dụng", "Cannot apply yet")} tone="warning"><ul className="space-y-1.5 text-xs leading-5 text-amber-900">{dialogIssues.map((issue) => <li key={issue}>• {issue}</li>)}</ul></StudioCallout> : null}
            </div>
            <div className="space-y-4">
              <StudioSection title={text("Xem trước sự kiện", "Event preview")} className="shadow-none"><StudioCodePreview value={samplePayload(editing)} label="JSON" /></StudioSection>
              <StudioCallout title={text("Trạng thái sau khi lưu", "Status after save")} description={text("Cấu hình sẽ được lưu ở trạng thái chưa kích hoạt để bạn kiểm tra trước khi sử dụng.", "The configuration is saved as inactive so it can be reviewed before use.")} tone="warning" icon={<ShieldAlert size={16} />} />
            </div>
          </div>
        ) : null}
      </StudioDialog>

      <ConfirmDialog isOpen={Boolean(pendingRemoval)} onClose={() => setPendingRemoval(null)} onConfirm={removeWebhook} title={text("Gỡ cấu hình webhook", "Remove webhook configuration")} message={text("Cấu hình sẽ được gỡ khỏi danh sách sau khi bạn lưu thay đổi.", "The configuration will be removed from the list after you save the changes.")} confirmText={text("Gỡ cấu hình", "Remove configuration")} cancelText={text("Hủy", "Cancel")} type="danger" />
    </StudioPageFrame>
  );
}

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
