import { STUDIO_SCREEN_GUIDANCE } from "@/guidance/content/studio/configuration";
import { CRM_SCREEN_GUIDANCE } from "@/guidance/content/crm/screens";
import { CRM_EXTENDED_SCREEN_GUIDANCE } from "@/guidance/content/crm/extendedScreens";
import { PEOPLE_SCREEN_GUIDANCE } from "@/guidance/content/people/screens";
import { PEOPLE_EXTENDED_SCREEN_GUIDANCE } from "@/guidance/content/people/extendedScreens";
import { WORKFLOW_GUIDANCE } from "@/guidance/content/workflows/workflows";
import { FIELD_GUIDANCE } from "@/guidance/content/fields/fields";
import { GUIDANCE_CHECKLISTS } from "@/guidance/content/checklists";
import { validateGuidanceRegistry } from "@/guidance/domain/guidance.validation";
import { ensureScreenWalkthrough } from "@/guidance/content/shared/createScreenGuidance";

export const SCREEN_GUIDANCE = [
  ...CRM_SCREEN_GUIDANCE,
  ...CRM_EXTENDED_SCREEN_GUIDANCE,
  ...STUDIO_SCREEN_GUIDANCE,
  
  ...PEOPLE_SCREEN_GUIDANCE,
  ...PEOPLE_EXTENDED_SCREEN_GUIDANCE,
].map(ensureScreenWalkthrough);

export const GUIDANCE_WORKFLOWS = WORKFLOW_GUIDANCE;
export const GUIDANCE_FIELDS = FIELD_GUIDANCE;
export const CHECKLISTS = GUIDANCE_CHECKLISTS;

export const SCREEN_GUIDANCE_BY_ID = new Map(SCREEN_GUIDANCE.map((item) => [item.id, item]));
export const SCREEN_GUIDANCE_BY_ROUTE_KEY = new Map(SCREEN_GUIDANCE.map((item) => [item.routeKey, item]));
export const WORKFLOW_GUIDANCE_BY_ID = new Map(GUIDANCE_WORKFLOWS.map((item) => [item.id, item]));
export const FIELD_GUIDANCE_BY_KEY = new Map(GUIDANCE_FIELDS.map((item) => [item.helpKey, item]));

const validationErrors = validateGuidanceRegistry({
  screens: SCREEN_GUIDANCE,
  workflows: GUIDANCE_WORKFLOWS,
  fields: GUIDANCE_FIELDS,
  checklists: CHECKLISTS,
});

if (validationErrors.length > 0) {
  throw new Error(`Invalid guidance registry:\n${validationErrors.join("\n")}`);
}
