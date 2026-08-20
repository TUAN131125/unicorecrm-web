import type { QuotePdfResult } from "./quotePdfExport";
import { downloadQuotePdf } from "./quotePdfExport";

export interface QuoteGmailDeliveryInput {
  recipientEmail: string;
  subject: string;
  body: string;
  pdf: QuotePdfResult;
}

export type QuoteGmailDeliveryMode = "SHARED_WITH_ATTACHMENT" | "GMAIL_COMPOSE_WITH_DOWNLOAD";

export async function launchQuoteGmailDelivery(input: QuoteGmailDeliveryInput): Promise<QuoteGmailDeliveryMode> {
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

  downloadQuotePdf(input.pdf);
  const gmailUrl = new URL("https://mail.google.com/mail/");
  gmailUrl.searchParams.set("view", "cm");
  gmailUrl.searchParams.set("fs", "1");
  gmailUrl.searchParams.set("to", input.recipientEmail);
  gmailUrl.searchParams.set("su", input.subject);
  gmailUrl.searchParams.set("body", `${input.body}\n\nTệp PDF đã được tải xuống từ CRM. Hãy đính kèm tệp ${input.pdf.fileName} trước khi gửi.`);
  window.open(gmailUrl.toString(), "_blank", "noopener,noreferrer");
  return "GMAIL_COMPOSE_WITH_DOWNLOAD";
}
