import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n";
import { ROUTE_KEYS, toWorkspacePath } from "@/platform/navigation";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useConnectionsOverview, type ConnectionRead } from "../hooks/useConnectionsOverview";
import { ConnectionsPageFrame } from "../components/ConnectionsPageFrame";
import { CommunicationsChannelsEntry } from "../components/CommunicationsChannelsEntry";
import { StudioButton, StudioSection } from "../components/StudioPrimitives";

function ReadState<T>({ state, children }: { state: ConnectionRead<T>; children: (data: T) => React.ReactNode }) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  if (state.status !== "ready") return <p role={state.status === "error" ? "alert" : "status"} className="text-sm text-slate-600">{
    state.status === "loading" ? (vi ? "Đang tải từ máy chủ…" : "Loading from server…") :
    state.status === "denied" ? (vi ? "Không có quyền xem trong phiên này." : "Read access is unavailable in this session.") :
    state.status === "unavailable" ? (vi ? "Chưa có dữ liệu máy chủ trong chế độ demo." : "Server data is unavailable in demo mode.") :
    (vi ? "Không thể tải dữ liệu. Làm mới để thử lại." : "Could not load data. Refresh to retry.")
  }</p>;
  return <>{children(state.data)}<p className="mt-3 text-xs text-slate-500">{vi ? "Đọc lúc: " : "Read at: "}<time dateTime={state.readAt}>{new Date(state.readAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</time></p></>;
}

export function ConnectionsOverviewView() {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const workspace = useWorkspaceContextSnapshot();
  const model = useConnectionsOverview();
  const link = (route: string, title: string) => <Link className="mt-4 inline-block text-sm font-medium text-violet-700 underline underline-offset-4" to={toWorkspacePath(workspace.workspaceKey, "studio", route)}>{title} →</Link>;
  return <ConnectionsPageFrame title={vi ? "Tổng quan kết nối" : "Overview"} description={vi ? "Trạng thái theo từng nguồn trong Workspace hiện tại. Trạng thái cấu hình không xác nhận sức khỏe giao nhận." : "Source-specific state in the current Workspace. Configuration state does not confirm delivery health."} actions={<StudioButton onClick={model.reload} disabled={!model.canRefresh} icon={<RefreshCw size={15} />}>{vi ? "Làm mới dữ liệu đọc" : "Refresh read data"}</StudioButton>}>
    <div className="grid gap-5 xl:grid-cols-2">
      <StudioSection title={vi ? "Webhook gửi đi" : "Outbound Webhooks"}>
        <div data-guidance-id="studio.connections.subscriptions"><h3 className="mb-3 text-sm font-medium">{vi ? "Đăng ký từ máy chủ" : "Server subscriptions"}</h3>
          <ReadState state={model.subscriptions}>{items => items.length === 0 ? <p className="text-sm text-slate-600">{vi ? "Chưa có đăng ký webhook trong Workspace này." : "No webhook subscriptions in this Workspace."}</p> : <dl className="grid grid-cols-2 gap-3">{(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const).map(status => <div key={status} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{status}</dt><dd className="mt-1 text-xl font-semibold">{items.filter(item => item.status === status).length}</dd></div>)}</dl>}</ReadState>
        </div>
        {link(ROUTE_KEYS.SETTINGS_WEBHOOKS_API, vi ? "Xem webhook gửi đi" : "View outbound webhooks")}
      </StudioSection>
      <StudioSection title={vi ? "Giao nhận gần đây" : "Recent deliveries"} description={vi ? "Tối đa 200 bản ghi mới nhất; không phải toàn bộ lịch sử hoặc tỷ lệ thành công tổng thể." : "Up to 200 latest records; not the full history or an overall success rate."}>
        <div data-guidance-id="studio.connections.deliveries"><ReadState state={model.deliveries}>{items => items.length === 0 ? <p className="text-sm text-slate-600">{vi ? "Chưa có giao nhận trong cửa sổ truy vấn này." : "No deliveries in this query window."}</p> : <dl className="space-y-2">{(["PENDING", "IN_FLIGHT", "RETRY_SCHEDULED", "SUCCEEDED", "DEAD_LETTER"] as const).map(status => <div key={status} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><dt>{status}</dt><dd className="font-semibold">{items.filter(item => item.status === status).length}</dd></div>)}</dl>}</ReadState></div>
      </StudioSection>
      <StudioSection title={vi ? "Ứng dụng & dịch vụ" : "Apps & Services"} description={vi ? "Xem trạng thái tài khoản và kết nối tại Communications. Quản lý dịch vụ khác chưa khả dụng." : "Review account and connection state in Communications. Other service management is unavailable."}>
        <CommunicationsChannelsEntry />
        {link(ROUTE_KEYS.SETTINGS_INTEGRATIONS, vi ? "Xem ứng dụng & dịch vụ" : "View apps & services")}
      </StudioSection>
      <StudioSection title={vi ? "Khả năng chưa khả dụng" : "Unavailable capabilities"}>
        <p className="text-sm leading-6 text-slate-600">{vi ? "Studio chưa hỗ trợ quản lý nguồn nhận hoặc khóa API trong môi trường này." : "Studio does not support inbound source or API key management in this environment."}</p>
        <div className="flex flex-wrap gap-6">{link(ROUTE_KEYS.SETTINGS_CONNECTIONS_INBOUND, vi ? "Nhận dữ liệu" : "Inbound Sources")}{link(ROUTE_KEYS.SETTINGS_API_ACCESS, vi ? "Truy cập API" : "Developer API")}</div>
      </StudioSection>
    </div>
  </ConnectionsPageFrame>;
}
