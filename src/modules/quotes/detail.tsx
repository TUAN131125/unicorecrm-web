import React from "react";
import { useParams } from "react-router-dom";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { QuoteDetailPage as QuoteDetailScreen } from "./presentation/pages/QuoteDetailPage";

export const QuoteDetailPage: React.FC = () => {
  const { quoteId = "" } = useParams();
  return (
    <EffectiveRecordAccessBoundary resourceKey="quotes" recordId={quoteId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.quotes}>
      <QuoteDetailScreen />
    </EffectiveRecordAccessBoundary>
  );
};
