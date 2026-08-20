import { GUIDANCE_ID_PATTERN, GUIDANCE_TARGET_PATTERN } from "./guidance.rules";
import type { FieldGuidance, GuidanceChecklist, ScreenGuidance, WorkflowGuidance } from "./guidance.types";

export type GuidanceValidationInput = {
  screens: readonly ScreenGuidance[];
  workflows: readonly WorkflowGuidance[];
  fields: readonly FieldGuidance[];
  checklists: readonly GuidanceChecklist[];
};

export function validateGuidanceRegistry(input: GuidanceValidationInput): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const register = (id: string, kind: string) => {
    if (!GUIDANCE_ID_PATTERN.test(id)) errors.push(`${kind} has invalid id: ${id}`);
    if (ids.has(id)) errors.push(`Duplicate guidance id: ${id}`);
    ids.add(id);
  };
  const validateText = (owner: string, field: string, value?: { vi?: string; en?: string }) => {
    if (!value?.vi?.trim() || !value?.en?.trim()) errors.push(`${owner}.${field} must include vi and en`);
  };

  for (const screen of input.screens) {
    register(screen.id, "Screen guidance");
    validateText(screen.id, "title", screen.title);
    validateText(screen.id, "purpose", screen.purpose);
    if (!screen.routeKey) errors.push(`${screen.id} must declare routeKey`);
    if (!Number.isInteger(screen.version) || screen.version < 1) errors.push(`${screen.id} has invalid version`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(screen.reviewedAt)) errors.push(`${screen.id} has invalid reviewedAt`);
    if (!screen.owner.trim()) errors.push(`${screen.id} must declare owner`);
    for (const task of screen.primaryTasks) validateText(`${screen.id}.${task.id}`, "text", task.text);
    for (const step of screen.steps || []) {
      validateText(`${screen.id}.${step.id}`, "title", step.title);
      validateText(`${screen.id}.${step.id}`, "body", step.body);
      if (!GUIDANCE_TARGET_PATTERN.test(step.targetId)) errors.push(`${screen.id}.${step.id} has invalid targetId: ${step.targetId}`);
    }
  }

  for (const workflow of input.workflows) {
    register(workflow.id, "Workflow guidance");
    validateText(workflow.id, "title", workflow.title);
    validateText(workflow.id, "summary", workflow.summary);
    for (const step of workflow.steps) {
      validateText(`${workflow.id}.${step.id}`, "title", step.title);
      validateText(`${workflow.id}.${step.id}`, "body", step.body);
    }
  }

  for (const field of input.fields) {
    register(field.helpKey, "Field guidance");
    validateText(field.helpKey, "title", field.title);
    validateText(field.helpKey, "purpose", field.purpose);
  }

  for (const checklist of input.checklists) {
    register(checklist.id, "Guidance checklist");
    validateText(checklist.id, "title", checklist.title);
    validateText(checklist.id, "description", checklist.description);
    for (const item of checklist.items) {
      validateText(`${checklist.id}.${item.id}`, "title", item.title);
      validateText(`${checklist.id}.${item.id}`, "description", item.description);
    }
  }

  return errors;
}
