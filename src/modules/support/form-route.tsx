import React from "react";
import { useParams } from "react-router-dom";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { SupportCaseFormPage as SupportCaseFormScreen } from "./presentation/pages/SupportCaseFormPage";
import { useSupportReferences } from "./route-context";

export const SupportCaseFormRoutePage: React.FC = () => {
  const { caseId = "", supportCaseId = "" } = useParams();
  const recordId = caseId || supportCaseId;
  const requiredCommand = recordId ? "support.update" : "support.create";
  const references = useSupportReferences();
  return (
    <EffectiveRecordAccessBoundary
      resourceKey="support"
      recordId={recordId || undefined}
      requiredCommand={requiredCommand}
      {...EFFECTIVE_RECORD_ACCESS_PROFILES.support}
    >
      <SupportCaseFormScreen {...references} />
    </EffectiveRecordAccessBoundary>
  );
};
