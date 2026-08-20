export type ContactDataField = "phone" | "email";

export interface ContactDataValidationResult {
  valid: boolean;
  normalizedValue: string;
  reason?: "INVALID_CHARACTERS" | "INVALID_LENGTH" | "INVALID_FORMAT";
}

const PHONE_FORMATTING_CHARACTERS = /^[+\d\s().-]+$/;
const NORMALIZED_PHONE = /^\+?\d{8,15}$/;
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasInternationalPrefix = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return `${hasInternationalPrefix ? "+" : ""}${digits}`;
}

export function validatePhone(value: string): ContactDataValidationResult {
  const trimmed = value.trim();
  const normalizedValue = normalizePhone(trimmed);
  if (!trimmed) return { valid: true, normalizedValue: "" };
  if (!PHONE_FORMATTING_CHARACTERS.test(trimmed) || (trimmed.match(/\+/g)?.length ?? 0) > 1 || trimmed.includes("+") && !trimmed.startsWith("+")) {
    return { valid: false, normalizedValue, reason: "INVALID_CHARACTERS" };
  }
  if (!NORMALIZED_PHONE.test(normalizedValue)) {
    return { valid: false, normalizedValue, reason: "INVALID_LENGTH" };
  }
  return { valid: true, normalizedValue };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): ContactDataValidationResult {
  const normalizedValue = normalizeEmail(value);
  if (!normalizedValue) return { valid: true, normalizedValue: "" };
  if (!EMAIL_ADDRESS.test(normalizedValue)) return { valid: false, normalizedValue, reason: "INVALID_FORMAT" };
  return { valid: true, normalizedValue };
}

export function isValidPhone(value?: string): boolean {
  return !value || validatePhone(value).valid;
}

export function isValidEmail(value?: string): boolean {
  return !value || validateEmail(value).valid;
}
