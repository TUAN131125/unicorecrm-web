import React from "react";
import { useLeadQualificationController } from "../hooks/useLeadQualificationController";
import { LeadQualificationView } from "../views/LeadQualificationView";
export const LeadQualificationPage: React.FC = () => <LeadQualificationView model={useLeadQualificationController()} />;
