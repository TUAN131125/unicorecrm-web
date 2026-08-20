import React from "react";
import { useWorkspaceConfigSnapshot } from "@/platform/workspace-config";
import { ContactListPage as ContactListScreen } from "./presentation/pages/ContactListPage";
import { useContactCommercialState } from "./route-context";

export const ContactListRoutePage: React.FC = () => {
  const commercial = useContactCommercialState();
  const crmConfig = useWorkspaceConfigSnapshot();
  return <ContactListScreen {...commercial} crmConfig={crmConfig} />;
};
