import React from "react";
import { useParams } from "react-router-dom";
import { getContactsSnapshot, replaceContacts, subscribeToContacts } from "@/modules/contacts";
import { getCustomerPresentationSnapshot as getCustomersSnapshot, subscribeToCustomerPresentation as subscribeToCustomers } from "@/modules/customers";
import { getOrdersSnapshot, subscribeToOrders } from "@/modules/orders";
import { useSubscribableSnapshot, useSubscribableState } from "@/platform/react";
import { useWorkspaceConfigSnapshot } from "@/platform/workspace-config";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { DealDetailPage as DealDetailScreen } from "./presentation/pages/DealDetailPage";

export const DealDetailRoutePage: React.FC = () => {
  const { dealId = "" } = useParams();
  const [customers, setCustomers] = useSubscribableState(getCustomersSnapshot, subscribeToCustomers, () => undefined);
  const [contacts, setContacts] = useSubscribableState(getContactsSnapshot, subscribeToContacts, replaceContacts);
  const orders = useSubscribableSnapshot(getOrdersSnapshot, subscribeToOrders);
  const crmConfig = useWorkspaceConfigSnapshot();
  return (
    <EffectiveRecordAccessBoundary resourceKey="deals" recordId={dealId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.deals}>
      <DealDetailScreen
        customers={customers}
        setCustomers={setCustomers}
        contacts={contacts}
        setContacts={setContacts}
        crmConfig={crmConfig}
        orders={orders}
      />
    </EffectiveRecordAccessBoundary>
  );
};
