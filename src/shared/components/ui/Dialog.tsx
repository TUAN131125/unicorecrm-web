import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { OVERLAY_Z } from "../../../components/overlay/overlayLayers";
import { cn } from "../../lib/classnames/cn";
import { Button, ButtonVariant } from "./Button";
import { OverlayLayerProvider, useOverlayLayer } from "../../../components/overlay/OverlayLayerContext";
import { useI18n } from "../../../i18n";
import { useAccessibleOverlay } from "./useAccessibleOverlay";

export type ModalSize = "sm" | "md" | "lg";
export type ModalVariant = "auto" | "standard" | "form";

export interface ModalProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  ariaLabel?: string;
  closeLabel?: string;
  children: React.ReactNode;
  size?: ModalSize;
  variant?: ModalVariant;
  className?: string;
  bodyClassName?: string;
  scrollBody?: boolean;
  footer?: React.ReactNode;
  footerClassName?: string;
  zIndexClass?: string;
}

function containsNativeForm(node: React.ReactNode): boolean {
  return React.Children.toArray(node).some((child) => {
    if (!React.isValidElement(child)) return false;
    if (child.type === "form") return true;
    const props = child.props as { children?: React.ReactNode };
    return containsNativeForm(props.children);
  });
}

export const Modal: React.FC<ModalProps> = ({
  id,
  isOpen,
  onClose,
  title,
  description,
  ariaLabel,
  closeLabel,
  children,
  size = "sm",
  variant = "auto",
  className,
  bodyClassName,
  scrollBody = true,
  footer,
  footerClassName,
  zIndexClass = "z-[9000]",
}) => {
  const parentLayer = useOverlayLayer();
  const { locale, t } = useI18n();
  const titleId = React.useId();
  const descriptionId = React.useId();
  const resolvedCloseLabel = closeLabel ?? t("common.closeDialog", locale === "vi" ? "Đóng hộp thoại" : "Close dialog");
  const resolvedAriaLabel = ariaLabel ?? t("common.dialog", locale === "vi" ? "Hộp thoại" : "Dialog");
  const { rootRef, surfaceRef } = useAccessibleOverlay({ isOpen, onClose });
  const explicitZIndex = Number(zIndexClass.match(/z-\[(\d+)\]/)?.[1]);
  const modalZIndex = zIndexClass !== "z-[9000]" && Number.isFinite(explicitZIndex)
    ? explicitZIndex
    : parentLayer.scope === "modal"
      ? parentLayer.baseZIndex + 500
      : 9000;
  const sizeClasses: Record<ModalSize, string> = {
    // Form sizing contract derived from the approved redesign reference.
    // Small: short actions and compact forms. Medium: normal create/edit forms.
    // Large: dense multi-section forms and two-pane builders/pickers.
    sm: "max-w-[520px]",
    md: "max-w-[840px]",
    lg: "max-w-[1200px]",
  };

  const resolvedVariant: Exclude<ModalVariant, "auto"> =
    variant === "auto"
      ? (footer || containsNativeForm(children))
        ? "form"
        : "standard"
      : variant;
  const isFormSurface = resolvedVariant === "form";
  const motionDisabled =
    (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) ||
    (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  const DialogSurface = (motionDisabled ? "div" : motion.div) as React.ElementType;
  const dialogMotionProps = motionDisabled
    ? {}
    : {
        initial: { scale: 0.985, opacity: 0, y: 14 },
        animate: { scale: 1, opacity: 1, y: 0 },
        exit: { scale: 0.99, opacity: 0, y: 8 },
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
      };

  useBodyScrollLock(isOpen);

  const modalElement = (
    <OverlayLayerProvider value={{ scope: "modal", baseZIndex: modalZIndex }}>
    <AnimatePresence initial={false}>
      {isOpen && (
        <div
          ref={rootRef}
          className={cn(
            "fixed inset-0 flex items-center justify-center overflow-hidden bg-slate-950/40 p-2 backdrop-blur-[3px] sm:p-5",
            zIndexClass,
          )}
          id={id}
          style={{ zIndex: modalZIndex }}
        >
          <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />

          <DialogSurface
            {...dialogMotionProps}
            ref={surfaceRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            aria-label={title ? undefined : resolvedAriaLabel}
            tabIndex={-1}
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            className={cn(
              "relative z-10 flex w-full max-h-[calc(100vh-1rem)] flex-col overflow-hidden border bg-white text-left sm:max-h-[calc(100vh-2.5rem)]",
              "rounded-[22px] border-slate-300/80 shadow-[0_28px_80px_-30px_rgba(15,23,42,0.55)]",
              isFormSurface && "crm-form-surface",
              sizeClasses[size],
              className,
            )}
            data-dialog-size={size}
            data-dialog-variant={resolvedVariant}
          >
            {title && (
              <div
                className={cn(
                  "flex shrink-0 items-center justify-between gap-4 border-b",
                  isFormSurface
                    ? "border-slate-200 bg-white px-6 py-5 sm:px-8 sm:py-6"
                    : "border-slate-100 bg-white px-5 py-4",
                )}
              >
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className={cn(
                      "min-w-0 text-slate-950",
                      isFormSurface
                        ? "text-lg font-bold leading-7 tracking-tight sm:text-xl"
                        : "text-base font-semibold tracking-tight",
                    )}
                  >
                    {title}
                  </h2>
                  {description ? (
                    <p id={descriptionId} className="mt-1 text-sm font-medium leading-5 text-slate-500">
                      {description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={resolvedCloseLabel}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            <div
              className={cn(
                scrollBody
                  ? "flex-1 min-h-0 overflow-y-auto crm-scroll-y"
                  : "flex flex-1 min-h-0 flex-col overflow-hidden",
                isFormSurface
                  ? "bg-slate-50/70 p-5 text-sm text-slate-700 sm:p-8"
                  : "bg-white p-5 text-sm text-slate-700 sm:p-6",
                bodyClassName,
              )}
            >
              {children}
            </div>

            {footer && (
              <div
                className={cn(
                  "crm-form-action-bar flex shrink-0 flex-col-reverse items-stretch justify-end gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 shadow-[0_-12px_24px_-24px_rgba(15,23,42,0.35)] backdrop-blur sm:flex-row sm:items-center sm:px-8",
                  footerClassName,
                )}
              >
                {footer}
              </div>
            )}
          </DialogSurface>
        </div>
      )}
    </AnimatePresence>
    </OverlayLayerProvider>
  );

  return typeof document !== "undefined" ? createPortal(modalElement, document.body) : null;
};

export interface ConfirmDialogProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string | React.ReactNode;
  description?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  variant?: "danger" | "warning" | "info";
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  id,
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "info",
  variant,
  children,
}) => {
  const resolvedType = variant || type;
  const confirmBtnVariant: ButtonVariant = resolvedType === "danger" ? "danger" : resolvedType === "warning" ? "warning" : "primary";

  return (
    <Modal
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      variant="form"
      title={title}
      footer={(
        <>
          <Button variant="secondary" size="md" className="min-w-28" onClick={onClose} autoFocus>{cancelText}</Button>
          <Button variant={confirmBtnVariant} size="md" className="min-w-28" onClick={onConfirm}>{confirmText}</Button>
        </>
      )}
    >
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-sm leading-6 text-slate-700 shadow-sm">
        {message ?? description ?? children}
      </div>
    </Modal>
  );
};

export type RowActionPortalProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
};

export const RowActionPortal: React.FC<RowActionPortalProps> = ({
  open,
  anchorEl,
  onClose,
  children,
  width
}) => {
  const overlayLayer = useOverlayLayer();
  const [coords, setCoords] = React.useState({ top: 0, left: 0, width: width ?? 240, openAbove: false });

  const updatePosition = React.useCallback(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = width ?? 240;
    const viewportPadding = 12;

    let left = rect.right - menuWidth;
    if (left + menuWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - menuWidth - viewportPadding;
    }
    if (left < viewportPadding) {
      left = viewportPadding;
    }

    const estimatedHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    const top = openAbove ? rect.top - 8 : rect.bottom + 8;

    setCoords({
      top,
      left,
      width: menuWidth,
      openAbove
    });
  }, [anchorEl, width]);

  React.useEffect(() => {
    if (!open || !anchorEl) return;

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, anchorEl, updatePosition, onClose]);

  if (!open || !anchorEl) return null;

  return createPortal(
    <>
      <div 
        className="fixed inset-0 bg-transparent"
        style={{ zIndex: overlayLayer.baseZIndex + 10 }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }} 
      />
      <div
        className={`fixed overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_-18px_rgba(15,23,42,0.38)] ring-1 ring-slate-900/5 ${OVERLAY_Z.dropdown}`}
        style={{
          top: coords.openAbove ? "auto" : `${coords.top}px`,
          bottom: coords.openAbove ? `${window.innerHeight - coords.top}px` : "auto",
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          zIndex: overlayLayer.baseZIndex + 20,
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
};
