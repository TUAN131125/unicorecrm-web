import React from "react";
import { Navigate, useParams } from "react-router-dom";

export const LegacyLeadConvertRedirect: React.FC = () => {
  const { leadId } = useParams();
  return <Navigate to={leadId ? `/leads/${leadId}/qualify` : "/leads"} replace />;
};
