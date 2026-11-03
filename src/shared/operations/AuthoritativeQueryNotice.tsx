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
  if (!hasFailure) return <div className="pointer-events-none relative h-6 shrink-0" aria-live="polite">
    {(loading || refreshing) && <span role="status" className="absolute right-2 top-1 z-10 rounded bg-white/95 px-2 py-1 text-[11px] text-slate-600 shadow-sm"><RefreshCw size={12} className="mr-1 inline animate-spin" />{text("Đang cập nhật…", "Updating…")}</span>}
  </div>;

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
    <div className="relative flex h-6 min-w-0 shrink-0 items-center gap-2" role="status">
      <details className={`relative min-w-0 rounded border px-2 ${compact ? "text-[10px]" : "text-[11px]"} ${tone}`}>
        <summary className="cursor-pointer list-none" title={failureMessage}>{icon}<span className="ml-1">{text("Không thể cập nhật · Xem lỗi", "Update failed · Details")}</span></summary>
        <div role="alert" className="absolute left-0 top-full z-40 mt-1 w-72 max-w-[85vw] rounded-xl border border-rose-200 bg-white p-3 text-sm text-rose-800 shadow-lg">{label}</div>
      </details>
      <Button type="button" size="xs" variant="secondary" className="h-6 shrink-0" disabled={loading || refreshing} onClick={onRefresh}>{text("Thử lại", "Retry")}</Button>
    </div>
  );
};
