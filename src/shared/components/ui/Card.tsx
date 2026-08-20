import React from "react";
import { cn } from "../../lib/classnames/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  children,
  padding = "md",
  interactive,
  onClick,
  onKeyDown,
  tabIndex,
  role,
  ...props
}) => {
  const isInteractive = interactive ?? Boolean(onClick);
  const paddingClasses = {
    none: "p-0",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && isInteractive && onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick(event as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      tabIndex={isInteractive ? (tabIndex ?? 0) : tabIndex}
      role={isInteractive ? (role ?? "button") : role}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        paddingClasses[padding],
        isInteractive && "cursor-pointer transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25 focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface StatCardProps {
  id?: string;
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  subtitle?: string;
  trend?: string;
  trendType?: string;
  theme?: string;
  onClick?: () => void;
  interactiveLabel?: string;
  guidanceId?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  id,
  title,
  value,
  icon,
  color = "indigo",
  subtitle,
  trend,
  trendType,
  theme,
  onClick,
  interactiveLabel,
  guidanceId,
}) => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    indigo: { bg: "bg-violet-50", text: "text-violet-700" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700" },
    amber: { bg: "bg-amber-50", text: "text-amber-700" },
    rose: { bg: "bg-rose-50", text: "text-rose-700" },
    sky: { bg: "bg-sky-50", text: "text-sky-700" },
  };
  const scheme = colorMap[theme || color] || colorMap.indigo;

  return (
    <Card
      id={id}
      className="flex min-w-0 items-start gap-4"
      padding="md"
      interactive={Boolean(onClick)}
      onClick={onClick}
      aria-label={interactiveLabel}
      data-guidance-id={guidanceId}
    >
      {icon && <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", scheme.bg, scheme.text)}>{icon}</div>}
      <div className="min-w-0 flex-1 text-left">
        <span className="block text-xs font-medium leading-5 text-slate-500">{title}</span>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <strong className="text-2xl font-bold tracking-tight text-slate-950">{value}</strong>
          {trend && <span className={cn("text-xs font-semibold", trendType === "down" ? "text-rose-600" : "text-emerald-600")}>{trend}</span>}
        </div>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
      </div>
    </Card>
  );
};
