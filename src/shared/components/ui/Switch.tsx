import React, { useId } from "react";
import { cn } from "../../lib/classnames/cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange(checked: boolean): void;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
  className?: string;
  switchClassName?: string;
  id?: string;
  name?: string;
}

/**
 * Canonical binary control for the application.
 *
 * The interactive target remains at least 44 px high while the visual track is
 * 44 × 24 px. The thumb participates in the track's flex layout instead of
 * relying on absolute top/left offsets, which keeps it centered across browser
 * zoom levels and when the switch is placed beside multi-line labels.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  ariaLabel,
  className,
  switchClassName,
  id,
  name,
}) => {
  const generatedId = useId();
  const switchId = id ?? `switch-${generatedId.replace(/:/g, "")}`;
  const labelId = label ? `${switchId}-label` : undefined;

  return (
    <div
      className={cn(
        "inline-flex min-h-11 min-w-0 items-center gap-2.5 align-middle",
        disabled && "opacity-50",
        className,
      )}
      data-ui-control="switch"
    >
      <button
        id={switchId}
        name={name}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-label={label ? undefined : ariaLabel ?? (checked ? "Enabled" : "Disabled")}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-xl outline-none transition",
          "focus-visible:ring-4 focus-visible:ring-indigo-100",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          switchClassName,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative flex h-6 w-11 items-center rounded-full p-0.5 ring-1 ring-inset transition-colors duration-200",
            checked
              ? "bg-indigo-600 ring-indigo-600 shadow-[0_4px_12px_-6px_rgba(79,70,229,0.9)]"
              : "bg-slate-200 ring-slate-300",
          )}
        >
          <span
            className={cn(
              "pointer-events-none block h-5 w-5 shrink-0 rounded-full bg-white shadow-sm",
              "transition-transform duration-200 ease-out",
              checked ? "translate-x-5" : "translate-x-0",
            )}
          />
        </span>
      </button>
      {label && (
        <span className="flex min-h-11 min-w-0 flex-col justify-center py-1">
          <span id={labelId} className="block text-[11px] font-semibold leading-5 text-slate-700">{label}</span>
        </span>
      )}
    </div>
  );
};
