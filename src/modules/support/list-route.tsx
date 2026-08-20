import React from "react";
import { SupportCaseListPage as SupportCaseListScreen } from "./presentation/pages/SupportCaseListPage";
import { useSupportReferences } from "./route-context";
export const SupportCaseListRoutePage: React.FC = () => <SupportCaseListScreen {...useSupportReferences()} />;
