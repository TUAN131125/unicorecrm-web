import { isBusinessOperationUnavailable } from "@/shared/application";

/**
 * Availability of WF-01 (contact-opportunity-creation) in the active runtime.
 *
 * WF-01 is canonically `BLOCKED` with `connectedFrontendCoordinatorAllowed: false`, and no
 * backend workflow operation exists for it. Connected mode therefore has no authoritative
 * way to create an opportunity for a Contact and link the Contact to it, and the frontend
 * must not substitute a sequence of module commands for the missing workflow.
 *
 * The refusal has to belong to WF-01 itself. Refusing because Contact writes are blocked
 * happens to work today, but it is incidental: the day `updateContact` gains a production
 * contract, that guard turns off and the frontend coordinator becomes reachable while
 * WF-01 is still blocked. This predicate reads the runtime availability registry that the
 * connected composition writes when it binds the WF-01 ports, so the predicate and the
 * binding can never disagree, and demo mode — which declares nothing — stays available.
 */
export const CONTACT_OPPORTUNITY_CREATION_OPERATION = "WF-01 contact opportunity creation";

/** True when the active runtime cannot perform WF-01 authoritatively. */
export function isContactOpportunityCreationUnavailable(): boolean {
  return isBusinessOperationUnavailable(CONTACT_OPPORTUNITY_CREATION_OPERATION);
}
