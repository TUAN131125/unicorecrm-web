import React from "react";
import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { formatApplicationError } from "@/shared/operations";
import { normalizeApplicationError } from "@/shared/domain";
import { useI18n } from "@/i18n";

export function useActivityDraftLifecycle<T>(isOpen: boolean, createDraft: () => T, targetId: string | undefined, formId: string, onSubmit: (draft: T) => void | boolean | Promise<void | boolean>, onClose: () => void, onSave?: (draft: T) => Promise<boolean>, onBindSave?: (save: (() => Promise<boolean>) | undefined) => void, onPendingChange?: (pending: boolean) => void) {
  const workspaceId = useWorkspaceContextSnapshot().workspaceId;
  const liveWorkspace = React.useRef(workspaceId);
  liveWorkspace.current = workspaceId;
  const [draft, setDraft] = React.useState<T>(createDraft);
  const initial = React.useRef(draft);
  const wasOpen = React.useRef(false);
  const opening = React.useRef({ workspaceId, targetId, onSubmit, onClose, onSave });
  const pending = React.useRef(false);
  const validatedSave = React.useRef<(() => Promise<boolean>) | undefined>(undefined);
  const liveTarget = React.useRef(targetId); liveTarget.current = targetId;
  const mounted = React.useRef(true);
  const cycle = React.useRef(0);
  const openRef = React.useRef(isOpen);
  openRef.current = isOpen;
  const registration = React.useRef<object | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saveError, setSaveError] = React.useState("");
  const { locale } = useI18n();
  const fingerprint = (value: T) => JSON.stringify(value, (_key, field: unknown) => typeof field === "string" ? field.trim() : field);
  const dirty = fingerprint(draft) !== fingerprint(initial.current);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => {
    if (isOpen && !pending.current && (!wasOpen.current || (opening.current.targetId !== targetId && !dirty))) {
      cycle.current += 1;
      opening.current = { workspaceId, targetId, onSubmit, onClose, onSave };
      initial.current = createDraft();
      setDraft(initial.current);
      setErrors({});
      setSaveError("");
    }
    if (!isOpen && wasOpen.current) cycle.current += 1;
    if (!isOpen || !pending.current) wasOpen.current = isOpen;
  });
  React.useEffect(() => {
    // Lead action owners already register their lifecycle; explicit targetId opts other callers in.
    if (!isOpen || onBindSave || targetId === undefined) return;
    const capturedCycle = cycle.current;
    const entryToken = {};
    registration.current = entryToken;
    const currentEntry = () => mounted.current && openRef.current && cycle.current === capturedCycle && registration.current === entryToken;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (dirty || busy) window.addEventListener("beforeunload", warn);
    const unregister = registerUnsavedWork({
      id: `${formId}:${opening.current.targetId}:${capturedCycle}`,
      title: formId,
      isDirty: dirty || busy,
      // Global and local submission share validation; the owner supplies command-result proof.
      save: () => currentEntry() && !pending.current && opening.current.onSave && opening.current.targetId === liveTarget.current
        ? validatedSave.current?.() ?? Promise.resolve(false) : Promise.resolve(false),
      canDiscard: () => currentEntry() && !pending.current,
      discard: () => { if (currentEntry() && !pending.current) { setDraft(initial.current); opening.current.onClose(); } },
    });
    return () => { unregister(); if (registration.current === entryToken) registration.current = undefined; window.removeEventListener("beforeunload", warn); };
  });
  React.useEffect(() => {
    const capturedCycle = cycle.current; const lease = { active: true };
    onBindSave?.(() => lease.active && mounted.current && openRef.current && cycle.current === capturedCycle && !pending.current
      ? validatedSave.current?.() ?? Promise.resolve(false) : Promise.resolve(false));
    return () => { lease.active = false; onBindSave?.(undefined); };
  });
  async function submit(value: T, globalSave = false): Promise<boolean> {
    globalSave = globalSave || Boolean(opening.current.onSave);
    if (pending.current || !mounted.current || !openRef.current) return false;
    if (globalSave && (!opening.current.onSave || opening.current.targetId !== liveTarget.current)) return false;
    if (opening.current.workspaceId !== getWorkspaceContextSnapshot().workspaceId) {
      if (globalSave) return false;
      throw new Error("Workspace changed. Close this draft and reopen it.");
    }
    pending.current = true;
    setSaveError("");
    onPendingChange?.(true);
    setBusy(true);
    const capturedCycle = cycle.current;
    try {
      if (globalSave) {
        const command = opening.current.onSave?.(value);
        if (!command || typeof command.then !== "function" || (await command) !== true) return false;
        if (!mounted.current || !openRef.current || cycle.current !== capturedCycle || opening.current.targetId !== liveTarget.current
          || opening.current.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false;
      } else if ((await opening.current.onSubmit(value)) === false) return false;
      if (mounted.current && cycle.current === capturedCycle && opening.current.workspaceId === liveWorkspace.current) { initial.current = value; setDraft(value); }
      if (globalSave) { openRef.current = false; opening.current.onClose(); }
      return true;
    }
    catch (failure) {
      if (mounted.current && cycle.current === capturedCycle) {
        const normalized = normalizeApplicationError(failure);
        setSaveError(formatApplicationError(normalized, { locale }));
        const fields = Object.fromEntries(Object.entries(normalized.fieldErrors ?? {}).map(([field, messages]) => [field, messages.join(" ")]));
        setErrors(fields);
        const first = Object.keys(fields)[0];
        if (first) requestAnimationFrame(() => document.getElementById(`${formId}-${first}`)?.focus());
      }
      if (globalSave) return false;
      throw failure;
    }
    finally {
      pending.current = false;
      onPendingChange?.(false);
      if (mounted.current) setBusy(false);
    }
  }
  const validate = (fields: Record<string, string>): boolean => {
    const invalid = Object.keys(fields).filter(field => {
      const value = fields[field]?.trim();
      return !value || (field === "to" && !/^\S+@\S+\.\S+$/.test(value))
        || (["occurredAt", "startAt", "endAt", "nextFollowUpAt"].includes(field) && Number.isNaN(new Date(value).getTime()));
    });
    if (!invalid.length) return true;
    setErrors(Object.fromEntries(invalid.map(field => [field, "Required"])));
    document.getElementById(`${formId}-${invalid[0]}`)?.focus();
    return false;
  };
  return { saveError, bindSave: (save: () => Promise<boolean>) => { validatedSave.current = save; }, draft, setDraft: (update: React.SetStateAction<T>) => { if (!pending.current) setDraft(update); }, dirty, busy, errors, submit, validate, close: () => { if (!pending.current) opening.current.onClose(); } };
}
