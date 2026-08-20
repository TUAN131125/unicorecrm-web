import React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Button, Modal, Textarea } from "@/shared/components/ui";

export type DialogTone = "info" | "warning" | "danger" | "success";
export interface DecisionAction { id: string; label: string; variant?: "primary" | "secondary" | "danger" | "warning" | "success"; }
export interface DecisionRequest {
  title: string;
  message: React.ReactNode;
  actions: DecisionAction[];
  tone?: DialogTone;
}
export interface TextInputRequest {
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  submitLabel: string;
  cancelLabel: string;
  requiredMessage: string;
}

type HostState =
  | { kind: "decision"; request: DecisionRequest; resolve: (value: string | null) => void }
  | { kind: "text"; request: TextInputRequest; resolve: (value: string | null) => void }
  | null;

export interface ProductToastOptions { actionLabel?: string; onAction?: () => void; durationMs?: number; }
type ToastState = { message: string; tone: DialogTone; options?: ProductToastOptions } | null;
let hostListener: ((state: HostState) => void) | null = null;
let toastListener: ((toast: ToastState) => void) | null = null;

export function requestDecision(request: DecisionRequest): Promise<string | null> {
  return new Promise((resolve) => hostListener?.({ kind: "decision", request, resolve }));
}
export async function requestConfirmation(request: Omit<DecisionRequest, "actions"> & { confirmLabel: string; cancelLabel: string }): Promise<boolean> {
  const result = await requestDecision({
    ...request,
    actions: [
      { id: "cancel", label: request.cancelLabel, variant: "secondary" },
      { id: "confirm", label: request.confirmLabel, variant: request.tone === "danger" ? "danger" : request.tone === "warning" ? "warning" : "primary" },
    ],
  });
  return result === "confirm";
}
export function requestTextInput(request: TextInputRequest): Promise<string | null> {
  return new Promise((resolve) => hostListener?.({ kind: "text", request, resolve }));
}
export function notifyProduct(message: string, tone: DialogTone = "info", options?: ProductToastOptions) {
  toastListener?.({ message, tone, options });
}

export const ProductDialogHost: React.FC = () => {
  const [state, setState] = React.useState<HostState>(null);
  const [toast, setToast] = React.useState<ToastState>(null);
  const [textValue, setTextValue] = React.useState("");
  const [textError, setTextError] = React.useState("");
  const toastTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    hostListener = (next) => { setTextValue(""); setTextError(""); setState(next); };
    toastListener = (next) => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      setToast(next);
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, next?.options?.durationMs ?? 3500);
    };
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      hostListener = null;
      toastListener = null;
    };
  }, []);

  const close = React.useCallback(() => {
    if (state) state.resolve(null);
    setState(null);
  }, [state]);

  const toneIcon = (tone: DialogTone = "info") => {
    if (tone === "danger") return <XCircle className="text-rose-600" size={22} />;
    if (tone === "warning") return <AlertTriangle className="text-amber-600" size={22} />;
    if (tone === "success") return <CheckCircle2 className="text-emerald-600" size={22} />;
    return <Info className="text-violet-600" size={22} />;
  };

  return (
    <>
      <Modal
        id="product-decision-dialog"
        isOpen={state?.kind === "decision"}
        onClose={close}
        title={state?.kind === "decision" ? state.request.title : ""}
        size="sm"
        variant="form"
        footer={state?.kind === "decision" ? state.request.actions.map((action, index) => (
          <Button
            key={action.id}
            variant={action.variant ?? (index === state.request.actions.length - 1 ? "primary" : "secondary")}
            size="md"
            className="min-w-32"
            autoFocus={index === 0}
            onClick={() => { state.resolve(action.id); setState(null); }}
          >
            {action.label}
          </Button>
        )) : null}
      >
        {state?.kind === "decision" && (
          <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 shadow-sm">
            <div className="mt-0.5 shrink-0">{toneIcon(state.request.tone)}</div>
            <div>{state.request.message}</div>
          </div>
        )}
      </Modal>

      <Modal
        id="product-text-input-dialog"
        isOpen={state?.kind === "text"}
        onClose={close}
        title={state?.kind === "text" ? state.request.title : ""}
        size="sm"
        variant="form"
        footer={state?.kind === "text" ? (
          <>
            <Button variant="secondary" size="md" className="min-w-28" onClick={close}>{state.request.cancelLabel}</Button>
            <Button variant="primary" size="md" className="min-w-32" onClick={() => {
              if (!textValue.trim()) { setTextError(state.request.requiredMessage); return; }
              state.resolve(textValue.trim()); setState(null);
            }}>{state.request.submitLabel}</Button>
          </>
        ) : null}
      >
        {state?.kind === "text" && (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">{state.request.description}</p>
            <Textarea
              label={state.request.label}
              value={textValue}
              placeholder={state.request.placeholder}
              onChange={(event) => { setTextValue(event.target.value); setTextError(""); }}
              autoFocus
              rows={5}
            />
            {textError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{textError}</div>}
          </div>
        )}
      </Modal>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[9500] flex max-w-[min(92vw,640px)] items-center gap-4 -translate-x-1/2 rounded-2xl border border-slate-200 bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl">
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.options?.actionLabel && toast.options.onAction ? (
            <button
              type="button"
              className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-extrabold text-violet-200 hover:bg-white/20"
              onClick={() => { const action = toast.options?.onAction; setToast(null); action?.(); }}
            >
              {toast.options.actionLabel}
            </button>
          ) : null}
        </div>
      )}
    </>
  );
};
