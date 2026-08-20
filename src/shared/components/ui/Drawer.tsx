import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { OVERLAY_Z } from "../../../components/overlay/overlayLayers";
import { cn } from "../../lib/classnames/cn";
import { IconButton } from "./Button";
import { useI18n } from "../../../i18n";
import { useAccessibleOverlay } from "./useAccessibleOverlay";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  ariaLabel?: string;
  closeLabel?: string;
  children: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
  position?: "left" | "right";
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  ariaLabel,
  closeLabel,
  children,
  size = "md",
  className,
  position = "right",
}) => {
  const { locale, t } = useI18n();
  const titleId = React.useId();
  const subtitleId = React.useId();
  const resolvedCloseLabel = closeLabel ?? t("common.closeDrawer", locale === "vi" ? "Đóng bảng điều khiển" : "Close drawer");
  const resolvedAriaLabel = ariaLabel ?? t("common.drawer", locale === "vi" ? "Bảng điều khiển" : "Drawer");
  const { rootRef, surfaceRef } = useAccessibleOverlay({ isOpen, onClose });
  const motionDisabled =
    (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) ||
    (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  const DrawerSurface = (motionDisabled ? "div" : motion.div) as React.ElementType;
  const drawerMotionProps = motionDisabled
    ? {}
    : {
        initial: { x: position === "left" ? "-100%" : "100%", opacity: 0.96 },
        animate: { x: 0, opacity: 1 },
        exit: { x: position === "left" ? "-100%" : "100%", opacity: 0.96 },
        transition: { type: "spring", damping: 30, stiffness: 300, mass: 0.8 },
      };
  const sizeClasses = {
    md: "max-w-xl",
    lg: "max-w-2xl",
  };

  useBodyScrollLock(isOpen);

  const isLeft = position === "left";

  const drawerElement = (
    <AnimatePresence initial={false}>
      {isOpen && (
        <div
          ref={rootRef}
          className={cn(
            "fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex text-xs",
            OVERLAY_Z.drawerBackdrop,
            isLeft ? "justify-start" : "justify-end"
          )}
        >
          {/* Backdrop Close Clicker */}
          <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
          
          <DrawerSurface
            {...drawerMotionProps}
            ref={surfaceRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={subtitle ? subtitleId : undefined}
            aria-label={title ? undefined : resolvedAriaLabel}
            tabIndex={-1}
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            className={cn(
              "relative flex h-full w-full flex-col overflow-hidden bg-white font-sans text-left shadow-2xl",
              OVERLAY_Z.drawer,
              isLeft ? "border-r rounded-r-2xl" : "border-l rounded-l-2xl",
              "border-slate-200",
              sizeClasses[size],
              className
            )}
          >
            {/* Drawer Header */}
            {title && (
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                <div className="min-w-0">
                  <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
                  {subtitle ? <p id={subtitleId} className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p> : null}
                </div>
                <IconButton variant="ghost" size="sm" onClick={onClose} aria-label={resolvedCloseLabel}>
                  <X size={18} aria-hidden="true" />
                </IconButton>
              </div>
            )}
            
            {/* Drawer Content */}
            <div className="crm-scroll-y flex-1 overflow-y-auto p-6 text-sm text-slate-700">
              {children}
            </div>
          </DrawerSurface>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(drawerElement, document.body) : null;
};
