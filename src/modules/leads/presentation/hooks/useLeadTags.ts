import React from "react";
import { CAPABILITIES, resolveEffectiveAccess, useEffectiveAccess, useEffectiveRecordAccess } from "@/platform/access-control";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { normalizeApplicationError } from "@/shared/domain";
import { formatApplicationError } from "@/shared/operations";
import { isBusinessOperationUnavailable } from "@/shared/application";
import { replaceLeadTagsViaApi } from "../../application/commands/leadTagCommands";
import type { LeadDetailDialogs } from "./useLeadDetailDialogs";
import { getLeadTagAuthorityKey } from "../model/leadTagAuthority";
import type { Lead } from "../../domain/model/lead.types";

export function useLeadTags(dialogs: LeadDetailDialogs, locale: string, notify: (message: string) => void) {
  const access = useEffectiveAccess();
  const opening = dialogs.boundLead;
  const record = useEffectiveRecordAccess({ resourceKey: "leads", recordId: opening?.id, record: opening,
    requestedCommands: ["lead.update"], requestedFields: ["tags"], enabled: dialogs.showTagsModal });
  const [draftState, setDraftState] = React.useState({ opening, value: "" });
  const [errorState, setErrorState] = React.useState({ opening, value: "" });
  const [displayState, setDisplayState] = React.useState({ opening, lead: opening });
  const draft = draftState.opening === opening ? draftState.value : "";
  const error = errorState.opening === opening ? errorState.value : "";
  const setDraft = (value: string) => setDraftState({ opening, value });
  const setError = (value: string) => setErrorState({ opening, value });
  const blocked = React.useRef(false);
  const busy = React.useRef(false);
  const authority = getLeadTagAuthorityKey();
  const current = React.useRef({ opening, dialogs, authority, record });
  current.current = { opening, dialogs, authority, record };
  const available = dialogs.showTagsModal && Array.isArray(opening?.tags) && access.can(CAPABILITIES.LEADS_UPDATE) && !opening?.archivedAt
    && getAuthSessionSnapshot()?.status === "ACTIVE" && getAuthSessionSnapshot()?.principal.accountId === access.accountId
    && Boolean(record.data?.canRead && record.data.canUpdate && record.data.allowedCommands.includes("lead.update") && record.data.fieldAccess.tags === "READ_WRITE")
    && !isBusinessOperationUnavailable("replaceLeadProfile");
  React.useEffect(() => {
    setDraftState({ opening, value: "" }); setErrorState({ opening, value: "" }); setDisplayState({ opening, lead: opening }); blocked.current = false; busy.current = false;
  }, [opening, authority]);
  const observed = displayState.opening === opening ? displayState.lead : opening;
  const execute = async (kind: "add" | "remove", tag: string): Promise<boolean> => {
    if (!available || blocked.current || !observed || !dialogs.isCurrentInteraction()
      || (kind === "remove" && !observed.tags?.includes(tag)) || !tag) return false;
    // Save owns pending for Add; Remove must acquire the same synchronous owner.
    if (busy.current || (kind === "remove" && !dialogs.setActiveInteractionPending(true))) return false;
    busy.current = true; setError("");
    const isCurrent = () => current.current.opening === opening && authority === getLeadTagAuthorityKey()
      && current.current.dialogs.isCurrentInteraction()
      && getAuthSessionSnapshot()?.status === "ACTIVE"
      && getAuthSessionSnapshot()?.principal.accountId === resolveEffectiveAccess(getWorkspaceContextSnapshot().workspaceId).accountId
      && resolveEffectiveAccess(getWorkspaceContextSnapshot().workspaceId).can(CAPABILITIES.LEADS_UPDATE)
      && !isBusinessOperationUnavailable("replaceLeadProfile")
      && Boolean(current.current.record.data?.canRead && current.current.record.data.canUpdate && current.current.record.data.allowedCommands.includes("lead.update")
        && current.current.record.data.fieldAccess.tags === "READ_WRITE");
    try {
      const tags = kind === "remove" ? (observed.tags ?? []).filter(item => item !== tag)
        : [...new Set([...(observed.tags ?? []), tag])];
      const result = await replaceLeadTagsViaApi(observed, tags, { idempotencyKey: `lead-tags:${crypto.randomUUID()}`, isCurrent });
      if (!result || !isCurrent()) return false;
      setDisplayState({ opening, lead: result.lead });
      if (kind === "remove") notify(locale === "vi" ? `Đã gỡ nhãn “${tag}”.` : `Removed tag “${tag}”.`);
      return true;
    } catch (failure) {
      if (!isCurrent()) return false;
      const typed = normalizeApplicationError(failure);
      if (typed.category === "AUTHORIZATION" || typed.category === "NOT_FOUND" || typed.status === 403 || typed.status === 404) {
        notify(formatApplicationError(typed, { locale }));
        dialogs.resolveInteraction("tags");
        return false;
      }
      // Unknown outcomes cannot create a fresh replacement attempt. Reopen only
      // after an authoritative refresh/reconciliation outside this interaction.
      const conflict = typed.status === 412 || typed.code === "VERSION_CONFLICT";
      const ambiguous = typed.category === "NETWORK" || typed.status === undefined || typed.status >= 500;
      if (ambiguous || conflict) blocked.current = true;
      const recovery = conflict ? locale === "vi" ? " Tải lại hồ sơ rồi mở lại quản lý nhãn để đối chiếu dữ liệu." : " Refresh the record and reopen tags to reconcile the data."
        : ambiguous ? locale === "vi" ? " Chưa xác định được kết quả. Không gửi lại; tải lại hồ sơ để đối chiếu trước khi tạo thao tác mới." : " The outcome is unknown. Do not resubmit; refresh and reconcile the record before creating a new action." : "";
      setError(formatApplicationError(typed, { locale }) + recovery);
      return false;
    } finally {
      if (current.current.opening === opening && authority === getLeadTagAuthorityKey()) {
        busy.current = false;
        if (kind === "remove") dialogs.setActiveInteractionPending(false);
      }
    }
  };
  const unavailableMessage = locale === "vi" ? "Không thể sửa nhãn từ dữ liệu và quyền hiện tại. Đóng hộp thoại, tải lại hồ sơ rồi kiểm tra quyền truy cập."
    : "Tags cannot be edited with the current data and access. Close this dialog, refresh the record and check access.";
  return { draft, setDraft, error: available ? error : unavailableMessage, lead: available ? observed : undefined, visible: dialogs.showTagsModal, available: available && !blocked.current,
    add: () => execute("add", draft.trim()), remove: (tag: string) => execute("remove", tag),
    close: () => { if (!dialogs.interactionPending && !busy.current) dialogs.setShowTagsModal(false); } };
}
