import type { CapabilityPredicate, GuidanceLocale, GuidanceLocaleText } from "./guidance.types";

export const GUIDANCE_TARGET_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+){1,4}$/;
export const GUIDANCE_ID_PATTERN = /^(crm|studio|people|workflow|field)\.[a-z0-9-]+(?:\.[a-z0-9-]+)*$/;

export function localize(text: GuidanceLocaleText, locale: GuidanceLocale): string {
  return text[locale];
}

export function hasAllCapabilities(required: readonly string[] | undefined, can: CapabilityPredicate): boolean {
  return !required?.length || required.every(can);
}

export function hasAnyCapability(required: readonly string[] | undefined, can: CapabilityPredicate): boolean {
  return !required?.length || required.some(can);
}

export function normalizeGuidanceSearch(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
