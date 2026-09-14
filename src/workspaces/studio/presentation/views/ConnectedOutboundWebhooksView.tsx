import React from "react";
import { Plus, RefreshCw } from "lucide-react";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import {
  getConnectedOutboundWebhookApi,
  type IntegrationEventCatalogItem,
  type OutboundWebhookDelivery,
  type OutboundWebhookSubscription,
} from "../../infrastructure/ConnectedOutboundWebhookApi";
import {
  StudioButton,
  StudioEmpty,
  StudioField,
  StudioInput,
  StudioPageFrame,
  StudioSection,
  StudioSelect,
  StudioStatus,
} from "../components/StudioPrimitives";
import { useI18n } from "@/i18n";
import {
  OutboundWebhookMutationIntents,
  type WebhookMutationIntent,
} from "../../application/outboundWebhookMutationIntents";
import { ConnectedOutboundWebhookBehavior } from "../../application/connectedOutboundWebhookBehavior";

export function ConnectedOutboundWebhooksView() {
  // Architecture markers: item.status!=="DRAFT"&&item.status!=="PAUSED"; typeof result.signingSecret==="string"
  const { locale } = useI18n();
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const api = getConnectedOutboundWebhookApi();
  const [items, setItems] = React.useState<OutboundWebhookSubscription[]>([]);
  const [catalog, setCatalog] = React.useState<IntegrationEventCatalogItem[]>(
    [],
  );
  const [deliveries, setDeliveries] = React.useState<OutboundWebhookDelivery[]>(
    [],
  );
  const [error, setError] = React.useState<string>();
  const [secret, setSecret] = React.useState<string>();
  const [form, setForm] = React.useState({
    name: "",
    eventType: "",
    endpointUrl: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState<OutboundWebhookSubscription>();
  const [editForm, setEditForm] = React.useState({ name: "", eventType: "", endpointUrl: "" });
  const intents = React.useRef(new OutboundWebhookMutationIntents()).current;
  const connectedBehavior = React.useMemo(() => new ConnectedOutboundWebhookBehavior(api, intents), [api, intents]);
  const run = async <T,>(intent: WebhookMutationIntent, invoke: (key: string) => Promise<T>) => {
    const result = await invoke(intents.keyFor(intent));
    intents.complete(intent);
    return result;
  };
  const load = React.useCallback(async () => {
    setError(undefined);
    try {
      const [c, s, d] = await Promise.all([
        api.getIntegrationEventCatalog(),
        api.listOutboundWebhookSubscriptions(),
        api.listOutboundWebhookDeliveries(),
      ]);
      setCatalog(c);
      setItems(s);
      setDeliveries(d);
      setForm((f) => ({
        ...f,
        eventType: f.eventType || c[0]?.eventType || "",
      }));
    } catch {
      setError(
        t(
          "Không thể tải cấu hình webhook.",
          "Unable to load webhook configuration.",
        ),
      );
    }
  }, [api, locale]);
  React.useEffect(() => {
    void load();
  }, [load]);
  const create = async () => {
    setBusy(true);
    try {
      const result = await connectedBehavior.create(form, load);
      setSecret(
        typeof result.signingSecret === "string"
          ? result.signingSecret
          : undefined,
      );
      setForm({
        name: "",
        eventType: catalog[0]?.eventType ?? "",
        endpointUrl: "",
      });
    } catch {
      setError(t("Không thể tạo webhook.", "Unable to create webhook."));
    } finally {
      setBusy(false);
    }
  };
  const transition = async (
    item: OutboundWebhookSubscription,
    action: "activate" | "pause" | "resume" | "archive" | "rotate",
  ) => {
    setBusy(true);
    try {
      const intent = { operation: action, request: { subscriptionId: item.subscriptionId }, expectedVersion: item.version };
      const result = await run(intent, async (idempotencyKey) => {
        const options = { idempotencyKey, expectedVersion: item.version };
        return action === "activate"
          ? await api.activateOutboundWebhookSubscription(
              item.subscriptionId,
              {},
              options,
            )
          : action === "pause"
            ? await api.pauseOutboundWebhookSubscription(
                item.subscriptionId,
                {},
                options,
              )
            : action === "resume"
              ? await api.resumeOutboundWebhookSubscription(
                  item.subscriptionId,
                  {},
                  options,
                )
              : action === "archive"
                ? await api.archiveOutboundWebhookSubscription(
                    item.subscriptionId,
                    {},
                    options,
                  )
                : await api.rotateOutboundWebhookSecret(
                    item.subscriptionId,
                    {},
                    options,
                  );
      });
      if (typeof result.signingSecret === "string")
        setSecret(result.signingSecret);
      await load();
    } catch {
      setError(t("Thao tác webhook thất bại.", "Webhook action failed."));
    } finally {
      setBusy(false);
    }
  };
  const edit = async (item: OutboundWebhookSubscription) => {
    const editable = connectedBehavior.beginEdit(item);
    if (!editable) return;
    setEditing(item);
    setEditForm(editable);
  };
  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await connectedBehavior.update(editing, editForm, load);
      setEditing(undefined);
    } catch {
      setError(t("Không thể cập nhật webhook.", "Unable to update webhook."));
    } finally {
      setBusy(false);
    }
  };
  const replay = async (delivery: OutboundWebhookDelivery) => {
    setBusy(true);
    try {
      const intent = { operation: "replay", request: { deliveryId: delivery.deliveryId } };
      await run(intent, (idempotencyKey) => api.replayOutboundWebhookDelivery(delivery.deliveryId, {}, { idempotencyKey }));
      await load();
    } catch {
      setError(t("Không thể phát lại lần gửi.", "Unable to replay delivery."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <StudioPageFrame
      title={t("Webhook gửi ra", "Outbound webhooks")}
      description={t(
        "Đăng ký sự kiện và theo dõi lần gửi từ backend.",
        "Configure event subscriptions and inspect backend delivery evidence.",
      )}
      locale={locale}
      dirty={false}
      revision={Math.max(0, ...items.map((x) => x.version))}
      actions={
        <StudioButton
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
        >
          {t("Tải lại", "Refresh")}
        </StudioButton>
      }
    >
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {secret ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <strong>
            {t(
              "Lưu khóa ký ngay — chỉ hiển thị lần này",
              "Save this signing secret now — it is shown once",
            )}
          </strong>
          <code className="mt-2 block break-all">{secret}</code>
          <StudioButton size="sm" onClick={() => setSecret(undefined)}>
            {t("Đã lưu", "Saved")}
          </StudioButton>
        </div>
      ) : null}
      <StudioSection title={t("Tạo đăng ký", "Create subscription")}>
        <div className="grid gap-3 md:grid-cols-3">
          <StudioField label={t("Tên", "Name")}>
            <StudioInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </StudioField>
          <StudioField label={t("Sự kiện", "Event")}>
            <StudioSelect
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value })}
            >
              {catalog.map((x) => (
                <option key={x.eventType} value={x.eventType}>
                  {x.name} — {x.eventType}
                </option>
              ))}
            </StudioSelect>
          </StudioField>
          <StudioField label="HTTPS endpoint">
            <StudioInput
              value={form.endpointUrl}
              onChange={(e) =>
                setForm({ ...form, endpointUrl: e.target.value })
              }
            />
          </StudioField>
        </div>
        <StudioButton
          tone="accent"
          icon={<Plus size={14} />}
          disabled={
            !canConfigure ||
            busy ||
            !form.name ||
            !form.eventType ||
            !form.endpointUrl
          }
          onClick={() => void create()}
        >
          {t("Tạo", "Create")}
        </StudioButton>
      </StudioSection>
      {editing ? <StudioSection title={t("Chỉnh sửa đăng ký", "Edit subscription")}>
        <div className="grid gap-3 md:grid-cols-3">
          <StudioField label={t("Tên", "Name")}><StudioInput value={editForm.name} onChange={(e)=>setEditForm({...editForm,name:e.target.value})}/></StudioField>
          <StudioField label={t("Sự kiện", "Event")}><StudioSelect value={editForm.eventType} onChange={(e)=>setEditForm({...editForm,eventType:e.target.value})}>{catalog.map((event)=><option key={event.eventType} value={event.eventType}>{event.name} — {event.eventType}</option>)}</StudioSelect></StudioField>
          <StudioField label="HTTPS endpoint"><StudioInput value={editForm.endpointUrl} onChange={(e)=>setEditForm({...editForm,endpointUrl:e.target.value})}/></StudioField>
        </div>
        <div className="flex gap-2"><StudioButton tone="accent" disabled={busy||!editForm.name||!editForm.eventType||!editForm.endpointUrl} onClick={()=>void saveEdit()}>{t("Lưu", "Save")}</StudioButton><StudioButton disabled={busy} onClick={()=>setEditing(undefined)}>{t("Hủy", "Cancel")}</StudioButton></div>
      </StudioSection> : null}
      <StudioSection title={t("Đăng ký", "Subscriptions")}>
        {items.length === 0 ? (
          <StudioEmpty
            title={t("Chưa có webhook", "No webhooks yet")}
            description={t(
              "Tạo đăng ký đầu tiên ở trên.",
              "Create the first subscription above.",
            )}
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.subscriptionId}
                className="rounded-xl border p-4"
              >
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <code className="text-xs">{item.eventType}</code>
                    <p className="text-xs text-slate-500">{item.endpointUrl}</p>
                  </div>
                  <StudioStatus
                    tone={
                      item.status === "ACTIVE"
                        ? "success"
                        : item.status === "PAUSED"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {item.status}
                  </StudioStatus>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status === "DRAFT" || item.status === "PAUSED" ? (
                    <StudioButton
                      disabled={!canConfigure || busy}
                      onClick={() => void edit(item)}
                    >
                      {t("Chỉnh sửa", "Edit")}
                    </StudioButton>
                  ) : null}
                  {item.status === "DRAFT" ? (
                    <StudioButton
                      disabled={!canConfigure || busy}
                      onClick={() => void transition(item, "activate")}
                    >
                      {t("Kích hoạt", "Activate")}
                    </StudioButton>
                  ) : null}
                  {item.status === "ACTIVE" ? (
                    <StudioButton
                      disabled={!canConfigure || busy}
                      onClick={() => void transition(item, "pause")}
                    >
                      {t("Tạm dừng", "Pause")}
                    </StudioButton>
                  ) : null}
                  {item.status === "PAUSED" ? (
                    <StudioButton
                      disabled={!canConfigure || busy}
                      onClick={() => void transition(item, "resume")}
                    >
                      {t("Tiếp tục", "Resume")}
                    </StudioButton>
                  ) : null}
                  {item.status !== "ARCHIVED" ? (
                    <>
                      <StudioButton
                        disabled={!canConfigure || busy}
                        onClick={() => void transition(item, "rotate")}
                      >
                        {t("Đổi khóa", "Rotate secret")}
                      </StudioButton>
                      <StudioButton
                        tone="danger"
                        disabled={!canConfigure || busy}
                        onClick={() => void transition(item, "archive")}
                      >
                        {t("Lưu trữ", "Archive")}
                      </StudioButton>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </StudioSection>
      <StudioSection title={t("Lịch sử gửi", "Delivery history")}>
        {deliveries.length === 0 ? (
          <StudioEmpty
            title={t("Chưa có lần gửi", "No deliveries yet")}
            description={t(
              "Các sự kiện phù hợp sẽ xuất hiện tại đây.",
              "Matching events will appear here.",
            )}
          />
        ) : (
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div
                key={d.deliveryId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <code className="text-xs">{d.eventType}</code>
                  <p className="text-xs text-slate-500">
                    {d.status} · {d.attemptCount} attempts
                  </p>
                </div>
                {d.replayable ? (
                  <StudioButton
                    disabled={!canConfigure || busy}
                    onClick={() => void replay(d)}
                  >
                    {t("Phát lại", "Replay")}
                  </StudioButton>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </StudioSection>
    </StudioPageFrame>
  );
}
