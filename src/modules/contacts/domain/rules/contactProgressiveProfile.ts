import type { Contact, ContactStatus } from "../model/contact.types";

export type ContactCreateMode = "QUICK" | "COMPLETE";
export type ContactProfileField = "fullName" | "contactChannel" | "ownerId" | "nextFollowUpAt" | "organizationName";

export function getRequiredContactProfileFields(
  status: ContactStatus = "active",
  mode: ContactCreateMode = "COMPLETE",
): ContactProfileField[] {
  const required: ContactProfileField[] = ["fullName", "contactChannel", "ownerId"];
  if (mode === "QUICK" || status === "needs_follow_up") required.push("nextFollowUpAt");
  if (status === "has_open_opportunity") required.push("organizationName");
  return [...new Set(required)];
}

export function validateContactProgressiveProfile(
  contact: Partial<Contact>,
  status: ContactStatus = "active",
  mode: ContactCreateMode = "COMPLETE",
): ContactProfileField[] {
  return getRequiredContactProfileFields(status, mode).filter((field) => {
    if (field === "contactChannel") {
      return ![contact.phone, contact.mobilePhone, contact.workPhone, contact.email, contact.workEmail, contact.zaloId, contact.zalo]
        .some((value) => Boolean(value?.trim()));
    }
    return !String(contact[field] ?? "").trim();
  });
}
