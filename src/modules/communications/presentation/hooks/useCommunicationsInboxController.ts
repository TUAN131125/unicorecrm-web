import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useEffectiveAccess, CAPABILITIES } from "@/platform/access-control";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { toWorkspacePath } from "@/platform/navigation";
import { getCommunicationsQueries, getCommunicationsCommands, getCommunicationsLink } from "../../runtime";
import { useInbox } from "./useInbox";
import { useConversationClaim } from "./useConversationClaim";
import { useConversationTransition } from "./useConversationTransition";
import { useConversationCrmLink } from "./useConversationCrmLink";
import type { CrmTarget } from "../../application/CommunicationsLink";

export function useCommunicationsInboxController(detail: boolean) {
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  const session = useAuthSessionSnapshot();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [selection, setSelection] = useState<"assigned" | "unassigned">("assigned");
  const [statusView, setStatusView] = useState<"active" | "closed">("active");
  const read = access.can(CAPABILITIES.COMMUNICATIONS_READ);
  const triage = access.can(CAPABILITIES.COMMUNICATIONS_QUEUE_READ);
  const view = detail || read && selection === "assigned" ? "assigned" : "unassigned";
  const enabled = session?.status === "ACTIVE" && workspace.status === "active" && (view === "assigned" ? read : triage);
  const scope = JSON.stringify([workspace.workspaceId, workspace.accountId, workspace.memberId, workspace.membershipId,
    session?.sessionId, session?.status, access.authorityRevision, view, detail ? conversationId : statusView, enabled]);
  const inbox = useInbox(getCommunicationsQueries(view, statusView), scope, detail ? conversationId : undefined, { enabled, pollMs: 15000 });
  const open = (id: string) => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `communications/${encodeURIComponent(id)}`));
  const canClaim = enabled && view === "unassigned" && !detail && read && triage
    && access.can(CAPABILITIES.COMMUNICATIONS_CLAIM) && inbox.state.kind === "ready" && inbox.state.canClaim === true;
  const claim = useConversationClaim(getCommunicationsCommands(), scope, enabled, inbox.refresh, id => {
    setSelection("assigned"); setStatusView("active"); open(id);
  });
  const canTransition = enabled && detail && read && access.can(CAPABILITIES.COMMUNICATIONS_TRANSITION);
  const lifecycle = useConversationTransition(getCommunicationsCommands(), scope, canTransition, inbox.refresh);
  const crm = useConversationCrmLink(getCommunicationsLink(), scope, conversationId, enabled && detail && inbox.state.kind === "ready",
    access.can(CAPABILITIES.COMMUNICATIONS_LINK), inbox.refresh, inbox.state.kind === "ready" ? inbox.state.conversations[0]?.version : undefined);
  return { read, triage, view, setSelection, statusView, setStatusView, inbox, claim, canClaim, lifecycle, canTransition, crm, vi: locale === "vi",
    openCrm: (target: CrmTarget) => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `${target.targetType === "LEAD" ? "leads" : "contacts"}/${encodeURIComponent(target.targetId)}`)),
    back: () => navigate(toWorkspacePath(workspace.workspaceKey, "crm", "communications")),
    open,
  };
}
