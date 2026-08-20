import React from "react";
import { useParams } from "react-router-dom";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { ReturnFormPage as ReturnFormScreen } from "./presentation/pages/ReturnFormPage";

export const ReturnFormPage: React.FC = () => {
  const { returnId = "" } = useParams();
  const requiredCommand = returnId ? "return.update" : "return.create";
  return (
    <EffectiveRecordAccessBoundary
      resourceKey="returns"
      recordId={returnId || undefined}
      requiredCommand={requiredCommand}
      {...EFFECTIVE_RECORD_ACCESS_PROFILES.returns}
    >
      <ReturnFormScreen />
    </EffectiveRecordAccessBoundary>
  );
};
