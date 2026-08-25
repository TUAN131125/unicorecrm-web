/**
 * The address a verification screen is working on.
 *
 * The screen never guesses. It reads the address the previous screen handed it through the
 * history entry's navigation state, and nothing else. Without that state it has no subject
 * and must send the visitor back rather than submit an empty or invented address.
 *
 * Navigation state is the only accepted source on purpose. It rides in the history entry, so
 * it survives a reload of the same entry without putting the address in a shareable URL, and
 * only same-origin script can write it. A URL parameter would be the opposite on both counts:
 * a crafted link could name any address, render it inside the product's own branding, and
 * turn the resend control into a mail trigger someone else chose the recipient for.
 *
 * Nothing about this value is authority. It selects which address the visitor is asked
 * about; the server alone decides what that address is entitled to.
 */
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

export interface EmailVerificationNavigationState {
  email: string;
}

/** Builds the navigation state a screen hands to the verification screen. */
export function emailVerificationNavigationState(email: string): EmailVerificationNavigationState {
  return { email: email.trim() };
}

/**
 * A deliberately permissive shape check. The server owns address validity; this only
 * rejects values that could not be an address at all, so the screen never submits one.
 */
export function isPlausibleEmailAddress(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  if (/\s/u.test(trimmed)) return false;
  const at = trimmed.indexOf("@");
  return at > 0 && at === trimmed.lastIndexOf("@") && at < trimmed.length - 1 && trimmed.includes(".", at);
}

/**
 * Resolves the address to verify from navigation state alone. Returns undefined when the
 * screen has no subject, which is the signal to offer recovery instead of sending anything.
 */
export function resolveEmailVerificationSubject(navigationState: unknown): string | undefined {
  if (!navigationState || typeof navigationState !== "object") return undefined;
  const candidate = (navigationState as { email?: unknown }).email;
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  return isPlausibleEmailAddress(trimmed) ? trimmed : undefined;
}
