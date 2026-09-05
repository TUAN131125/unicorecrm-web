import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { ApplicationError } from "@/shared/domain";
import { formatApplicationError } from "./errorPresentation";

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
  loadedAt: _loadedAt,
  error,
  onRefresh,
  compact = false,
}) => {
  const { locale } = useI18n();
  if (!connected) return null;

  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const hasFailure = Boolean(error);
  if (!hasFailure && !loading && !refreshing) return null;

  const tone = hasFailure
    ? stale
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-rose-200 bg-rose-50 text-rose-800"
    : "border-slate-200 bg-slate-50 text-slate-600";
  const icon = hasFailure
    ? <AlertTriangle size={14} />
    : <RefreshCw size={14} className="animate-spin" />;
  const failureMessage = error
    ? formatApplicationError(error, {
        locale,
        fallbackMessage: text("Không thể tải dữ liệu mới nhất.", "The latest data could not be loaded."),
      })
    : undefined;
  const label = hasFailure
    ? stale
      ? text(`Đang giữ dữ liệu hiện có. ${failureMessage}`, `Keeping the current data. ${failureMessage}`)
      : failureMessage
    : refreshing
      ? text("Đang làm mới dữ liệu", "Refreshing data")
      : text("Đang tải dữ liệu", "Loading data");

  return (
    <div
      data-authoritative-query-notice={stale ? "stale" : hasFailure ? "error" : "loading"}
      className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 ${compact ? "py-1.5" : "py-2"} text-[11px] font-medium ${tone}`}
    >
      <div className="flex min-w-0 items-center gap-2">
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
