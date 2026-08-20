import type { Lead } from "../model/lead.types";

export const LeadContactChannel = {
  CALL: "CALL",
  EMAIL: "EMAIL",
  SMS: "SMS",
} as const;

export type LeadContactChannel = typeof LeadContactChannel[keyof typeof LeadContactChannel];

export type LeadContactPolicyReason =
  | "MISSING_PHONE"
  | "MISSING_EMAIL"
  | "DO_NOT_CALL"
  | "DO_NOT_SMS"
  | "DO_NOT_EMAIL";

export interface LeadContactPolicyDecision {
  allowed: boolean;
  reason?: LeadContactPolicyReason;
}

export function evaluateLeadContactPolicy(
  lead: Pick<Lead, "phone" | "email" | "doNotCall" | "doNotEmail" | "doNotSms" | "consent">,
  channel: LeadContactChannel,
): LeadContactPolicyDecision {
  if (channel === LeadContactChannel.EMAIL) {
    if (!lead.email?.trim()) return { allowed: false, reason: "MISSING_EMAIL" };
    if (lead.doNotEmail || ["DENIED", "WITHDRAWN"].includes(lead.consent?.current.EMAIL ?? "")) return { allowed: false, reason: "DO_NOT_EMAIL" };
    return { allowed: true };
  }

  if (!lead.phone?.trim()) return { allowed: false, reason: "MISSING_PHONE" };
  if (channel === LeadContactChannel.SMS) {
    if (lead.doNotCall) return { allowed: false, reason: "DO_NOT_CALL" };
    if (lead.doNotSms || ["DENIED", "WITHDRAWN"].includes(lead.consent?.current.SMS ?? "")) return { allowed: false, reason: "DO_NOT_SMS" };
    return { allowed: true };
  }
  if (lead.doNotCall || ["DENIED", "WITHDRAWN"].includes(lead.consent?.current.CALL ?? "")) return { allowed: false, reason: "DO_NOT_CALL" };
  return { allowed: true };
}

export function assertLeadContactAllowed(
  lead: Pick<Lead, "phone" | "email" | "doNotCall" | "doNotEmail" | "doNotSms" | "consent">,
  channel: LeadContactChannel,
): void {
  const decision = evaluateLeadContactPolicy(lead, channel);
  if (decision.allowed) return;

  const messages: Record<LeadContactPolicyReason, string> = {
    MISSING_PHONE: "Lead does not have a phone number for this communication channel.",
    MISSING_EMAIL: "Lead does not have an email address for this communication channel.",
    DO_NOT_CALL: "Lead has opted out of phone and SMS contact.",
    DO_NOT_SMS: "Lead has opted out of SMS contact.",
    DO_NOT_EMAIL: "Lead has opted out of email contact.",
  };
  throw new Error(messages[decision.reason!]);
}

export function getLeadContactPolicyMessage(
  reason: LeadContactPolicyReason | undefined,
  locale: string,
): string {
  const vi = locale === "vi";
  switch (reason) {
    case "MISSING_PHONE":
      return vi ? "Lead chưa có số điện thoại hợp lệ." : "The Lead does not have a valid phone number.";
    case "MISSING_EMAIL":
      return vi ? "Lead chưa có địa chỉ email hợp lệ." : "The Lead does not have a valid email address.";
    case "DO_NOT_CALL":
      return vi ? "Lead đã từ chối nhận cuộc gọi và tin nhắn qua số điện thoại." : "The Lead has opted out of phone calls and SMS messages.";
    case "DO_NOT_SMS":
      return vi ? "Lead đã từ chối nhận tin nhắn SMS." : "The Lead has opted out of SMS messages.";
    case "DO_NOT_EMAIL":
      return vi ? "Lead đã từ chối nhận email." : "The Lead has opted out of email communication.";
    default:
      return vi ? "Không thể thực hiện liên hệ trên kênh này." : "Communication is not allowed on this channel.";
  }
}
