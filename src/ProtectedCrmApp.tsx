import React from "react";
import { PlatformStateProvider } from "@/app/providers";
import { CrmApplicationShell } from "@/app/shell";
import { GuidanceProvider } from "@/guidance";

export const ProtectedCrmApp: React.FC = () => (
  <PlatformStateProvider>
    <GuidanceProvider>
      <CrmApplicationShell />
    </GuidanceProvider>
  </PlatformStateProvider>
);

export default ProtectedCrmApp;
