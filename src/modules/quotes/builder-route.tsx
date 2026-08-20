import React from "react";
import { useParams } from "react-router-dom";
import { getCustomerPresentationSnapshot as getCustomersSnapshot, subscribeToCustomerPresentation as subscribeToCustomers } from "@/modules/customers";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceConfigSnapshot } from "@/platform/workspace-config";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { QuoteBuilderPage as QuoteBuilderScreen } from "./presentation/pages/QuoteBuilderPage";

export const QuoteBuilderRoutePage: React.FC = () => {
  const { quoteId = "" } = useParams();
  const customers = useSubscribableSnapshot(getCustomersSnapshot, subscribeToCustomers);
  const crmConfig = useWorkspaceConfigSnapshot();
  const requiredCommand = quoteId ? "quote.update" : "quote.create";
  return (
    <EffectiveRecordAccessBoundary
      resourceKey="quotes"
      recordId={quoteId || undefined}
      requiredCommand={requiredCommand}
      {...EFFECTIVE_RECORD_ACCESS_PROFILES.quotes}
    >
      <QuoteBuilderScreen customers={customers} crmConfig={crmConfig} />
    </EffectiveRecordAccessBoundary>
  );
};
