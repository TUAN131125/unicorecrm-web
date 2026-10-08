import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useEffect, useRef, useState } from "react";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { formatApplicationError } from "@/shared/operations";
import { ConfirmDialog } from "@/shared/components/ui";
import { useI18n } from "@/i18n";

/** Local drafts retain their opening callback; global saving fails safely unless explicitly wired. */
export function useLeadAuxiliaryLifecycle(open: boolean, name: string, dirty: boolean, reset: () => void, close: () => void, externalPending = false, targetId?: string) {
  const { locale } = useI18n();
  const workspace = useWorkspaceContextSnapshot();
  const openingWorkspace = useRef(workspace.workspaceId);
  const openingTarget = useRef(targetId);
  const liveTarget = useRef(targetId); liveTarget.current = targetId;
  const registration = useRef<object | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const busy = useRef(false);
  const busyCycle = useRef<number | undefined>(undefined);
  const openRef = useRef(open);
  const mounted = useRef(true);
  const cycle = useRef(0);
  const wasOpen = useRef(false);
  if (open !== wasOpen.current) {
    cycle.current++;
    if (open) { openingWorkspace.current = workspace.workspaceId; openingTarget.current = targetId; }
  }
  openRef.current = open;
  wasOpen.current = open;
  const active = cycle.current;
  const saveBinding = useRef<{ cycle: number; save: () => Promise<boolean> } | undefined>(undefined);
  useEffect(() => { setConfirm(false); if (open) setError(undefined); }, [open, active]);
  const state = useRef({ reset, close, externalPending });
  state.current = { reset, close, externalPending };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && openRef.current && cycle.current === active;
  const allowed = () => current() && !busy.current && !state.current.externalPending;
  const closeDraft = () => {
    // Invalidate synchronously so a saved registry callback cannot discard twice before React renders close.
    openRef.current = false;
    cycle.current++;
    state.current.reset(); setError(undefined); setConfirm(false); state.current.close();
  };
  const discard = () => {
    if (!allowed()) return;
    closeDraft();
  };
  useEffect(() => {
    if (!open) return;
    const token = {}; registration.current = token;
    const unregister = registerUnsavedWork({ id: `lead-aux:${name}:${active}`, title: name, isDirty: dirty || pending || externalPending,
      save: async () => {
        return registration.current === token ? save() : false;
      }, canDiscard: allowed, discard });
    return () => { unregister(); if (registration.current === token) registration.current = undefined; };
  });
  useEffect(() => {
    if (!open || !(dirty || pending || externalPending)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty, pending, externalPending]);
  const ownsWorkspace = () => getWorkspaceContextSnapshot().workspaceId === openingWorkspace.current;
  async function save(): Promise<boolean> {
    const binding = saveBinding.current;
    if (!allowed() || !ownsWorkspace() || openingTarget.current !== liveTarget.current || binding?.cycle !== active) return false;
    const saved = await run(binding.save, true);
    // The awaited command has settled; its rendered pending flag may still be true.
    if (saved && current() && ownsWorkspace() && openingTarget.current === liveTarget.current && !busy.current) closeDraft();
    return saved;
  }
  useEffect(() => { if (open && (!ownsWorkspace() || openingTarget.current !== targetId) && !dirty && !busy.current && !externalPending) discard(); });
  async function run(action: () => Promise<unknown> | unknown, requireProof = false) {
    if (!allowed() || !ownsWorkspace() || openingTarget.current !== targetId) return false;
    busy.current = true; busyCycle.current = active; setPending(true); setError(undefined);
    try {
      const command = action();
      if (requireProof && (!command || typeof (command as Promise<unknown>).then !== "function")) return false;
      const result = await command;
      return current() && ownsWorkspace() && openingTarget.current === liveTarget.current && (requireProof ? result === true : result !== false);
    }
    catch (failure) { if (current() && ownsWorkspace()) setError(formatApplicationError(failure, { locale })); return false; }
    finally {
      // A forced close invalidates callbacks, but must release the old pending latch once its command settles.
      // No newer command can own this latch while busy is true.
      if (busyCycle.current === active) { busy.current = false; busyCycle.current = undefined; if (mounted.current) setPending(false); }
    }
  }
  return { pending: pending || externalPending, error, run, save, isCurrent: () => current() && ownsWorkspace() && openingTarget.current === liveTarget.current,
    bindSave: (save: () => Promise<boolean>) => { if (current()) saveBinding.current = { cycle: active, save }; },
    requestClose: () => { if (!allowed()) return; if (dirty) setConfirm(true); else discard(); },
    confirmation: <ConfirmDialog isOpen={open && confirm} onClose={() => setConfirm(false)} onConfirm={discard}
      title={locale === "vi" ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"}
      message={locale === "vi" ? "Thay đổi chưa được lưu." : "Changes have not been saved."}
      confirmText={locale === "vi" ? "Bỏ thay đổi" : "Discard changes"}
      cancelText={locale === "vi" ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" /> };
}
