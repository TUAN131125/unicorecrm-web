import { validateEmail, validatePhone } from "@/shared/lib/contactDataValidation";
import type { ExecuteLeadDirectSaleCommand, ExecuteLeadOpportunityCommand, LeadRelationshipInput } from "./leadQualification.types";

export type LeadQualificationFieldErrors = Partial<Record<
  | "outcome"
  | "relationship.selectedId"
  | "relationship.contact.name"
  | "relationship.contact.email"
  | "relationship.contact.phone"
  | "relationship.organization.displayName"
  | "relationship.organization.email"
  | "relationship.organization.phone"
  | "deal.name"
  | "deal.needSummary"
  | "deal.ownerId"
  | "deal.expectedCloseDate"
  | "deal.estimatedValue"
  | "deal.interestedProducts"
  | "deal.followUpTaskTitle"
  | "deal.followUpTaskDueAt"
  | "disqualified.reason"
  | "disqualified.evidence"
  | "nurture.revisitAt"
  | "nurture.reason",
  string
>>;

export class LeadQualificationValidationError extends Error {
  readonly code = "LEAD_QUALIFICATION_INVALID";

  constructor(readonly fieldErrors: LeadQualificationFieldErrors) {
    super(Object.values(fieldErrors).join(" "));
    this.name = "LeadQualificationValidationError";
  }
}

function isValidDateValue(value?: string): boolean {
  if (!value?.trim()) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

export function validateRelationshipInput(relationship: LeadRelationshipInput): LeadQualificationFieldErrors {
  const errors: LeadQualificationFieldErrors = {};
  if (relationship.mode === "EXISTING" && !relationship.selectedId?.trim()) {
    errors["relationship.selectedId"] = "Select an existing relationship.";
  }
  if (relationship.mode === "NEW") {
    if (!relationship.contact.name.trim()) errors["relationship.contact.name"] = "Contact name is required.";
    if (relationship.kind === "ORGANIZATION_ACCOUNT" && !relationship.organization?.displayName.trim()) {
      errors["relationship.organization.displayName"] = "Organization name is required.";
    }
    if (relationship.contact.email && !validateEmail(relationship.contact.email).valid) errors["relationship.contact.email"] = "Enter a valid contact email address.";
    if (relationship.contact.phone && !validatePhone(relationship.contact.phone).valid) errors["relationship.contact.phone"] = "Enter a valid contact phone number.";
    if (relationship.organization?.email && !validateEmail(relationship.organization.email).valid) errors["relationship.organization.email"] = "Enter a valid organization email address.";
    if (relationship.organization?.phone && !validatePhone(relationship.organization.phone).valid) errors["relationship.organization.phone"] = "Enter a valid organization phone number.";
  }
  return errors;
}

export function getOpportunityFieldErrors(command: ExecuteLeadOpportunityCommand): LeadQualificationFieldErrors {
  const errors: LeadQualificationFieldErrors = { ...validateRelationshipInput(command.relationship) };
  if (!command.dealsEnabled) errors.outcome = "Deal module is disabled; OPPORTUNITY outcome is unavailable.";
  if (!command.deal.name.trim()) errors["deal.name"] = "Opportunity name is required.";
  if (!command.deal.ownerId.trim()) errors["deal.ownerId"] = "Opportunity requires an owner.";

  const hasNeedSummary = Boolean(command.deal.needSummary?.trim());
  const hasInterestedProducts = command.deal.interestedProductIds.length > 0;
  if (!hasNeedSummary && !hasInterestedProducts) {
    const message = "Describe the customer need or select at least one interested product or service.";
    errors["deal.needSummary"] = message;
    errors["deal.interestedProducts"] = message;
  }

  if (command.deal.expectedCloseDate && !isValidDateValue(command.deal.expectedCloseDate)) {
    errors["deal.expectedCloseDate"] = "Enter a valid target close date.";
  }
  if (command.deal.estimatedValue !== undefined && (!Number.isFinite(command.deal.estimatedValue) || command.deal.estimatedValue < 0)) {
    errors["deal.estimatedValue"] = "Estimated value must be a finite, non-negative number.";
  }
  if (command.deal.followUpTask) {
    if (!command.deal.followUpTask.title.trim()) errors["deal.followUpTaskTitle"] = "Task title is required.";
    if (!isValidDateValue(command.deal.followUpTask.dueAt)) errors["deal.followUpTaskDueAt"] = "Enter a valid task due date.";
  }
  return errors;
}

export function assertValidRelationshipInput(relationship: LeadRelationshipInput): void {
  const fieldErrors = validateRelationshipInput(relationship);
  if (Object.keys(fieldErrors).length > 0) throw new LeadQualificationValidationError(fieldErrors);
}

export function assertValidOpportunityCommand(command: ExecuteLeadOpportunityCommand): void {
  const fieldErrors = getOpportunityFieldErrors(command);
  if (Object.keys(fieldErrors).length > 0) throw new LeadQualificationValidationError(fieldErrors);
}

export function validateOpportunityEntryCriteria(command: ExecuteLeadOpportunityCommand): string[] {
  return Object.values(getOpportunityFieldErrors(command));
}

export function validateDirectSaleReadiness(command: ExecuteLeadDirectSaleCommand): string[] {
  const errors: string[] = [];
  if (!command.actorCanSellNow) errors.push("Actor is not permitted to Sell Now.");
  if (command.path === "QUOTE" && !command.quoteEnabled) errors.push("Quote path is unavailable because Quote is disabled.");
  if (command.path === "ORDER" && !command.orderEnabled) errors.push("Order path is unavailable because Order is disabled.");
  if (command.lineItems.length === 0) errors.push("Direct Sale requires at least one product or controlled line item.");
  command.lineItems.forEach((item, index) => {
    if (!item.name.trim()) errors.push(`Line ${index + 1} requires a product/service name.`);
    if (item.quantity <= 0) errors.push(`Line ${index + 1} quantity must be greater than zero.`);
    if (item.unitPrice < 0) errors.push(`Line ${index + 1} price cannot be negative.`);
  });
  return errors;
}
