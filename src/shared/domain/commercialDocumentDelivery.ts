export type CustomerDocumentDeliveryChannel =
  | "GMAIL"
  | "EMAIL"
  | "ZALO"
  | "CHAT_APP"
  | "SMS"
  | "OTHER"
  | "PDF";

export type CustomerDocumentDeliveryEvidenceType = "USER_CONFIRMED_SENT" | "PROVIDER_ACCEPTED" | "PROVIDER_DELIVERED";

export interface CustomerDocumentDeliveryValue {
  channel: CustomerDocumentDeliveryChannel;
  evidenceType?: CustomerDocumentDeliveryEvidenceType;
  recipientEmail?: string;
  recipient?: string;
  note?: string;
  sentAt: string;
  fileName?: string;
}

export interface CustomerDocumentDeliveryRecord extends CustomerDocumentDeliveryValue {
  id: string;
  sentBy?: string;
  contentFingerprint: string;
}
