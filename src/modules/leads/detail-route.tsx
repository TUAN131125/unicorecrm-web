import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceConfigSnapshot } from "@/platform/workspace-config";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { getLeadsSnapshot, subscribeToLeads } from "./public/leads";
import { LeadDetailPage as LeadDetailScreen } from "./presentation/pages/LeadDetailPage";

export const LeadDetailRoutePage: React.FC = () => {
  const { leadId = "" } = useParams();
  const leads = useSubscribableSnapshot(getLeadsSnapshot, subscribeToLeads);
  const crmConfig = useWorkspaceConfigSnapshot();
  const sources = useMemo(() => [...new Set(leads.map((lead) => lead.source).filter(Boolean))].map((name, index) => ({ id: `source_${index}`, name, code: name, isActive: true })), [leads]);
  const campaigns = useMemo(() => [...new Set(leads.map((lead) => lead.campaignId).filter((value): value is string => Boolean(value)))].map((id) => ({ id, name: id, sourceId: "snapshot", status: "active" as const, isActive: true })), [leads]);
  const record = leads.find((lead) => lead.id === leadId);
  return (
    <EffectiveRecordAccessBoundary
      resourceKey="leads"
      recordId={leadId}
      record={record}
      showNotice={false}
      {...EFFECTIVE_RECORD_ACCESS_PROFILES.leads}
    >
      <LeadDetailScreen sources={sources} campaigns={campaigns} crmConfig={crmConfig} />
    </EffectiveRecordAccessBoundary>
  );
};
