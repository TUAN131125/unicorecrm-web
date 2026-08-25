/**
 * Declares the platform configuration writes connected mode cannot perform authoritatively.
 *
 * Integration connections, developer webhooks and CRM object schemas are held by platform
 * singletons backed by browser storage, not by module application services, so there is no
 * port for the connected composition to bind and attach a declaration to. Declaring them
 * here keeps the availability registry owned by composition exactly as a port binding would:
 * the platform runtime fails closed on the same operation label its Studio view reads for
 * its preflight, so affordance and authority cannot drift.
 *
 * A demo composition declares nothing, so demo configuration behaviour is unchanged.
 */
import {
  CONNECTED_UNAVAILABLE_CONFIGURATION_OPERATIONS,
} from "@/platform/connected-configuration/connectedConfigurationAvailability";
import { declareUnavailableConnectedWorkflow } from "./connectedProjectionRepositories";

export function declareConnectedPlatformConfigurationUnavailability(): void {
  for (const operation of CONNECTED_UNAVAILABLE_CONFIGURATION_OPERATIONS) {
    declareUnavailableConnectedWorkflow(operation);
  }
}
