import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/classnames/cn";

export type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost" | "outline" | "indigo" | "warning" | "info" | "neutral";
export type ButtonActionIntent = "create" | "save" | "confirm" | "complete" | "retry" | "navigate" | "sync" | "destructive" | "neutral";

const normalizeActionHint = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const actionIntentVariantMap: Record<ButtonActionIntent, ButtonVariant> = {
  create: "primary",
  save: "primary",
  confirm: "success",
  complete: "success",
  retry: "warning",
  navigate: "info",
  sync: "info",
  destructive: "danger",
  neutral: "secondary",
};

/**
 * Compatibility helper for action collections that have not yet migrated to
 * explicit actionIntent metadata. The shared Button itself deliberately does
 * not infer visual hierarchy from its visible label.
 */
const actionKeywordMap: Array<{ variant: ButtonVariant; keywords: string[] }> = [
  { variant: "danger", keywords: ["delete", "remove", "cancel", "huy", "reject", "fail", "refund", "xoa", "tu choi"] },
  { variant: "success", keywords: ["complete", "hoan tat", "confirm", "approve", "duyet", "dong", "matched", "success"] },
  { variant: "primary", keywords: ["create", "add", "new", "save", "record", "submit", "tao", "them", "luu", "ghi nhan", "sinh"] },
  { variant: "warning", keywords: ["retry", "thử lại", "thu lai", "change", "doi", "reschedule", "reassign", "fix", "xu ly"] },
  { variant: "info", keywords: ["view", "open", "detail", "chi tiet", "dong bo", "sync", "statistics", "thong ke", "report", "export", "import", "xem"] },
];

export const inferButtonVariantFromAction = (...hints: Array<string | undefined | null>): ButtonVariant => {
  const normalized = hints.filter(Boolean).map((value) => normalizeActionHint(String(value)));
  for (const rule of actionKeywordMap) {
    if (normalized.some((value) => rule.keywords.some((keyword) => value.includes(normalizeActionHint(keyword))))) {
      return rule.variant;
    }
  }
  return "secondary";
};

export const resolveButtonVariant = (
  explicitVariant: ButtonVariant | undefined,
  ...hints: Array<string | undefined | null>
): ButtonVariant => explicitVariant ?? inferButtonVariantFromAction(...hints);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  actionIntent?: ButtonActionIntent;
  size?: "xs" | "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
  loadingText?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant,
  actionIntent,
  size = "md",
  className,
  icon,
  loading,
  loadingText,
  fullWidth = false,
  disabled,
  type = "button",
  ...props
}) => {
  const resolvedVariant = actionIntent ? actionIntentVariantMap[actionIntent] : (variant ?? "secondary");
  const baseClasses = "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border font-semibold leading-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:ring-offset-2 active:translate-y-px [&_svg]:stroke-current";

  const variantClasses: Record<ButtonVariant, string> = {
    primary: "border-violet-600 bg-violet-600 text-white shadow-sm hover:border-violet-700 hover:bg-violet-700",
    secondary: "border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50",
    success: "border-emerald-600 bg-emerald-600 text-white shadow-sm hover:border-emerald-700 hover:bg-emerald-700",
    danger: "border-rose-600 bg-rose-600 text-white shadow-sm hover:border-rose-700 hover:bg-rose-700",
    ghost: "border-transparent bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-900",
    outline: "border-slate-300 bg-transparent text-slate-700 shadow-none hover:bg-slate-50",
    indigo: "border-violet-600 bg-violet-600 text-white shadow-sm hover:border-violet-700 hover:bg-violet-700",
    warning: "border-amber-500 bg-amber-500 text-slate-950 shadow-sm hover:border-amber-600 hover:bg-amber-600",
    info: "border-sky-600 bg-sky-600 text-white shadow-sm hover:border-sky-700 hover:bg-sky-700",
    neutral: "border-slate-200 bg-slate-100 text-slate-700 shadow-none hover:bg-slate-200",
  };

  const sizeClasses = {
    xs: "h-8 px-3 text-xs rounded-lg",
    sm: "h-10 px-4 text-xs rounded-xl",
    md: "h-11 px-5 text-xs rounded-xl",
    lg: "h-12 px-6 text-sm rounded-xl",
  };

  const resolvedSize = sizeClasses[size] ? size : "md";
  const isDisabled = disabled || loading;

  return (
    <button
      data-ui-button="true"
      type={type}
      className={cn(
        baseClasses,
        variantClasses[resolvedVariant],
        sizeClasses[resolvedSize],
        fullWidth && "w-full",
        isDisabled && "pointer-events-none cursor-not-allowed opacity-50 active:translate-y-0",
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 className="shrink-0 animate-spin" aria-hidden="true" size={resolvedSize === "xs" || resolvedSize === "sm" ? 14 : 16} />
      ) : icon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden="true">{icon}</span>
      ) : null}
      <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">{loading && loadingText ? loadingText : children}</span>
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "xs" | "sm" | "md";
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = "secondary",
  size = "md",
  className,
  children,
  disabled,
  type = "button",
  title,
  "aria-label": ariaLabel,
  ...props
}) => {
  const baseClasses = "inline-flex shrink-0 items-center justify-center border transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:ring-offset-2 active:translate-y-px [&_svg]:stroke-current";
  const variantClasses: Partial<Record<ButtonVariant, string>> = {
    primary: "border-violet-600 bg-violet-600 text-white shadow-sm hover:bg-violet-700",
    secondary: "border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900",
    success: "border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
    danger: "border-rose-600 bg-rose-600 text-white shadow-sm hover:bg-rose-700",
    ghost: "border-transparent bg-transparent text-slate-500 shadow-none hover:bg-slate-100 hover:text-slate-900",
    outline: "border-slate-300 bg-transparent text-slate-700 shadow-none hover:bg-slate-50",
    neutral: "border-slate-200 bg-slate-100 text-slate-700 shadow-none hover:bg-slate-200",
  };
  const sizeClasses = {
    xs: "h-8 w-8 rounded-lg text-xs",
    sm: "h-9 w-9 rounded-lg text-xs",
    md: "h-10 w-10 rounded-xl text-sm",
  };
  const resolvedSize = sizeClasses[size] ? size : "md";

  return (
    <button
      data-ui-button="true"
      type={type}
      className={cn(
        baseClasses,
        variantClasses[variant] ?? variantClasses.secondary,
        sizeClasses[resolvedSize],
        disabled && "pointer-events-none cursor-not-allowed opacity-50 active:translate-y-0",
        className,
      )}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
      {...props}
    >
      {children}
    </button>
  );
};
