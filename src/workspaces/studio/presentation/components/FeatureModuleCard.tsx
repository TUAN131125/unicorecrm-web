import {
  LockKeyhole,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/shared/components/ui/Switch";
import { cn } from "@/shared/lib/classnames/cn";

export function FeatureModuleCard({
  module,
  icon: Icon,
  label,
  description,
  scope,
  enabled,
  required,
  canConfigure,
  requiredLabel,
  toggleLabel,
  onChange,
}: {
  module: string;
  icon: LucideIcon;
  label: string;
  description: string;
  scope: string;
  enabled: boolean;
  required: boolean;
  canConfigure: boolean;
  requiredLabel: string;
  toggleLabel: string;
  onChange(checked: boolean): void;
}) {
  const disabled = !canConfigure || required;
  const headingId = `feature-module-${module}`;

  return (
    <article
      className={cn(
        "flex min-h-full min-w-0 flex-col rounded-2xl border p-4 transition-[border-color,box-shadow,background-color] duration-200 sm:p-5",
        enabled
          ? "border-violet-200 bg-white shadow-[0_16px_38px_-34px_rgba(79,70,229,0.9)] hover:border-violet-300 hover:shadow-[0_20px_44px_-32px_rgba(79,70,229,0.72)]"
          : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white",
      )}
      data-feature-module-card={module}
      data-feature-module-enabled={enabled ? "true" : "false"}
      aria-labelledby={headingId}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset", enabled ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-white text-slate-500 ring-slate-200")}>
          <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-sm font-semibold leading-5 text-slate-950 [overflow-wrap:anywhere]">{label}</h3>
          <p className="mt-1.5 text-xs font-normal leading-5 text-slate-500 [overflow-wrap:anywhere]">{description}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onChange}
          disabled={disabled}
          ariaLabel={`${toggleLabel}: ${label}`}
          className="shrink-0"
        />
      </div>

      <div className="mt-auto flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <span className="min-w-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium leading-4 text-slate-600 [overflow-wrap:anywhere]">{scope}</span>
        {required ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium leading-4 text-amber-700 ring-1 ring-inset ring-amber-100 [overflow-wrap:anywhere]">
            <LockKeyhole size={11} aria-hidden="true" />
            {requiredLabel}
          </span>
        ) : null}
      </div>
    </article>
  );
}
