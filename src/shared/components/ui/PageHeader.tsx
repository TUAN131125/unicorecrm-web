import React from "react";
import { cn } from "../../lib/classnames/cn";

export interface PageHeaderProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  extra?: React.ReactNode; // legacy alias fallback
  icon?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  id?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  actions,
  extra,
  icon,
  className,
  titleClassName,
  id,
}) => {
  const finalActions = actions || extra;

  return (
    <div
      id={id}
      className={cn(
        "mb-6 flex flex-col justify-between gap-4 text-left sm:flex-row sm:items-center",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1
            className={cn(
              "break-words text-2xl font-bold leading-tight tracking-tight text-slate-950",
              titleClassName
            )}
          >
            {title}
          </h1>
        </div>
      </div>
      {finalActions && (
        <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
          {finalActions}
        </div>
      )}
    </div>
  );
};

export interface SectionHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  actions,
  className,
}) => {
  return (
    <div className={cn("mb-4 flex flex-col gap-3 border-b border-slate-200 pb-3 text-left sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-2 text-violet-700">
        <span className="shrink-0">{icon}</span>
        <h3 className="min-w-0 break-words text-sm font-semibold tracking-tight text-slate-900">
          {title}
        </h3>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
};
