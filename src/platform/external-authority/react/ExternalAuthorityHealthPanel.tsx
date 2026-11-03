import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { WorkspaceCapabilityKey } from "@/platform/capability-manifest";
import type { ExternalAuthorityHealthStatus } from "../application/externalAuthorityHealth";
import { useExternalAuthorityHealth } from "./useExternalAuthorityHealth";

const messages: Record<ExternalAuthorityHealthStatus, [string, string]> = {
  HEALTHY: ["", ""],
  DEGRADED: ["Dịch vụ đang gián đoạn. Dữ liệu có thể chưa được cập nhật.", "The service is disrupted. Data may be out of date."],
  UNAVAILABLE: ["Không thể kết nối dịch vụ. Vui lòng thử lại.", "The service could not be reached. Please try again."],
  AUTHENTICATION_EXPIRED: ["Kết nối đã hết hạn. Liên hệ quản trị viên để kết nối lại.", "The connection has expired. Contact your administrator to reconnect."],
  SYNC_DELAYED: ["Dữ liệu chưa được cập nhật. Vui lòng thử lại sau.", "Data is not up to date. Please try again later."],
  RECONCILIATION_REQUIRED: ["Dữ liệu cần được đối soát trước khi tiếp tục.", "Data must be reconciled before continuing."],
  UNCONFIGURED: ["Chưa kết nối dịch vụ. Liên hệ quản trị viên để được hỗ trợ.", "The service is not connected. Contact your administrator for help."],
};

export function ExternalAuthorityHealthPanel({ capabilityKey }: { capabilityKey: WorkspaceCapabilityKey }) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const health = useExternalAuthorityHealth(capabilityKey);
  if (health.data?.status === "HEALTHY" && !health.error && !health.loading) return null;
  return <section className="mt-4 w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm"
    role={health.error ? "alert" : "status"}
    data-external-authority-state={health.data?.status ?? (health.error ? "UNVERIFIED" : "VERIFYING")}
    data-external-authority-access={health.data?.accessMode ?? "BLOCKED"}>
    <p>{health.error
      ? (vi ? "Không thể tải dữ liệu. Vui lòng thử lại." : "Data could not be loaded. Please try again.")
      : health.loading || !health.data
        ? (vi ? "Đang tải dữ liệu…" : "Loading data…")
        : messages[health.data.status][vi ? 0 : 1]}</p>
    {health.error || !health.loading
      ? <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void health.refresh()}>{vi ? "Thử lại" : "Retry"}</Button>
      : <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={health.cancel}>{vi ? "Hủy" : "Cancel"}</Button>}
  </section>;
}
