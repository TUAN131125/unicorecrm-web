/**
 * Helper to consistently format phone numbers for display.
 * For Vietnamese 10-digit mobile numbers (e.g. 0901234567), formats as "090 123 4567".
 * For others, strips and formats where appropriate or preserves original.
 */
export const formatPhone = (phone: string | undefined | null): string => {
  if (!phone) return "";
  const cleaned = phone.replace(/\s+/g, ""); // remove existing spacing
  const digits = cleaned.replace(/\D/g, "");
  
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  
  return phone;
};
