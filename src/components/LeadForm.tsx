import React from "react";
import { useLeadFormController, type LeadFormProps } from "../modules/leads/presentation/hooks/useLeadFormController";
import { LeadFormView } from "../modules/leads/presentation/components/LeadFormView";

export const LeadForm: React.FC<LeadFormProps> = (props) => {
  const controller = useLeadFormController(props);
  return <LeadFormView controller={controller} />;
};
