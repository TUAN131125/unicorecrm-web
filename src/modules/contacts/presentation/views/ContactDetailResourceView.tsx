import React from "react";
import { createPortal } from "react-dom";
import { ShieldAlert } from "lucide-react";
import { AuthoritativeQueryNotice, formatApplicationError } from "@/shared/operations";
import { ListStatePanel } from "@/components/crm/list-archetype";
import { Button, OverlayPortalHostContext } from "@/shared/components/ui";
import type { useContactDetailPageController } from "../hooks/useContactDetailPageController";
import type { OverlayDraftRecovery } from "@/shared/components/ui/OverlayPortalHost";

export function ContactDetailResourceView({ model, children }: { model: ReturnType<typeof useContactDetailPageController>; children: React.ReactNode }) {
  const host = React.useRef<HTMLDivElement>(null);
  const drafts = React.useRef(new Set<OverlayDraftRecovery>());
  const registerDraft = React.useCallback((draft: OverlayDraftRecovery) => { drafts.current.add(draft); return () => { drafts.current.delete(draft); }; }, []);
  const [discardBlocked, setDiscardBlocked] = React.useState(false);
  const [container] = React.useState(() => typeof document === "undefined" ? undefined : document.createElement("div"));
  const [overlayContainer] = React.useState(() => typeof document === "undefined" ? undefined : document.createElement("div"));
  const { controller, detailQuery, locale } = model;
  const denied = detailQuery.error?.category === "AUTHORIZATION" || detailQuery.error?.category === "NOT_FOUND";
  const suspended = denied || controller?.readAuthorityCurrent === false || (detailQuery.connected && (detailQuery.loading || !controller));
  React.useLayoutEffect(() => {
    if (!container) return;
    container.inert = suspended;
    if (suspended) container.remove();
    else host.current?.append(container);
    return () => container.remove();
  }, [container, suspended]);
  React.useLayoutEffect(() => {
    if (!overlayContainer) return;
    overlayContainer.inert = suspended;
    if (suspended) overlayContainer.remove();
    else document.body.append(overlayContainer);
    return () => overlayContainer.remove();
  }, [overlayContainer, suspended]);
  const portalHost = React.useMemo(() => overlayContainer ? { container: overlayContainer, suspended, registerDraft } : undefined, [overlayContainer, suspended, registerDraft]);
  const discardDraft = () => {
    const entries = [...drafts.current];
    if (entries.some(entry => !entry.canDiscard())) { setDiscardBlocked(true); return; }
    setDiscardBlocked(false);
    entries.forEach(entry => entry.discard());
    controller?.discardSuspendedInteraction();
    void detailQuery.refresh();
  };
  const retained = controller?.hasActiveInteraction || !suspended;
  return <>
    {controller?.readAuthorityCurrent === false ? <ListStatePanel kind="error" title={locale === "vi" ? "Quyền truy cập đã thay đổi" : "Access changed"} description={locale === "vi" ? "Bản nháp được giữ lại và tạm ngừng. Bỏ bản nháp trước khi mở lại hồ sơ với quyền hiện tại." : "Your draft is preserved and suspended. Discard the draft before reopening with current access."} action={<Button type="button" variant="secondary" onClick={discardDraft}>{locale === "vi" ? "Bỏ bản nháp và tải lại" : "Discard draft and reload"}</Button>} /> : <ContactDetailReadNotice model={model} />}
    <div ref={host} />
    {discardBlocked && <p role="status">{locale === "vi" ? "Yêu cầu đang xử lý. Chờ hoàn tất trước khi bỏ bản nháp." : "A request is pending. Wait for it to finish before discarding the draft."}</p>}
    {container ? createPortal(<OverlayPortalHostContext.Provider value={portalHost}>{retained ? children : null}</OverlayPortalHostContext.Provider>, container) : null}
  </>;
}

function ContactDetailReadNotice({ model }: { model: ReturnType<typeof useContactDetailPageController> }) {
  const { controller, navigate, tx, locale, detailQuery, failure } = model;
  const denied = failure?.category === "AUTHORIZATION";
  const notFound = failure?.category === "NOT_FOUND";
  if (!controller?.hasActiveInteraction && detailQuery.connected && detailQuery.loading && detailQuery.data === undefined) {
    return <ListStatePanel kind="loading" title={locale === "vi" ? "Đang tải liên hệ" : "Loading contact"} />;
  }
  if (detailQuery.connected && failure && (denied || notFound || detailQuery.data === undefined)) {
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
  return <AuthoritativeQueryNotice connected={detailQuery.connected} loading={detailQuery.loading} refreshing={detailQuery.refreshing} stale={detailQuery.stale} loadedAt={detailQuery.loadedAt} error={detailQuery.error} onRefresh={() => void detailQuery.refresh()} compact />;
}
