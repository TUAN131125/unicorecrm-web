import React from "react";
import { ExternalLink, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/shared/components/ui";
import { cn } from "@/shared/lib/classnames/cn";

export interface RelationshipWorkspaceItem {
  id: string;
  label: string;
  count?: number;
}

export const RelationshipModuleActions: React.FC<{
  secondaryLabel?: string;
  primaryLabel?: string;
  onSecondary?(): void;
  onPrimary?(): void;
}> = ({ secondaryLabel, primaryLabel, onSecondary, onPrimary }) => (
  <div className="flex flex-wrap items-center gap-2">
    {secondaryLabel && onSecondary ? (
      <Button size="sm" variant="secondary" icon={<ExternalLink size={13} />} onClick={onSecondary}>
        {secondaryLabel}
      </Button>
    ) : null}
    {primaryLabel && onPrimary ? (
      <Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={onPrimary}>
        {primaryLabel}
      </Button>
    ) : null}
  </div>
);

export const RelationshipWorkspaceHeader: React.FC<{
  title: string;
  actions?: React.ReactNode;
}> = ({ title, actions }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export const RelationshipWorkspace: React.FC<{
  workspaceKey: string;
  activeId: string;
  items: RelationshipWorkspaceItem[];
  onChange(id: string): void;
  children: React.ReactNode;
}> = ({ workspaceKey, activeId, items, onChange, children }) => {
  const reduceMotion = useReducedMotion();
  return (
    <div className="space-y-5">
      <div className="crm-scroll-x flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/80 p-1 shadow-inner shadow-slate-100/60">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "relative isolate flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/40",
                active ? "text-indigo-700" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`${workspaceKey}-relationship-subtab`}
                  className="absolute inset-0 -z-10 rounded-lg border border-slate-200 bg-white shadow-sm"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40, mass: 0.65 }}
                />
              ) : null}
              <span>{item.label}</span>
              {(item.count ?? 0) > 0 ? (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none", active ? "bg-indigo-100 text-indigo-700" : "bg-slate-200/70 text-slate-600")}>
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
};
