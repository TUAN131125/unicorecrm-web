import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  Search,
} from "lucide-react";
import { Modal } from "@/shared/components/ui/Dialog";
import { Switch } from "@/shared/components/ui/Switch";
import { cn } from "@/shared/lib/classnames/cn";
import { registerUnsavedWork } from "@/platform/unsaved-work";

export interface StudioEditorRegistration {
  dirty: boolean;
  canConfigure: boolean;
  save(): Promise<boolean>;
}

export type StudioEditorStateChange = (
  editorId: string,
  registration: StudioEditorRegistration | null,
) => void;

export function useQuickSetupEditorRegistration({
  editorId,
  dirty,
  canConfigure,
  onSave,
  onEditorStateChange,
}: {
  editorId: string;
  dirty: boolean;
  canConfigure: boolean;
  onSave(): boolean | void | Promise<boolean | void>;
  onEditorStateChange: StudioEditorStateChange;
}) {
  const saveRef = React.useRef(onSave);
  saveRef.current = onSave;

  React.useEffect(() => {
    onEditorStateChange(editorId, {
      dirty,
      canConfigure,
      save: async () => (await saveRef.current()) !== false,
    });
  }, [canConfigure, dirty, editorId, onEditorStateChange]);

  React.useEffect(
    () => () => onEditorStateChange(editorId, null),
    [editorId, onEditorStateChange],
  );
}

function formatStudioTimestamp(value: string, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale.startsWith("vi") ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function StudioPageFrame({
  title,
  description,
  actions,
  locale,
  message,
  error,
  dirty = false,
  revision,
  updatedAt,
  children,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  locale: string;
  message?: string;
  error?: string;
  dirty?: boolean;
  revision?: number;
  updatedAt?: string;
  children: React.ReactNode;
}) {
  const text = (vi: string, en: string) => locale.startsWith("vi") ? vi : en;
  return (
    <main className="mx-auto w-full max-w-[1540px] overflow-x-clip px-4 py-5 pb-24 sm:px-6 lg:px-8" data-studio-surface="configuration">
      <header className="rounded-2xl border border-slate-200/90 bg-white px-5 py-5 shadow-[0_18px_45px_-38px_rgba(15,23,42,0.45)] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-500">Studio</p>
            <h1 className="mt-1 text-[27px] font-semibold leading-9 tracking-[-0.025em] text-slate-950 [overflow-wrap:anywhere]">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm font-normal leading-6 text-slate-600 [overflow-wrap:anywhere]" data-studio-page-description="true">{description}</p>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-normal text-slate-500">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1", dirty ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", dirty ? "bg-amber-500" : "bg-emerald-500")} aria-hidden="true" />
            {dirty ? text("Có thay đổi chưa lưu", "Unsaved changes") : text("Đã đồng bộ với bản lưu", "Synced with saved configuration")}
          </span>
          <details className="group relative">
            <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20">
              {text("Chi tiết cấu hình", "Configuration details")}
            </summary>
            <div className="absolute left-0 top-full z-30 mt-2 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <dl className="space-y-3">
                {typeof revision === "number" ? <div><dt className="text-[11px] uppercase tracking-[0.08em] text-slate-400">{text("Phiên bản", "Revision")}</dt><dd className="mt-1 text-xs text-slate-700">{revision}</dd></div> : null}
                {updatedAt ? <div><dt className="text-[11px] uppercase tracking-[0.08em] text-slate-400">{text("Cập nhật", "Updated")}</dt><dd className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-700"><Clock3 size={13} aria-hidden="true" />{formatStudioTimestamp(updatedAt, locale)}</dd></div> : null}
              </dl>
            </div>
          </details>
        </div>
      </header>
      {message ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-normal text-emerald-800" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{message}</span>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-normal text-rose-800" role="alert">
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}
      <div className="mt-5 min-w-0">{children}</div>
    </main>
  );
}

export function StudioSection({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_35px_-32px_rgba(15,23,42,0.45)]", className)}>
      {title || description || actions ? (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold leading-6 text-slate-950 [overflow-wrap:anywhere]">{title}</h2> : null}
            {description ? <p className="mt-1 max-w-3xl text-sm font-normal leading-6 text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}

export function StudioSectionNavigation({
  items,
  activeId,
  onChange,
  ariaLabel,
}: {
  items: Array<{ id: string; label: string; description?: string }>;
  activeId: string;
  onChange(id: string): void;
  ariaLabel: string;
}) {
  return (
    <nav className="rounded-xl border border-slate-200 bg-white p-2" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20",
            activeId === item.id ? "bg-violet-50 text-violet-700" : "text-slate-700 hover:bg-slate-50",
          )}
        >
          <span className="min-w-0">
            <span className="block text-sm font-normal">{item.label}</span>
            {item.description ? <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500">{item.description}</span> : null}
          </span>
          <ChevronRight size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

export type StudioButtonTone = "primary" | "accent" | "secondary" | "danger" | "text";

export function StudioButton({
  children,
  tone = "secondary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: StudioButtonTone;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const tones: Record<StudioButtonTone, string> = {
    primary: "border-violet-600 bg-violet-600 text-white hover:bg-violet-700",
    accent: "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100",
    secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
    text: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950",
  };
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm",
        tones[tone],
        className,
      )}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icon}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

export function StudioField({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="block text-sm font-normal leading-5 text-slate-700">{label}</span>
      {hint ? <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
      {error ? <span className="mt-1 block text-xs font-normal text-rose-600">{error}</span> : null}
    </label>
  );
}

const controlClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 disabled:bg-slate-100 disabled:text-slate-500";

export const StudioInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function StudioInput(props, ref) {
    return <input ref={ref} {...props} className={cn(controlClass, props.className)} />;
  },
);

export function StudioSearchInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={cn("relative block", className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input {...props} type="search" className={cn(controlClass, "pl-10", className)} />
    </span>
  );
}

export function StudioTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, "min-h-24 py-3", props.className)} />;
}

export function StudioSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, "cursor-pointer", props.className)} />;
}

export function StudioCheckbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex min-h-11 items-start gap-3", disabled && "opacity-55")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/25"
      />
      <span className="min-w-0">
        <span className="block text-sm font-normal text-slate-800">{label}</span>
        {description ? <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}

export function StudioSwitch({
  checked,
  onChange,
  label,
  description,
  statusLabel,
  dependency,
  disabled,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  description: string;
  statusLabel?: string;
  dependency?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid min-h-[78px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-slate-100 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-950 [overflow-wrap:anywhere]">{label}</p>
        <p className="mt-1 text-xs font-normal leading-5 text-slate-500 [overflow-wrap:anywhere]">{description}</p>
        {dependency ? <span className="mt-2 inline-flex max-w-full rounded-full bg-slate-100 px-2.5 py-1 text-[11px] leading-4 text-slate-600 [overflow-wrap:anywhere]">{dependency}</span> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} ariaLabel={label} />
        {statusLabel ? <span className={cn("text-[11px] font-medium", checked ? "text-emerald-700" : "text-slate-500")}>{statusLabel}</span> : null}
      </div>
    </div>
  );
}

export function StudioStatus({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const tones = {
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-normal", tones[tone])}>{children}</span>;
}

export function StudioDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "sm",
}: {
  open: boolean;
  onClose(): void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size={size}
      variant="form"
      title={<span className="font-normal">{title}</span>}
      description={description ? <span className="font-normal">{description}</span> : undefined}
      footer={footer}
      className="[&_h2]:font-normal [&_p]:font-normal"
      bodyClassName="font-normal"
    >
      {children}
    </Modal>
  );
}

export function StudioLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-normal text-slate-600">
      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function StudioEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      <p className="text-base font-normal text-slate-900">{title}</p>
      <p className="mt-2 max-w-xl text-sm font-normal leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StudioSaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel,
  cleanLabel,
  dirtyLabel,
}: {
  dirty: boolean;
  saving: boolean;
  onSave(): void | Promise<void>;
  onDiscard?(): void;
  saveLabel: string;
  cleanLabel: string;
  dirtyLabel: string;
}) {
  const registryId = React.useId();
  const saveRef = React.useRef(onSave);
  const discardRef = React.useRef(onDiscard);
  saveRef.current = onSave;
  discardRef.current = onDiscard;

  React.useEffect(() => registerUnsavedWork({
    id: `studio:${registryId}`,
    title: dirtyLabel,
    isDirty: dirty,
    save: async () => {
      try {
        await saveRef.current();
        return true;
      } catch {
        return false;
      }
    },
    discard: () => discardRef.current?.(),
  }), [dirty, dirtyLabel, registryId]);

  React.useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  if (!dirty && !saving) return null;
  return (
    <div className="sticky bottom-4 z-20 mx-auto mt-5 flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-amber-200 bg-white/96 px-4 py-3 shadow-[0_22px_55px_-32px_rgba(15,23,42,0.65)] backdrop-blur sm:flex-row sm:items-center sm:justify-between" data-studio-save-bar="true">
      <span className="text-sm font-medium text-amber-800">{dirty ? dirtyLabel : cleanLabel}</span>
      <StudioButton tone="primary" loading={saving} disabled={!dirty} onClick={onSave}>{saveLabel}</StudioButton>
    </div>
  );
}
