import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/shared/lib/classnames/cn";

interface RelationshipWorkPanelShellProps {
  isVisible: boolean;
  motionKey: string;
  panelId: string;
  ariaLabel: string;
  header: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  panelClassName?: string;
}

export function RelationshipWorkPanelShell({ isVisible, motionKey, panelId, ariaLabel,
  header, controls, children, footer, bodyClassName, panelClassName }: RelationshipWorkPanelShellProps) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {isVisible ? (
        <motion.aside
          key={motionKey}
          layout="position"
          aria-label={ariaLabel}
          data-i18n-skip="true"
          data-relationship-work-panel="v1"
          initial={reduceMotion ? false : { opacity: 0, x: 30, scale: 0.985, filter: "blur(3px)" }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 22, scale: 0.99, filter: "blur(2px)" }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 34, mass: 0.78 }}
          className="relative z-10 w-full min-w-0 xl:sticky xl:top-4 xl:h-[calc(100vh-140px)] xl:w-[350px] xl:shrink-0"
        >
          <div id={panelId} className={cn("flex h-full min-h-0 w-full flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm select-none", panelClassName)}>
            <div className="shrink-0">{header}</div>
            {controls && <div className="shrink-0 space-y-4">{controls}</div>}
            <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
            {footer && <div className="shrink-0">{footer}</div>}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
