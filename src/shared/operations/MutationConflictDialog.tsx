import React from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/shared/components/ui/Button";
import { Modal } from "@/shared/components/ui/Dialog";
import type { MutationFailure } from "./mutationState";

export interface MutationConflictDialogProps {
  failure?: MutationFailure;
  isOpen: boolean;
  recovering?: boolean;
  onReloadLatest?: () => unknown | Promise<unknown>;
  onClose: () => void;
}

export function MutationConflictDialog({
  failure,
  isOpen,
  recovering = false,
  onReloadLatest,
  onClose,
}: MutationConflictDialogProps) {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const conflict = failure?.conflict;
  const changedFields = conflict?.changedFields ?? [];

  return (
    <Modal
      id="mutation-conflict-dialog"
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      variant="form"
      title={text("Bản ghi đã được cập nhật", "Record updated elsewhere")}
      description={text(
        "Dữ liệu trên máy chủ mới hơn phiên bản đang mở.",
        "The server has a newer version than the one currently open.",
      )}
      footer={(
        <>
          <Button variant="secondary" icon={<X size={15} />} onClick={onClose} disabled={recovering}>
            {text("Đóng", "Close")}
          </Button>
          {onReloadLatest ? (
            <Button actionIntent="sync" icon={<RefreshCw size={15} />} loading={recovering} onClick={() => void onReloadLatest()}>
              {text("Tải phiên bản mới nhất", "Load latest version")}
            </Button>
          ) : null}
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold">{failure?.message ?? text(
              "Thay đổi chưa được lưu để tránh ghi đè dữ liệu mới hơn.",
              "Your changes were not saved to avoid overwriting newer data.",
            )}</p>
            <p className="mt-1 leading-6 text-amber-800">{text(
              "Hãy tải lại bản ghi, xem các thay đổi mới rồi thực hiện lại thao tác nếu vẫn cần thiết.",
              "Reload the record, review the latest changes, and run the action again only if it is still needed.",
            )}</p>
          </div>
        </div>

        {(conflict?.expectedVersion !== undefined || conflict?.actualVersion !== undefined) ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <VersionCard label={text("Phiên bản đang mở", "Open version")} value={conflict?.expectedVersion} />
            <VersionCard label={text("Phiên bản máy chủ", "Server version")} value={conflict?.actualVersion} />
          </div>
        ) : null}

        {changedFields.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">{text("Trường đã thay đổi", "Changed fields")}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {changedFields.map((field) => (
                <span key={field} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {field}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {(conflict?.serverUpdatedAt || conflict?.serverUpdatedBy) ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            {conflict.serverUpdatedBy ? <div>{text("Người cập nhật", "Updated by")}: <strong>{conflict.serverUpdatedBy}</strong></div> : null}
            {conflict.serverUpdatedAt ? <div>{text("Thời điểm", "Updated at")}: <strong>{formatDateTime(conflict.serverUpdatedAt, locale)}</strong></div> : null}
          </div>
        ) : null}

        {(failure?.correlationId || failure?.requestId) ? (
          <div className="text-[11px] text-slate-500">
            {failure.correlationId ? <span>Correlation: {failure.correlationId}</span> : null}
            {failure.correlationId && failure.requestId ? <span> · </span> : null}
            {failure.requestId ? <span>Request: {failure.requestId}</span> : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function VersionCard({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-2 break-all font-mono text-sm font-semibold text-slate-800">{value ?? "—"}</div>
    </div>
  );
}

function formatDateTime(value: string, locale: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
}
