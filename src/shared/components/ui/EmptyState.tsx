import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/classnames/cn";

export interface EmptyStateProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, icon, action, className, compact = false }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center",
      compact ? "py-8" : "py-12",
      className,
    )}
  >
    {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">{icon}</div>}
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);

export const LoadingState: React.FC<{ message?: string; className?: string }> = ({ message = "Loading data...", className }) => (
  <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)} role="status" aria-live="polite">
    <Loader2 className="animate-spin text-violet-600" size={24} aria-hidden="true" />
    <span className="text-sm font-medium text-slate-600">{message}</span>
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn("block animate-pulse rounded-lg bg-slate-200", className)} aria-hidden="true" />
);
