import React from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { ApplicationError } from "@/shared/domain";

interface AuthoritativeQueryNoticeProps {
  connected: boolean;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  loadedAt?: string;
  error?: ApplicationError;
  onRefresh: () => void;
  compact?: boolean;
}

export const AuthoritativeQueryNotice: React.FC<AuthoritativeQueryNoticeProps> = ({
  connected,
  loading,
  refreshing,
  stale,
  loadedAt,
  error,
  onRefresh,
  compact = false,
}) => {
  const { locale } = useI18n();
  if (!connected) return null;

  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const timestamp = loadedAt
    ? new Date(loadedAt).toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" })
    : undefined;

  const tone = stale || error
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const icon = stale || error
    ? <AlertTriangle size={14} />
    : loading || refreshing
      ? <RefreshCw size={14} className="animate-spin" />
      : <CheckCircle2 size={14} />;
  const label = stale
    ? text("Đang hiển thị dữ liệu cũ do lần đồng bộ gần nhất thất bại", "Showing stale data because the latest refresh failed")
    : loading && !loadedAt
      ? text("Đang tải dữ liệu từ backend", "Loading authoritative backend data")
      : refreshing
        ? text("Đang làm mới dữ liệu", "Refreshing authoritative data")
        : timestamp
          ? text(`Dữ liệu backend cập nhật lúc ${timestamp}`, `Backend data updated at ${timestamp}`)
          : text("Dữ liệu authoritative từ backend", "Authoritative backend data");

  return (
    <div
      data-authoritative-query-notice={stale ? "stale" : refreshing || loading ? "loading" : "ready"}
      className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 ${compact ? "py-1.5" : "py-2"} text-[11px] font-medium ${tone}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Wifi size={13} className="shrink-0 opacity-70" />
        <span className="shrink-0">{icon}</span>
        <span className="crm-text-wrap">{label}</span>
      </div>
      <Button
        type="button"
        size="xs"
        variant="secondary"
        className="shrink-0"
        icon={<RefreshCw size={12} />}
        disabled={loading || refreshing}
        onClick={onRefresh}
      >
        {text("Làm mới", "Refresh")}
      </Button>
    </div>
  );
};
