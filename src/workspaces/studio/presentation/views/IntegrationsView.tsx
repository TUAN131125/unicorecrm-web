import React from "react";
import {
  ArrowLeftRight,
  Cable,
  Clock3,
  FileText,
  Mail,
  MessageCircle,
  Settings2,
  ShieldCheck,
  Truck,
  Unplug,
  WalletCards,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import {
  disconnectIntegrationConnection,
  getIntegrationConfiguration,
  saveIntegrationConnection,
  subscribeToIntegrationConfiguration,
  type IntegrationCategory,
  type IntegrationConnection,
  type IntegrationProvider,
  type IntegrationStatus,
} from "@/platform/integrations";
import { useSubscribableSnapshot } from "@/platform/react";
import {
  StudioCallout,
  StudioMetricCard,
  StudioMetricsGrid,
  StudioProgressChecklist,
  StudioSegmentedControl,
} from "../components/StudioExperiencePrimitives";
import {
  StudioButton,
  StudioDialog,
  StudioField,
  StudioInput,
  StudioPageFrame,
  StudioSearchInput,
  StudioSection,
  StudioStatus,
} from "../components/StudioPrimitives";

type IntegrationFilter = "ALL" | IntegrationCategory;

const categoryIcons: Record<IntegrationCategory, React.ReactNode> = {
  EMAIL: <Mail size={18} />,
  MESSAGING: <MessageCircle size={18} />,
  SHIPPING: <Truck size={18} />,
  PAYMENT: <WalletCards size={18} />,
  E_INVOICE: <FileText size={18} />,
  EXCHANGE_RATE: <ArrowLeftRight size={18} />,
};

const tone = (status: IntegrationStatus) => status === "CONNECTED" ? "success" : status === "PENDING_VERIFICATION" ? "warning" : status === "ERROR" ? "danger" : "neutral";

export function IntegrationsView() {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const source = useSubscribableSnapshot(getIntegrationConfiguration, subscribeToIntegrationConfiguration);
  const [editing, setEditing] = React.useState<IntegrationConnection | null>(null);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<IntegrationFilter>("ALL");
  const [dialogError, setDialogError] = React.useState("");

  const labels: Record<IntegrationStatus, string> = {
    NOT_CONFIGURED: text("Chưa cấu hình", "Not configured"),
    PENDING_VERIFICATION: text("Đang kiểm tra", "Checking"),
    CONNECTED: text("Đã được xác minh", "Verified"),
    ERROR: text("Cần xử lý", "Needs attention"),
    DISCONNECTED: text("Đã ngắt", "Disconnected"),
  };
  const categoryLabels: Record<IntegrationCategory, string> = {
    EMAIL: text("Email", "Email"),
    MESSAGING: text("Tin nhắn", "Messaging"),
    SHIPPING: text("Vận chuyển", "Shipping"),
    PAYMENT: text("Thanh toán", "Payment"),
    E_INVOICE: text("Hóa đơn điện tử", "E-invoice"),
    EXCHANGE_RATE: text("Tỷ giá", "Exchange rates"),
  };
  const connectionFor = (providerCode: string) => source.connections.find((item) => item.providerCode === providerCode);
  const providerFor = (providerCode: string) => source.providers.find((item) => item.code === providerCode);
  const normalizedSearch = search.trim().toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
  const visibleProviders = source.providers.filter((provider) => {
    const haystack = `${provider.name} ${provider.descriptionVi} ${provider.descriptionEn} ${provider.category}`.toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
    return (category === "ALL" || provider.category === category) && (!normalizedSearch || haystack.includes(normalizedSearch));
  });
  const configuredCount = source.providers.filter((provider) => Boolean(connectionFor(provider.code))).length;
  const pendingCount = source.connections.filter((item) => item.status === "PENDING_VERIFICATION").length;
  const verifiedCount = source.connections.filter((item) => item.status === "CONNECTED").length;
  const attentionCount = source.connections.filter((item) => item.status === "ERROR" || item.status === "DISCONNECTED").length;

  const open = (providerCode: string) => {
    setDialogError("");
    setEditing(connectionFor(providerCode) ?? {
      id: `connection_${crypto.randomUUID()}`,
      providerCode,
      displayName: providerFor(providerCode)?.name ?? "",
      credentialReference: "",
      status: "NOT_CONFIGURED",
      lastVerifiedAt: null,
      version: 0,
    });
  };
  const saveConnection = () => {
    if (!editing) return;
    if (!editing.displayName.trim() || !editing.credentialReference.trim()) {
      setDialogError(text("Cần tên kết nối và mã tham chiếu xác thực.", "Connection name and credential reference are required."));
      return;
    }
    saveIntegrationConnection(editing);
    setEditing(null);
    setDialogError("");
  };
  const formatDate = (value: string | null) => {
    if (!value) return text("Chưa có", "Not available");
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  const integrationUses = (provider: IntegrationProvider): string[] => ({
    EMAIL: [text("Gửi báo giá", "Quote delivery"), text("Chăm sóc khách hàng", "Customer care")],
    MESSAGING: [text("Thông báo giao dịch", "Transactional messages"), text("Chăm sóc", "Relationship care")],
    SHIPPING: [text("Đặt vận chuyển", "Shipment booking"), text("Theo dõi hành trình", "Tracking")],
    PAYMENT: [text("Yêu cầu thanh toán", "Payment requests"), text("Đối soát", "Reconciliation")],
    E_INVOICE: [text("Phát hành hóa đơn", "Invoice issuance"), text("Kiểm tra trạng thái", "Status checks")],
    EXCHANGE_RATE: [text("Tỷ giá đã xác minh", "Verified rates"), text("Quy đổi tiền tệ", "Currency conversion")],
  })[provider.category];


  const content = (
    <>
      {!canConfigure ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{text("Bạn chỉ có quyền xem cấu hình.", "You have read-only access to configuration.")}</p> : null}

      <StudioMetricsGrid>
        <StudioMetricCard label={text("Đã cấu hình", "Configured")} value={`${configuredCount}/${source.providers.length}`} description={text("Có mã tham chiếu xác thực trong workspace.", "Has a credential reference in the workspace.")} icon={<Cable size={17} />} tone="violet" />
        <StudioMetricCard label={text("Chờ xác minh", "Pending verification")} value={pendingCount} description={text("Thông tin xác thực và phạm vi đang được kiểm tra.", "Credentials and scopes are being checked.")} icon={<Clock3 size={17} />} tone="warning" />
        <StudioMetricCard label={text("Đã xác minh", "Verified")} value={verifiedCount} description={text("Kết nối đã hoàn tất kiểm tra và sẵn sàng sử dụng.", "Connections that completed validation and are ready to use.")} icon={<ShieldCheck size={17} />} tone="success" />
        <StudioMetricCard label={text("Cần xử lý", "Needs attention")} value={attentionCount} description={text("Kết nối lỗi hoặc đã ngắt.", "Connections that failed or were disconnected.")} icon={<Unplug size={17} />} tone={attentionCount > 0 ? "danger" : "neutral"} />
      </StudioMetricsGrid>

      <div className="mt-5 space-y-5">
        <StudioSection title={text("Danh mục kết nối", "Connector directory")} description={text("Tìm kết nối theo nhóm nghiệp vụ và quản lý thông tin xác thực theo cách an toàn.", "Browse connections by business area and manage credentials safely.")}>
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto]">
            <StudioSearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Tìm nhà cung cấp hoặc khả năng...", "Search provider or capability...")} aria-label={text("Tìm kết nối", "Search connectors")} />
            <StudioSegmentedControl<IntegrationFilter>
              ariaLabel={text("Lọc kết nối theo nhóm", "Filter connectors by category")}
              value={category}
              onChange={setCategory}
              items={[
                { id: "ALL", label: text("Tất cả", "All"), count: source.providers.length },
                ...(["EMAIL", "MESSAGING", "SHIPPING", "PAYMENT", "E_INVOICE", "EXCHANGE_RATE"] as const).map((id) => ({ id, label: categoryLabels[id], count: source.providers.filter((provider) => provider.category === id).length })),
              ]}
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleProviders.map((provider) => {
              const connection = connectionFor(provider.code);
              const status = connection?.status ?? "NOT_CONFIGURED";
              return (
                <article key={provider.code} className="flex min-h-[260px] flex-col rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">{categoryIcons[provider.category]}</span>
                    <StudioStatus tone={tone(status)}>{labels[status]}</StudioStatus>
                  </div>
                  <div className="mt-4 min-w-0">
                    <p className="text-base font-medium text-slate-950">{provider.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{locale === "vi" ? provider.descriptionVi : provider.descriptionEn}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">{integrationUses(provider).map((item) => <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">{item}</span>)}</div>
                  <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-xs">
                    <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{text("Tên kết nối", "Connection")}</dt><dd className="min-w-0 break-words text-right text-slate-700">{connection?.displayName || "—"}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{text("Xác minh gần nhất", "Last verified")}</dt><dd className="min-w-0 break-words text-right text-slate-700">{formatDate(connection?.lastVerifiedAt ?? null)}</dd></div>
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <StudioButton size="sm" icon={<Settings2 size={13} />} disabled={!canConfigure} onClick={() => open(provider.code)}>{connection ? text("Quản lý", "Manage") : text("Cấu hình", "Configure")}</StudioButton>
                    {connection?.status === "PENDING_VERIFICATION" ? <StudioButton size="sm" disabled icon={<Clock3 size={13} />}>{text("Đang kiểm tra", "Checking")}</StudioButton> : null}
                    {connection && connection.status !== "DISCONNECTED" ? <StudioButton size="sm" tone="danger" icon={<Unplug size={13} />} disabled={!canConfigure} onClick={() => disconnectIntegrationConnection(connection.id)}>{text("Ngắt", "Disconnect")}</StudioButton> : null}
                  </div>
                </article>
              );
            })}
          </div>
          {visibleProviders.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center text-sm text-slate-500">{text("Không có kết nối phù hợp với bộ lọc.", "No connectors match the current filters.")}</div> : null}
        </StudioSection>

        <StudioCallout title={text("Quy trình kết nối", "Connection process")} description={text("Sau khi lưu, dịch vụ kết nối sẽ kiểm tra thông tin xác thực, phạm vi quyền và khả năng truy cập trước khi kết nối được dùng trong nghiệp vụ.", "After saving, the connection service checks credentials, scope, and availability before the connection can be used in business workflows.")} tone="info" />
      </div>

      <StudioDialog
        open={editing !== null}
        onClose={() => { setEditing(null); setDialogError(""); }}
        title={text("Cấu hình kết nối", "Configure connector")}
        description={editing ? (locale === "vi" ? providerFor(editing.providerCode)?.descriptionVi : providerFor(editing.providerCode)?.descriptionEn) : undefined}
        size="lg"
        footer={<><StudioButton onClick={() => { setEditing(null); setDialogError(""); }}>{text("Hủy", "Cancel")}</StudioButton><StudioButton tone="primary" onClick={saveConnection}>{text("Lưu và kiểm tra", "Save and check")}</StudioButton></>}
      >
        {editing ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <StudioField label={text("Tên kết nối", "Connection name")} hint={text("Tên dễ nhận biết trong workspace, không phải tên tài khoản bí mật.", "A recognizable workspace label, not a secret account name.")}><StudioInput value={editing.displayName} onChange={(event) => setEditing({ ...editing, displayName: event.target.value })} /></StudioField>
              <StudioField label={text("Mã tham chiếu xác thực", "Credential reference")} hint={text("Không nhập API key, mật khẩu hoặc token. Chỉ nhập mã tham chiếu do quản trị viên hệ thống cung cấp.", "Do not enter API keys, passwords, or tokens. Enter only the reference ID provided by your system administrator.")}><StudioInput autoFocus value={editing.credentialReference} onChange={(event) => setEditing({ ...editing, credentialReference: event.target.value })} placeholder="secret://workspace/provider/reference" /></StudioField>
              {dialogError ? <StudioCallout title={text("Chưa thể lưu", "Cannot save yet")} description={dialogError} tone="warning" /> : null}
              <StudioCallout title={text("Bảo vệ thông tin xác thực", "Protect credentials")} description={text("Workspace chỉ lưu mã tham chiếu, không lưu trực tiếp giá trị bí mật. Hãy quản lý khóa và mật khẩu tại nơi lưu trữ thông tin xác thực an toàn.", "The workspace stores only a reference ID, not the secret value itself. Manage keys and passwords in a secure credential store.")} tone="warning" />
            </div>
            <div className="space-y-4">
              <StudioSection title={text("Vòng đời kết nối", "Connection lifecycle")} className="shadow-none">
                <StudioProgressChecklist items={[
                  { label: text("Lưu mã tham chiếu", "Save reference ID"), description: text("Tên kết nối và mã tham chiếu đã được lưu.", "The connection name and reference ID are saved."), state: editing.credentialReference.trim() ? "complete" : "current" },
                  { label: text("Kiểm tra thông tin và phạm vi", "Check credentials and scopes"), description: text("Quá trình kiểm tra phải hoàn tất trước khi sử dụng.", "Validation must complete before the connection can be used."), state: editing.status === "CONNECTED" ? "complete" : "blocked" },
                  { label: text("Sẵn sàng sử dụng", "Ready to use"), description: text("Các tính năng liên quan chỉ được bật khi kết nối ở trạng thái ổn định.", "Related features are enabled only when the connection is healthy."), state: editing.status === "CONNECTED" ? "complete" : "pending" },
                ]} />
              </StudioSection>
              <StudioSection title={text("Thông tin trạng thái", "Status evidence")} className="shadow-none">
                <dl className="space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{text("Trạng thái", "Status")}</dt><dd><StudioStatus tone={tone(editing.status)}>{labels[editing.status]}</StudioStatus></dd></div><div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{text("Phiên bản", "Version")}</dt><dd className="text-slate-700">{editing.version}</dd></div><div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{text("Xác minh gần nhất", "Last verified")}</dt><dd className="text-right text-slate-700">{formatDate(editing.lastVerifiedAt)}</dd></div></dl>
              </StudioSection>
            </div>
          </div>
        ) : null}
      </StudioDialog>
    </>
  );


  return (
    <StudioPageFrame title={text("Tích hợp", "Integrations")} description={text("Quản lý nhà cung cấp, thông tin kết nối và trạng thái sẵn sàng của các tích hợp.", "Manage providers, connection details, and integration readiness.")} locale={locale} revision={source.revision}>
      {content}
    </StudioPageFrame>
  );
}
