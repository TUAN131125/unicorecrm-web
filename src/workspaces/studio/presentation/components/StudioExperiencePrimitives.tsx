import React from "react";
import { Check, Circle, Copy, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/shared/lib/classnames/cn";

export type StudioExperienceTone = "neutral" | "info" | "success" | "warning" | "danger" | "violet";

const toneClasses: Record<StudioExperienceTone, { border: string; background: string; text: string; icon: string }> = {
  neutral: { border: "border-slate-200", background: "bg-white", text: "text-slate-700", icon: "bg-slate-100 text-slate-600" },
  info: { border: "border-sky-200", background: "bg-sky-50/70", text: "text-sky-900", icon: "bg-sky-100 text-sky-700" },
  success: { border: "border-emerald-200", background: "bg-emerald-50/70", text: "text-emerald-900", icon: "bg-emerald-100 text-emerald-700" },
  warning: { border: "border-amber-200", background: "bg-amber-50/70", text: "text-amber-900", icon: "bg-amber-100 text-amber-700" },
  danger: { border: "border-rose-200", background: "bg-rose-50/70", text: "text-rose-900", icon: "bg-rose-100 text-rose-700" },
  violet: { border: "border-violet-200", background: "bg-violet-50/70", text: "text-violet-900", icon: "bg-violet-100 text-violet-700" },
};

export function StudioMetricsGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function StudioMetricCard({
  label,
  value,
  description,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  tone?: StudioExperienceTone;
}) {
  const classes = toneClasses[tone];
  return (
    <article className={cn("rounded-xl border p-4", classes.border, classes.background)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-normal uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className={cn("mt-2 text-2xl font-medium tracking-[-0.025em]", classes.text)}>{value}</p>
        </div>
        {icon ? <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", classes.icon)}>{icon}</span> : null}
      </div>
      {description ? <p className="mt-2 text-xs font-normal leading-5 text-slate-500">{description}</p> : null}
    </article>
  );
}

export function StudioSegmentedControl<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: ReadonlyArray<{ id: T; label: string; count?: number }>;
  value: T;
  onChange(value: T): void;
  ariaLabel: string;
}) {
  return (
    <div className="flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "inline-flex min-h-9 min-w-0 items-center gap-2 rounded-lg px-3 text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20",
            value === item.id ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
          )}
        >
          <span>{item.label}</span>
          {typeof item.count === "number" ? <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", value === item.id ? "bg-violet-100" : "bg-slate-100")}>{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function StudioCallout({
  title,
  description,
  tone = "info",
  icon,
  children,
}: {
  title: string;
  description?: string;
  tone?: StudioExperienceTone;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const classes = toneClasses[tone];
  return (
    <aside className={cn("rounded-xl border p-4", classes.border, classes.background)}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", classes.icon)}>
          {icon ?? (tone === "warning" || tone === "danger" ? <TriangleAlert size={16} /> : <Info size={16} />)}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", classes.text)}>{title}</p>
          {description ? <p className="mt-1 text-xs font-normal leading-5 text-slate-600">{description}</p> : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </aside>
  );
}

export function StudioCapabilityChips({ items }: { items: ReadonlyArray<{ label: string; active: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-normal",
            item.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500",
          )}
        >
          {item.active ? <Check size={12} aria-hidden="true" /> : <Circle size={9} aria-hidden="true" />}
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function StudioProgressChecklist({
  items,
}: {
  items: ReadonlyArray<{ label: string; description?: string; state: "complete" | "current" | "blocked" | "pending" }>;
}) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="flex gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
              item.state === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              item.state === "current" && "border-violet-200 bg-violet-50 text-violet-700",
              item.state === "blocked" && "border-amber-200 bg-amber-50 text-amber-700",
              item.state === "pending" && "border-slate-200 bg-white text-slate-400",
            )}
          >
            {item.state === "complete" ? <Check size={13} /> : index + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-normal text-slate-800">{item.label}</span>
            {item.description ? <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500">{item.description}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function StudioCodePreview({
  value,
  label,
  copyLabel,
}: {
  value: string;
  label?: string;
  copyLabel?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_400);
  };
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      {label || copyLabel ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5 text-xs text-slate-400">
          <span>{label}</span>
          {copyLabel ? (
            <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white">
              <Copy size={12} aria-hidden="true" />
              {copied ? "✓" : copyLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      <pre className="max-h-72 overflow-auto p-4 text-xs leading-6 text-slate-200"><code>{value}</code></pre>
    </div>
  );
}
