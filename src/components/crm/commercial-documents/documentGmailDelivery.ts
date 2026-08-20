import type { DocumentPdfResult } from "./documentPdfExport";
import { downloadDocumentPdf } from "./documentPdfExport";

export interface DocumentGmailDeliveryInput {
  recipientEmail: string;
  subject: string;
  body: string;
  pdf: DocumentPdfResult;
  attachmentInstruction?: string;
}

export type DocumentGmailDeliveryMode = "SHARED_WITH_ATTACHMENT" | "GMAIL_COMPOSE_WITH_DOWNLOAD";

export async function launchDocumentGmailDelivery(input: DocumentGmailDeliveryInput): Promise<DocumentGmailDeliveryMode> {
  const file = new File([input.pdf.blob], input.pdf.fileName, { type: "application/pdf" });
  const sharePayload = { title: input.subject, text: input.body, files: [file] };
  const canShareFile = typeof navigator !== "undefined"
    && typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare(sharePayload);

  if (canShareFile) {
    await navigator.share(sharePayload);
    return "SHARED_WITH_ATTACHMENT";
  }

  downloadDocumentPdf(input.pdf);
  const gmailUrl = new URL("https://mail.google.com/mail/");
  gmailUrl.searchParams.set("view", "cm");
  gmailUrl.searchParams.set("fs", "1");
  gmailUrl.searchParams.set("to", input.recipientEmail);
  gmailUrl.searchParams.set("su", input.subject);
  const attachmentInstruction = input.attachmentInstruction
    ?? `Tệp PDF đã được tải xuống từ CRM. Hãy đính kèm tệp ${input.pdf.fileName} trước khi gửi.`;
  gmailUrl.searchParams.set("body", `${input.body}\n\n${attachmentInstruction}`);
  window.open(gmailUrl.toString(), "_blank", "noopener,noreferrer");
  return "GMAIL_COMPOSE_WITH_DOWNLOAD";
}
