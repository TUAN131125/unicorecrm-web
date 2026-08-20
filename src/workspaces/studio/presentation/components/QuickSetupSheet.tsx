import React from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { useAccessibleOverlay } from "@/shared/components/ui/useAccessibleOverlay";
import { cn } from "@/shared/lib/classnames/cn";

interface QuickSetupSheetProps {
  title: string;
  eyebrow: string;
  stepper: React.ReactNode;
  progressValue: number;
  progressLabel: string;
  closeLabel: string;
  onClose(): void;
  children: React.ReactNode;
  illustration: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}

export function QuickSetupSheet({
  title,
  eyebrow,
  stepper,
  progressValue,
  progressLabel,
  closeLabel,
  onClose,
  children,
  illustration,
  footer,
  className,
}: QuickSetupSheetProps) {
  const reduceMotion = useReducedMotion();
  const titleId = React.useId();
  const progressId = React.useId();
  const { rootRef, surfaceRef } = useAccessibleOverlay({ isOpen: true, onClose });

  useBodyScrollLock(true);

  const sheet = (
    <div ref={rootRef} className="fixed inset-0 z-[8200] overflow-hidden" data-quick-setup-sheet-root="true">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/28 backdrop-blur-[3px]"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.16 }}
        onMouseDown={onClose}
      />

      <motion.div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={progressId}
        tabIndex={-1}
        initial={reduceMotion ? false : { y: "100%", opacity: 0.98 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 34, mass: 0.95 }}
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex h-[100dvh] w-full max-w-[1480px] flex-col overflow-hidden rounded-none border border-sky-100 bg-[#f7fbff] text-left shadow-[0_-35px_120px_-45px_rgba(15,23,42,0.65)]",
          "[background-image:radial-gradient(circle_at_80%_20%,rgba(103,232,249,0.30),transparent_34%),radial-gradient(circle_at_12%_86%,rgba(191,219,254,0.38),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.92)_52%,rgba(236,253,245,0.88))]",
          "sm:h-[min(92dvh,940px)] sm:rounded-t-[34px]",
          className,
        )}
        data-quick-setup-sheet="true"
      >
        <div className="h-1.5 w-full bg-sky-100" aria-hidden="true">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-teal-400"
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${Math.max(0, Math.min(progressValue, 100))}%` }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }}
          />
        </div>

        <header className="relative z-20 shrink-0 px-5 pt-5 sm:px-8 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">{eyebrow}</p>
              <h1 id={titleId} tabIndex={-1} data-overlay-initial-focus className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">{title}</h1>
              <p id={progressId} className="mt-1 text-sm text-slate-500">{progressLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-slate-500 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
            >
              <X size={19} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-5 min-w-0">{stepper}</div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 hidden lg:block"
            aria-hidden="true"
            data-quick-setup-background-illustration="true"
          >
            <div className="absolute inset-y-0 right-0 w-[440px] bg-gradient-to-l from-white/20 via-cyan-50/20 to-transparent" />
            <div className="absolute right-7 top-1/2 w-[360px] -translate-y-1/2 opacity-95 xl:right-12">
              {illustration}
            </div>
          </div>

          <div className="crm-scroll-y absolute inset-0 overflow-y-auto overscroll-contain">
            <div className="relative z-10 min-h-full px-5 pb-8 pt-6 sm:px-8 sm:pt-8 lg:pr-[420px] xl:pr-[450px]">
              {children}
            </div>
          </div>
        </div>

        <footer className="relative z-20 shrink-0 border-t border-white/80 bg-white/[0.72] px-5 py-4 backdrop-blur sm:px-8 sm:py-5" data-quick-setup-footer="true">
          {footer}
        </footer>
      </motion.div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(sheet, document.body) : null;
}
