import React, { useMemo } from "react";
import { useSubscribableSnapshot } from "@/platform/react";
import { getLeadsSnapshot, subscribeToLeads } from "./public/leads";
import { LeadListPage as LeadListScreen } from "./presentation/pages/LeadListPage";

export const LeadListRoutePage: React.FC = () => {
  const leads = useSubscribableSnapshot(getLeadsSnapshot, subscribeToLeads);
  const sources = useMemo(() => [...new Set(leads.map((lead) => lead.source).filter(Boolean))].map((name, index) => ({ id: `source_${index}`, name, code: name, isActive: true })), [leads]);
  const campaigns = useMemo(() => [...new Set(leads.map((lead) => lead.campaignId).filter((value): value is string => Boolean(value)))].map((id) => ({ id, name: id, sourceId: "snapshot", status: "active" as const, isActive: true })), [leads]);
  return <LeadListScreen sources={sources} campaigns={campaigns} />;
};
