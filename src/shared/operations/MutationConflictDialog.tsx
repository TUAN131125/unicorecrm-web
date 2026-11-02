import React from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/shared/components/ui/Button";
import { Modal } from "@/shared/components/ui/Dialog";
import type { MutationFailure } from "./mutationState";
import { formatApplicationError } from "./errorPresentation";

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
  const busy = React.useRef(false);
  const mounted = React.useRef(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const opening = React.useRef({ failure, onReloadLatest });
  const wasOpen = React.useRef(false);
  if (isOpen && !wasOpen.current) opening.current = { failure, onReloadLatest };
  wasOpen.current = isOpen;
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => { setError(""); }, [isOpen]);
  const close = () => { if (!busy.current && !recovering) onClose(); };
  const reload = async () => {
    if (busy.current || recovering || !isOpen || !opening.current.onReloadLatest) return;
    const target = opening.current;
    busy.current = true; setPending(true); setError("");
    try { await target.onReloadLatest?.(); }
    catch (caught) { if (mounted.current && wasOpen.current && opening.current === target) setError(formatApplicationError(caught, { locale })); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  };
  failure = opening.current.failure;
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;

  return (
    <Modal
      id="mutation-conflict-dialog"
      isOpen={isOpen}
      onClose={close}
      size="sm"
      variant="form"
      title={text("Bản ghi đã được cập nhật", "Record updated elsewhere")}
      description={text(
        "Bản ghi đã thay đổi kể từ khi bạn mở.",
        "This record has changed since you opened it.",
      )}
      footer={(
        <>
          <Button variant="secondary" icon={<X size={15} />} onClick={close} disabled={recovering || pending}>
            {text("Đóng", "Close")}
          </Button>
          {opening.current.onReloadLatest ? (
            <Button actionIntent="sync" icon={<RefreshCw size={15} />} loading={recovering || pending} onClick={() => { void reload(); }}>
              {text("Tải phiên bản mới nhất", "Load latest version")}
            </Button>
          ) : null}
        </>
      )}
    >
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
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


      </div>
    </Modal>
  );
}

