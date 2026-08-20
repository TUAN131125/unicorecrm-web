import type { HttpClient } from "@/platform/api";
import {
  assertCompleteApplicationServiceBundle,
  type ApplicationModuleServiceBundle,
  type ApplicationServiceBundle,
} from "./applicationServiceBundle";
import { createConnectedCommercialModuleServices } from "./connected/connectedCommercialModuleServices";
import { createConnectedCrmModuleServices } from "./connected/connectedCrmModuleServices";
import { createConnectedFinancialModuleServices } from "./connected/connectedFinancialModuleServices";
import {
  createConnectedWorkflowServices,
  createConnectedWorkspaceServices,
} from "./connected/connectedWorkflowServices";

export interface ConnectedApplicationTelemetryEvent {
  name: "connected.application-services.created";
  moduleCount: number;
  workflowCount: number;
}

export interface ConnectedApplicationRuntimeProviders {
  telemetry?(event: ConnectedApplicationTelemetryEvent): void | Promise<void>;
}

export function createConnectedApplicationServiceBundle(
  httpClient: HttpClient,
  runtimeProviders: ConnectedApplicationRuntimeProviders = {},
): ApplicationServiceBundle {
  const crm = createConnectedCrmModuleServices(httpClient);
  const commercial = createConnectedCommercialModuleServices(httpClient);
  const financial = createConnectedFinancialModuleServices(httpClient);
  const modules: ApplicationModuleServiceBundle = {
    ...crm,
    ...commercial,
    ...financial,
  };
  const services: ApplicationServiceBundle = {
    modules,
    workflows: createConnectedWorkflowServices(modules),
    workspaces: createConnectedWorkspaceServices(),
  };

  assertCompleteApplicationServiceBundle(services, "Connected application composition");
  reportTelemetry(runtimeProviders.telemetry, {
    name: "connected.application-services.created",
    moduleCount: Object.keys(services.modules).length,
    workflowCount: Object.keys(services.workflows).length,
  });
  return services;
}

function reportTelemetry(
  telemetry: ConnectedApplicationRuntimeProviders["telemetry"],
  event: ConnectedApplicationTelemetryEvent,
): void {
  if (!telemetry) return;
  try {
    void Promise.resolve(telemetry(event)).catch(() => undefined);
  } catch {
    // Telemetry is observational and must not prevent fail-closed application startup.
  }
}
