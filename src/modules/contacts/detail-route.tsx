import React from "react";
import { useParams } from "react-router-dom";
import { getOrdersSnapshot, subscribeToOrders } from "@/modules/orders";
import { getTaskActivitySnapshot, subscribeToTaskActivity } from "@/modules/tasks";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceConfigSnapshot } from "@/platform/workspace-config";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { ContactDetailPage as ContactDetailScreen } from "./presentation/pages/ContactDetailPage";
import { useContactCommercialSnapshot } from "./route-context";

const ContactDetailContent: React.FC = () => {
  const commercial = useContactCommercialSnapshot();
  const quotes = useSubscribableSnapshot(getQuotesSnapshot, subscribeToQuotes);
  const orders = useSubscribableSnapshot(getOrdersSnapshot, subscribeToOrders);
  const taskActivity = useSubscribableSnapshot(getTaskActivitySnapshot, subscribeToTaskActivity);
  const careCases = useSubscribableSnapshot(getSupportCasesSnapshot, subscribeToSupportCases);
  const crmConfig = useWorkspaceConfigSnapshot();
  return <ContactDetailScreen {...commercial} quotes={quotes} crmConfig={crmConfig} orders={orders} taskActivity={taskActivity} careCases={careCases} />;
};

export const ContactDetailRoutePage: React.FC = () => {
  const { contactId = "" } = useParams();
  return (
    <EffectiveRecordAccessBoundary resourceKey="contacts" recordId={contactId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.contacts}>
      <ContactDetailContent />
    </EffectiveRecordAccessBoundary>
  );
};
