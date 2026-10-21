import { useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/shared/lib/classnames/cn";

export type RelationshipPanelMode = "WORK" | "HISTORY";

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
  mode?: { value: RelationshipPanelMode; onChange(value: RelationshipPanelMode): void; workLabel: string; historyLabel: string; label: string };
  history?: ReactNode;
}

export function RelationshipWorkPanelShell({ isVisible, motionKey, panelId, ariaLabel,
  header, controls, children, footer, bodyClassName, panelClassName, mode, history }: RelationshipWorkPanelShellProps) {
  const reduceMotion = useReducedMotion();
  const tabId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const modes = ["WORK", "HISTORY"] as const;
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
            {mode && <div role="tablist" aria-label={mode.label} className="grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {modes.map((value, index) => <button key={value} ref={node => { tabRefs.current[index] = node; }} type="button"
                role="tab" id={`${tabId}-${value}-tab`} aria-controls={`${tabId}-${value}-body`} aria-selected={mode.value === value}
                tabIndex={mode.value === value ? 0 : -1}
                className={cn("min-h-9 rounded-md px-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600", mode.value === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500")}
                onClick={() => mode.onChange(value)} onKeyDown={event => {
                  const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : event.key === "ArrowRight" || event.key === "ArrowLeft" ? 1 - index : undefined;
                  if (next === undefined) return;
                  event.preventDefault(); const target = modes[next];
                  if (target) mode.onChange(target); tabRefs.current[next]?.focus();
                }}>{value === "WORK" ? mode.workLabel : mode.historyLabel}</button>)}
            </div>}
            {controls && <div className="shrink-0 space-y-4">{controls}</div>}
            <div className={cn("min-h-0 flex-1", bodyClassName)}>
              {mode ? <>
                <div role="tabpanel" className="space-y-3" id={`${tabId}-WORK-body`} aria-labelledby={`${tabId}-WORK-tab`} hidden={mode.value !== "WORK"}>{children}</div>
                <div role="tabpanel" id={`${tabId}-HISTORY-body`} aria-labelledby={`${tabId}-HISTORY-tab`} hidden={mode.value !== "HISTORY"}>{history}</div>
              </> : children}
            </div>
            {footer && <div className="shrink-0">{footer}</div>}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
