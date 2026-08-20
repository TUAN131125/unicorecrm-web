import React from "react";
import {
  AlertTriangle,
  Ban,
  Cable,
  CheckCircle2,
  Clock3,
  KeyRound,
  RefreshCw,
  Scale,
  Settings2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { WorkspaceCapabilityKey } from "@/platform/capability-manifest";
import type { ExternalAuthorityHealthStatus } from "../application/externalAuthorityHealth";
import { useExternalAuthorityHealth } from "./useExternalAuthorityHealth";

interface ExternalAuthorityHealthPanelProps {
  capabilityKey: WorkspaceCapabilityKey;
}

interface HealthCopy {
  titleVi: string;
  titleEn: string;
  detailVi: string;
  detailEn: string;
  tone: "success" | "warning" | "danger" | "neutral";
  icon: React.ReactNode;
}

export const ExternalAuthorityHealthPanel: React.FC<ExternalAuthorityHealthPanelProps> = ({ capabilityKey }) => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const health = useExternalAuthorityHealth(capabilityKey);

  if (health.loading || health.error || !health.data) {
    return (
      <section
        data-external-authority-state={health.error ? "UNVERIFIED" : "VERIFYING"}
        data-external-authority-access="BLOCKED"
        className="mt-5 w-full rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-left"
        role="status"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm">
            {health.error ? <Ban size={17} /> : <RefreshCw className="animate-spin" size={17} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-rose-950">
              {health.error
                ? (vi ? "Không thể xác minh hệ thống bên ngoài" : "External authority could not be verified")
                : (vi ? "Đang xác minh hệ thống bên ngoài" : "Verifying external authority")}
            </p>
            <p className="mt-1 break-words text-[11px] font-medium leading-5 text-rose-800">
              {vi
                ? "CRM chặn truy cập cho đến khi backend trả về trạng thái provider hợp lệ cho đúng workspace."
                : "CRM blocks access until the backend returns a valid provider-health decision for the current workspace."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {health.error ? (
                <Button type="button" variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={() => void health.refresh()}>
                  {vi ? "Thử lại" : "Retry"}
                </Button>
              ) : (
                <Button type="button" variant="secondary" size="sm" onClick={health.cancel}>
                  {vi ? "Hủy" : "Cancel"}
                </Button>
              )}
              <Link to="/settings/integrations" className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11px] font-bold text-rose-800 hover:bg-rose-100">
                <Settings2 size={13} /> {vi ? "Mở Integration Center" : "Open Integration Center"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const copy = healthCopy(health.data.status);
  const toneClass = {
    success: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
    warning: "border-amber-200 bg-amber-50/80 text-amber-950",
    danger: "border-rose-200 bg-rose-50/80 text-rose-950",
    neutral: "border-slate-200 bg-slate-50 text-slate-900",
  }[copy.tone];
  const iconClass = {
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
    neutral: "text-slate-700",
  }[copy.tone];

  return (
    <section
      data-external-authority-state={health.data.status}
      data-external-authority-access={health.data.accessMode}
      data-external-authority-source={health.data.authority}
      className={`mt-5 w-full rounded-2xl border p-4 text-left ${toneClass}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${iconClass}`}>
          {copy.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-xs font-extrabold [overflow-wrap:anywhere]">{vi ? copy.titleVi : copy.titleEn}</p>
            <span className="rounded-full border border-current/15 bg-white/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide">
              {health.data.accessMode === "READ_ONLY" ? (vi ? "Chỉ đọc" : "Read only") : (vi ? "Đã chặn" : "Blocked")}
            </span>
          </div>
          <p className="mt-1 break-words text-[11px] font-medium leading-5 opacity-80 [overflow-wrap:anywhere]">
            {vi ? copy.detailVi : copy.detailEn}
          </p>
          <dl className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2">
            <HealthFact label={vi ? "Provider" : "Provider"} value={health.data.providerName ?? health.data.providerId ?? (vi ? "Chưa cấu hình" : "Not configured")} />
            <HealthFact label={vi ? "Nguồn dữ liệu" : "Source of truth"} value={vi ? "Hệ thống bên ngoài" : "External system"} />
            {health.data.lastSuccessfulSyncAt && <HealthFact label={vi ? "Đồng bộ gần nhất" : "Last successful sync"} value={formatDate(health.data.lastSuccessfulSyncAt, locale)} />}
            {health.data.tokenExpiresAt && <HealthFact label={vi ? "Token hết hạn" : "Token expires"} value={formatDate(health.data.tokenExpiresAt, locale)} />}
            {health.data.syncLagSeconds !== undefined && <HealthFact label={vi ? "Độ trễ đồng bộ" : "Sync lag"} value={formatDuration(health.data.syncLagSeconds, vi)} />}
            {health.data.outstandingReconciliationCount !== undefined && <HealthFact label={vi ? "Chờ đối soát" : "Pending reconciliation"} value={String(health.data.outstandingReconciliationCount)} />}
          </dl>
          {health.data.reasonCodes.length > 0 && (
            <p className="mt-3 break-all rounded-lg border border-current/10 bg-white/60 px-2.5 py-2 font-mono text-[9px] opacity-75">
              {health.data.reasonCodes.join(" · ")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={() => void health.refresh()}>
              {vi ? "Làm mới trạng thái" : "Refresh status"}
            </Button>
            <Link to="/settings/integrations" className="inline-flex items-center gap-1.5 rounded-lg border border-current/15 bg-white/80 px-3 py-2 text-[11px] font-bold hover:bg-white">
              <Settings2 size={13} /> {vi ? "Mở Integration Center" : "Open Integration Center"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

const HealthFact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0 rounded-lg border border-current/10 bg-white/60 px-2.5 py-2">
    <dt className="font-bold opacity-60">{label}</dt>
    <dd className="mt-0.5 break-words font-extrabold [overflow-wrap:anywhere]">{value}</dd>
  </div>
);

function healthCopy(status: ExternalAuthorityHealthStatus): HealthCopy {
  const copy: Record<ExternalAuthorityHealthStatus, HealthCopy> = {
    HEALTHY: {
      titleVi: "Kết nối bên ngoài đang hoạt động",
      titleEn: "External connection is healthy",
      detailVi: "Provider là nguồn dữ liệu authoritative. CRM chỉ cho phép đọc dữ liệu đã đồng bộ và không thực hiện native writes.",
      detailEn: "The provider is authoritative. CRM may expose synchronized data as read-only and never performs native writes.",
      tone: "success",
      icon: <CheckCircle2 size={17} />,
    },
    DEGRADED: {
      titleVi: "Kết nối bên ngoài đang suy giảm",
      titleEn: "External connection is degraded",
      detailVi: "Dữ liệu có thể còn đọc được nhưng độ mới hoặc một số thao tác đồng bộ không được bảo đảm.",
      detailEn: "Data may remain readable, but freshness or some synchronization operations are not guaranteed.",
      tone: "warning",
      icon: <AlertTriangle size={17} />,
    },
    UNAVAILABLE: {
      titleVi: "Provider không khả dụng",
      titleEn: "Provider is unavailable",
      detailVi: "CRM đã chặn dữ liệu bên ngoài vì provider hoặc adapter hiện không phản hồi.",
      detailEn: "CRM blocked external data because the provider or adapter is not responding.",
      tone: "danger",
      icon: <Ban size={17} />,
    },
    AUTHENTICATION_EXPIRED: {
      titleVi: "Xác thực provider đã hết hạn",
      titleEn: "Provider authentication has expired",
      detailVi: "Token hoặc credential reference phải được gia hạn trước khi đồng bộ có thể tiếp tục.",
      detailEn: "The token or credential reference must be renewed before synchronization can continue.",
      tone: "danger",
      icon: <KeyRound size={17} />,
    },
    SYNC_DELAYED: {
      titleVi: "Đồng bộ đang chậm",
      titleEn: "Synchronization is delayed",
      detailVi: "CRM chỉ hiển thị dữ liệu hiện có ở chế độ chỉ đọc và đánh dấu độ trễ để tránh hiểu nhầm là dữ liệu mới nhất.",
      detailEn: "CRM exposes existing data as read-only and surfaces the lag so it is not mistaken for current data.",
      tone: "warning",
      icon: <Clock3 size={17} />,
    },
    RECONCILIATION_REQUIRED: {
      titleVi: "Cần đối soát dữ liệu",
      titleEn: "Data reconciliation is required",
      detailVi: "Provider và CRM đang có chênh lệch. Dữ liệu chỉ đọc được giữ lại trong khi đội vận hành xử lý đối soát.",
      detailEn: "The provider and CRM disagree. Read-only data is retained while operations resolves the reconciliation items.",
      tone: "warning",
      icon: <Scale size={17} />,
    },
    UNCONFIGURED: {
      titleVi: "Chưa cấu hình adapter bên ngoài",
      titleEn: "External adapter is not configured",
      detailVi: "Capability đã chuyển sang External nhưng workspace chưa có provider và read/sync contract hợp lệ.",
      detailEn: "The capability is External, but the workspace does not yet have a valid provider and read/sync contract.",
      tone: "neutral",
      icon: <Cable size={17} />,
    },
  };
  return copy[status];
}

function formatDate(value: string, locale: "vi" | "en"): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number, vi: boolean): string {
  if (seconds < 60) return `${seconds} ${vi ? "giây" : "sec"}`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} ${vi ? "phút" : "min"}`;
  return `${Math.round(seconds / 3600)} ${vi ? "giờ" : "hr"}`;
}
