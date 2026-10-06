import React from "react";
import { useParams } from "react-router-dom";
import { ApplicationError, normalizeApplicationError } from "@/shared/domain";
import { getContactRelationshipSummaryResource } from "../../application/vertical-slice/contactAuthoritativeQueries";
import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getDirtyUnsavedWork, registerUnsavedWork } from "@/platform/unsaved-work";
import { Modal, Button } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";
import { acquireContactInteraction, releaseContactInteraction } from "../model/contactInteractionOwnership";
import type { Contact } from "../../domain/model/contact.types";


type Opening = { contact: Contact; version: number | undefined; fingerprint: string; cycle: number; intentId: string; workspaceId: string };
const RELATIONSHIP_FIELDS = ["organizationId", "customerId", "role", "effectiveFrom", "endedReason", "isPrimaryAffiliation"] as const;
type RelationshipField = typeof RELATIONSHIP_FIELDS[number];
const FIELD_IDS: Record<"organization" | "customer", Partial<Record<RelationshipField, string>>> = {
  organization: { organizationId: "organization-relationship-subject", role: "organization-relationship-role", effectiveFrom: "organization-relationship-effective-from", endedReason: "organization-relationship-reason", isPrimaryAffiliation: "organization-relationship-primary" },
  customer: { customerId: "customer-relationship-subject", role: "customer-relationship-role", endedReason: "customer-relationship-reason" },
};
/** Relationship commands belong to the Contact and projection version captured on open. */
export function useContactRelationshipForm(contact: Contact, fingerprint: string, close: () => void, locale: "vi" | "en", title: string, kind: "customer" | "organization") {
  const { contactId: routeContactId } = useParams<{ contactId: string }>();
  const sourceContactId = routeContactId ?? contact.id;
  const { workspaceId } = useWorkspaceContextSnapshot();
  const errorFocus = React.useRef<{ cycle: number; field: RelationshipField } | undefined>(undefined);
  const errorScope = React.useRef<HTMLElement | null>(null);
  const setErrorScope = React.useCallback((element: HTMLElement | null) => { errorScope.current = element; }, []);
  const focusField = (field: RelationshipField) => {
    const id = FIELD_IDS[kind][field];
    if (id) errorScope.current?.querySelector<HTMLElement>(`[id="${id}"]`)?.focus();
  };
  const owner = React.useRef(Symbol("contact-relationship-cycle"));
  const [opening, setOpening] = React.useState<Opening>();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [confirm, setConfirm] = React.useState(false);
  const current = React.useRef(opening); current.current = opening;
  const pendingRef = React.useRef(false);
  const mounted = React.useRef(true);
  const sequence = React.useRef(0);
  const refreshRequired = React.useRef<number | undefined>(undefined);
  const callbacks = React.useRef({ close, fingerprint }); callbacks.current = { close, fingerprint };
  const dirty = Boolean(opening && opening.fingerprint !== fingerprint);
  const finish = React.useCallback(() => {
    releaseContactInteraction(owner.current);
    errorFocus.current = undefined;
    refreshRequired.current = undefined;
    current.current = undefined; setOpening(undefined); setError(undefined); setConfirm(false); callbacks.current.close();
  }, []);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; releaseContactInteraction(owner.current); }; }, []);
  React.useEffect(() => { if (opening && (opening.contact.id !== sourceContactId || opening.workspaceId !== workspaceId) && !dirty && !pendingRef.current) finish(); }, [sourceContactId, workspaceId, opening, dirty, pending, finish]);
  const begin = (version: number | undefined, initialFingerprint: string) => {
    if (current.current || pendingRef.current || sourceContactId !== contact.id) return false;
    if (getDirtyUnsavedWork().some(entry => entry.id.startsWith("contact-"))) return false;
    if (!acquireContactInteraction(owner.current, contact)) return false;
    const next = { contact: structuredClone(contact), workspaceId: getWorkspaceContextSnapshot().workspaceId, version, fingerprint: initialFingerprint, cycle: ++sequence.current, intentId: `contact-relationship-${crypto.randomUUID()}` };
    current.current = next; setOpening(next); setError(undefined); setConfirm(false); return true;
  };
  React.useEffect(() => {
    const focus = errorFocus.current;
    if (error && !pending && focus && current.current?.cycle === focus.cycle) { focusField(focus.field); errorFocus.current = undefined; }
  }, [error, pending]);
  const refreshVersion = async (target: Opening) => {
    const ownsTarget = () => mounted.current && current.current?.cycle === target.cycle && target.workspaceId === getWorkspaceContextSnapshot().workspaceId;
    if (!ownsTarget()) return false;
    const resource = getContactRelationshipSummaryResource(target.contact.id);
    const summary = await resource.refresh();
    if (!ownsTarget()) return false;
    if (!summary || summary.contact.id !== target.contact.id || !Number.isSafeInteger(summary.projectionVersion) || summary.projectionVersion < 0) {
      throw resource.getSnapshot().error ?? new ApplicationError({ code: "CONTACT_VERSION_REFRESH_FAILED", category: "NETWORK", message: "The opening Contact version could not be refreshed." });
    }
    // A rejected version check has no committed idempotency record in Contact authority.
    // Rebase concurrency only; the explicit retry keeps its original intent and draft.
    const rebased = { ...target, version: summary.projectionVersion };
    current.current = rebased; setOpening(rebased); refreshRequired.current = undefined;
    return true;
  };
  const run = async (command: (target: Opening & { version: number }) => Promise<void>) => {
    let target = current.current;
    if (!target || pendingRef.current || !mounted.current) return false;
    if (target.workspaceId !== getWorkspaceContextSnapshot().workspaceId) { setError(locale === "vi" ? "Không gian làm việc đã thay đổi. Quay lại không gian đã mở để tiếp tục." : "Workspace changed. Return to the opening workspace to continue."); return false; }
    if (target.version === undefined) { setError(locale === "vi" ? "Cần tải lại phiên bản Liên hệ." : "Refresh the Contact version before saving."); return false; }
    pendingRef.current = true; setPending(true); setError(undefined);
    try {
      if (refreshRequired.current === target.cycle) {
        if (!await refreshVersion(target)) return false;
        const rebased = current.current;
        if (!rebased || rebased.version === undefined) return false;
        target = rebased;
      }
      const version = target.version;
      if (version === undefined) return false;
      await command({ ...target, version });
      if (!mounted.current || current.current?.cycle !== target.cycle || target.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false;
      finish();
      return true;
    } catch (caught) {
      if (mounted.current && current.current?.cycle === target.cycle) {
        const normalized = normalizeApplicationError(caught);
        const fieldMessages = Object.values(normalized.fieldErrors ?? {}).flat().join(" ");
        setError([formatApplicationError(caught, { locale }), fieldMessages].filter(Boolean).join(" "));
        if (normalized.category === "CONFLICT" && normalized.code === "RESOURCE_VERSION_CONFLICT") {
          refreshRequired.current = target.cycle;
          try { await refreshVersion(target); }
          catch (refreshError) {
            if (mounted.current && current.current?.cycle === target.cycle) setError(formatApplicationError(refreshError, { locale }));
          }
        }
        const firstField = RELATIONSHIP_FIELDS.find(field => normalized.fieldErrors?.[field]?.length && FIELD_IDS[kind][field]);
        if (firstField) {
          errorFocus.current = { cycle: target.cycle, field: firstField };
        }
      }
      return false;
    } finally {
      pendingRef.current = false;
      if (mounted.current && (!current.current || current.current.cycle === target.cycle)) setPending(false);
    }
  };
  const saveRef = React.useRef<() => Promise<boolean>>(async () => false);
  React.useEffect(() => {
    if (!opening) return;
    const cycle = opening.cycle;
    const unload = (event: BeforeUnloadEvent) => { if (dirty || pendingRef.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", unload);
    const unregister = registerUnsavedWork({ id: `contact-relationship:${kind}:${opening.contact.id}:${cycle}`, title, isDirty: dirty || pending,
      save: async () => {
        if (!mounted.current || current.current?.cycle !== cycle || pendingRef.current || opening.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false;
        return saveRef.current();
      },
      canDiscard: () => mounted.current && current.current?.cycle === cycle && !pendingRef.current,
      discard: finish });
    return () => { unregister(); window.removeEventListener("beforeunload", unload); };
  }, [opening, dirty, pending, title, kind, finish]);
  return { opening, setErrorScope, focusField, pending, error, setError, begin, run, saveRef,
    requestClose: () => { if (pendingRef.current) return; if (dirty) setConfirm(true); else finish(); },
    confirmDialog: <Modal isOpen={confirm} onClose={() => setConfirm(false)} size="sm" title={locale === "vi" ? "Bỏ thay đổi?" : "Discard changes?"}><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setConfirm(false)}>{locale === "vi" ? "Tiếp tục chỉnh sửa" : "Keep editing"}</Button><Button type="button" variant="danger" disabled={pending} onClick={() => { if (!pendingRef.current) finish(); }}>{locale === "vi" ? "Bỏ thay đổi" : "Discard changes"}</Button></div></Modal> };
}
