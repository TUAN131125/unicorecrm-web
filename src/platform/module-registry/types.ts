import type { ComponentType, LazyExoticComponent } from "react";

export type WorkspaceKey = "crm" | "studio" | "people";
export type ModuleKey = string;

export interface ModuleRouteContribution {
  id: string;
  path: string;
  page?: LazyExoticComponent<ComponentType<any>> | ComponentType<any>;
}

export interface ModuleNavigationContribution {
  id: string;
  path: string;
  labelKey: string;
  order?: number;
}

export interface FrontendModuleManifest {
  key: ModuleKey;
  workspace: WorkspaceKey;
  routes: readonly ModuleRouteContribution[];
  navigation?: readonly ModuleNavigationContribution[];
  requiredPermissions?: readonly string[];
}
