import React from "react";
import { ShieldAlert } from "lucide-react";
import { AuthoritativeQueryNotice, formatApplicationError } from "@/shared/operations";
import { ListStatePanel } from "@/components/crm/list-archetype";
import { Button } from "@/shared/components/ui";
import type { useContactDetailPageController } from "../hooks/useContactDetailPageController";

export function ContactDetailResourceView({ model, children }: { model: ReturnType<typeof useContactDetailPageController>; children: React.ReactNode }) {
  const { controller, navigate, tx, locale, detailQuery, failure } = model;
  const denied = failure?.category === "AUTHORIZATION";
  const notFound = failure?.category === "NOT_FOUND";
  if (!controller?.hasActiveInteraction && detailQuery.connected && detailQuery.loading && detailQuery.data === undefined) {
    return <ListStatePanel kind="loading" title={locale === "vi" ? "Đang tải liên hệ" : "Loading contact"} />;
  }
  if (!controller?.hasActiveInteraction && detailQuery.connected && failure && (denied || notFound || detailQuery.data === undefined)) {
    return <ListStatePanel
      kind="error"
      title={denied
        ? (locale === "vi" ? "Bạn không có quyền xem liên hệ này" : "You do not have access to this contact")
        : notFound
          ? tx("contactDetail.notExistError", "Liên hệ không tồn tại trên hệ thống.")
          : (locale === "vi" ? "Không thể tải liên hệ" : "Contact could not be loaded")}
      description={formatApplicationError(failure, { locale })}
      action={denied || notFound
        ? <Button type="button" variant="secondary" onClick={() => navigate("/contacts")}>{tx("common.back", "Quay lại")}</Button>
        : <Button type="button" variant="secondary" onClick={() => void detailQuery.refresh()}>{locale === "vi" ? "Thử lại" : "Retry"}</Button>}
    />;
  }
  if (!controller || (!controller.hasActiveInteraction && detailQuery.connected && detailQuery.state === "READY" && detailQuery.data === undefined)) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 space-y-4 bg-slate-50 min-w-0">
      <ShieldAlert className="text-rose-500 w-12 h-12" />
      <h2 className="text-lg font-bold text-slate-800">{tx("contactDetail.notExistError", "Liên hệ không tồn tại trên hệ thống.")}</h2>
      <button type="button" onClick={() => navigate("/contacts")} className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 font-sans shadow-sm cursor-pointer">{tx("common.back", "Quay lại")}</button>
    </div>
  );
  return <><AuthoritativeQueryNotice connected={detailQuery.connected} loading={detailQuery.loading} refreshing={detailQuery.refreshing} stale={detailQuery.stale} loadedAt={detailQuery.loadedAt} error={detailQuery.error} onRefresh={() => void detailQuery.refresh()} compact />{children}</>;
}
