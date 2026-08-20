import type { Lead } from "../model/lead.types";
import { validateEmail, validatePhone } from "@/shared/lib/contactDataValidation";

export type LeadContactField = "phone" | "workPhone" | "otherPhone" | "email" | "personalEmail";
export type LeadBusinessContactField = "zaloId" | "facebook" | "preferredChannel" | "expectedValue";
export type LeadValidatedDataField = LeadContactField | LeadBusinessContactField;
export type LeadContactFieldErrors = Partial<Record<LeadValidatedDataField, string>>;

export class LeadContactDataError extends Error {
  readonly code = "LEAD_CONTACT_DATA_INVALID";

  constructor(readonly fieldErrors: LeadContactFieldErrors) {
    super("Lead contains invalid contact-channel or expected-value data.");
    this.name = "LeadContactDataError";
  }
}

export function validateLeadContactData(lead: Partial<Pick<Lead, LeadValidatedDataField>>): LeadContactFieldErrors {
  const errors: LeadContactFieldErrors = {};
  (["phone", "workPhone", "otherPhone"] as const).forEach((field) => {
    const value = lead[field];
    if (value && !validatePhone(value).valid) errors[field] = "Enter a valid phone number (8–15 digits; spaces, dashes and + are allowed).";
  });
  (["email", "personalEmail"] as const).forEach((field) => {
    const value = lead[field];
    if (value && !validateEmail(value).valid) errors[field] = "Enter a valid email address.";
  });

  if (lead.expectedValue !== undefined && (!Number.isFinite(lead.expectedValue) || lead.expectedValue < 0)) {
    errors.expectedValue = "Expected value must be zero or greater.";
  }

  if (lead.preferredChannel) {
    const preferredChannelIsAvailable = lead.preferredChannel === "phone"
      ? Boolean(lead.phone || lead.workPhone || lead.otherPhone)
      : lead.preferredChannel === "email"
        ? Boolean(lead.email || lead.personalEmail)
        : lead.preferredChannel === "zalo"
          ? Boolean(lead.zaloId)
          : lead.preferredChannel === "facebook"
            ? Boolean(lead.facebook)
            : lead.preferredChannel === "other";
    if (!preferredChannelIsAvailable) {
      errors.preferredChannel = "Preferred contact channel must reference an available Lead contact channel.";
    }
  }
  return errors;
}

export function assertValidLeadContactData(lead: Partial<Pick<Lead, LeadValidatedDataField>>): void {
  const errors = validateLeadContactData(lead);
  if (Object.keys(errors).length > 0) throw new LeadContactDataError(errors);
}
