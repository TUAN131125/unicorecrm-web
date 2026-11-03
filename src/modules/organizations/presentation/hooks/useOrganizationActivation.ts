import React from "react";
import { useEffectiveAccess, useEffectiveRecordAccess } from "@/platform/access-control";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createDurableId } from "@/shared/ids";
import { normalizeApplicationError } from "@/shared/domain";
import { formatApplicationError } from "@/shared/operations";
import { readOrganizationById, updateOrganizationViaApi } from "../../public/api";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";

export function useOrganizationActivation(id: string, vi: boolean, onActivated?: () => void) {
  const workspace = useWorkspaceContextSnapshot(), effective = useEffectiveAccess();
  const access = useEffectiveRecordAccess({ resourceKey: "organizations", recordId: id,
    requestedFields: ["displayName", "status", "resourceVersion"], requestedCommands: ["organization.update"] });
  const [revision, reload] = React.useReducer((n: number) => n + 1, 0);
  const scope = JSON.stringify([workspace.workspaceId, effective.memberId, id]);
  const key = JSON.stringify([scope, effective.authorityRevision, revision]);
  const currentKey = React.useRef(key); currentKey.current = key;
  const currentScope = React.useRef(scope); currentScope.current = scope;
  const callback = React.useRef(onActivated); callback.current = onActivated;
  const [source, setSource] = React.useState<{ key: string; value: OrganizationAccount }>();
  const [open, setOpen] = React.useState(false), [pending, setPending] = React.useState(false);
  const [unknown, setUnknown] = React.useState(false), [error, setError] = React.useState("");
  const running = React.useRef(false);
  const intent = React.useRef<{ key: string; request: { organizationId: string; expectedVersion: number; status: "active" }; idempotencyKey: string } | undefined>(undefined);
  React.useEffect(() => {
    currentScope.current = scope;
    setOpen(false); setPending(false); setUnknown(false); setError(""); intent.current = undefined;
    return () => { currentScope.current = ""; };
  }, [scope]);
  React.useEffect(() => {
    if (!access.data?.canRead) return;
    const abort = new AbortController();
    void readOrganizationById(id, abort.signal).then(value => { if (!abort.signal.aborted) setSource({ key, value }); }).catch(() => {});
    return () => abort.abort();
  }, [id, key, access.data?.canRead]);
  React.useEffect(() => {
    const focus = () => { if (!running.current && !unknown) { reload(); void access.refresh(); } };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [access.refresh, unknown]);
  const value = source?.key === key ? source.value : undefined;
  const canReadStatus = ["READ_ONLY", "READ_WRITE"].includes(access.data?.fieldAccess.status ?? "");
  const canActivate = value?.status === "prospect" && access.data?.canUpdate === true
    && access.data.fieldAccess.status === "READ_WRITE" && value.resourceVersion !== undefined;
  async function activate() {
    if (running.current || (!canActivate && !unknown) || !value || value.resourceVersion === undefined) return false;
    if (unknown && intent.current?.key !== scope) return false;
    if (!intent.current || intent.current.key !== scope) intent.current = { key: scope,
      request: { organizationId: id, expectedVersion: value.resourceVersion, status: "active" }, idempotencyKey: createDurableId("organization-activate") };
    const request = intent.current; running.current = true; setPending(true); setError("");
    try {
      const result = await updateOrganizationViaApi(request.request, { idempotencyKey: request.idempotencyKey });
      if (currentScope.current !== scope) return false;
      if (result.status !== "active") throw new Error("ORGANIZATION_ACTIVATION_NOT_CONFIRMED");
      setSource({ key: currentKey.current, value: result }); setUnknown(false); setOpen(false); callback.current?.(); return true;
    } catch (caught) {
      if (currentScope.current !== scope) return false;
      const failure = normalizeApplicationError(caught);
      if (failure.status === undefined || failure.status >= 500) setUnknown(true);
      else if (!unknown) intent.current = undefined;
      setError(formatApplicationError(caught, { locale: vi ? "vi" : "en" })); return false;
    } finally { running.current = false; if (currentScope.current === scope) setPending(false); }
  }
  return { value, canReadStatus, canActivate, open, pending, unknown, error, activate,
    show: () => { setError(""); setOpen(true); }, close: () => { if (!running.current && !unknown) setOpen(false); } };
}
