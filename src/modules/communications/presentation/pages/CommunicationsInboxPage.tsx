import React from "react";
import { useCommunicationsInboxController } from "../hooks/useCommunicationsInboxController";
import { InboxView } from "../components/InboxView";
import { ConversationCrmLinkView } from "../components/ConversationCrmLinkView";

export function CommunicationsInboxPage({ detail = false }: { detail?: boolean }) {
  const { read, triage, view, setSelection, setStatusView, inbox, claim, canClaim, lifecycle, canTransition, crm, vi, back, open, openCrm } = useCommunicationsInboxController(detail);
  return <>
    <nav className="flex gap-3 px-6 pt-5" aria-label={vi ? "Chế độ Hộp thư" : "Inbox views"}>
      {!detail && read && <button type="button" onClick={() => setSelection("assigned")}>{vi ? "Được giao cho tôi" : "Assigned to me"}</button>}
      {!detail && triage && <button type="button" onClick={() => setSelection("unassigned")}>{vi ? "Chưa phân công" : "Unassigned"}</button>}
      {!detail && view === "assigned" && <>
        <button type="button" onClick={() => setStatusView("active")}>{vi ? "Đang hoạt động" : "Active"}</button>
        <button type="button" onClick={() => setStatusView("closed")}>{vi ? "Đã đóng" : "Closed"}</button>
      </>}
      {detail && <button type="button" onClick={back}>{vi ? "Về Hộp thư" : "Back to Inbox"}</button>}
      <button type="button" onClick={inbox.refresh}>{vi ? "Làm mới" : "Refresh"}</button>
    </nav>
    <InboxView state={inbox.state} locale={vi ? "vi" : "en"} detail={detail} queue={view === "unassigned"}
      {...(canClaim ? { onClaim: (id: string) => { void claim.claim(id); } } : {})} claimStatus={claim.status}
      {...(canTransition ? { onTransition: (id, target, version) => { void lifecycle.transition(id, target, version); } } : {})} transitionStatus={lifecycle.status}
      onMore={inbox.more} onOpen={open} />
    {detail && inbox.state.kind === "ready" && <ConversationCrmLinkView crm={crm} vi={vi} onOpen={openCrm} />}
  </>;
}
