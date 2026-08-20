import { formatApplicationError } from "@/shared/operations";
import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Input, Modal, Select, Textarea } from "@/shared/components/ui";
import type { QuoteDeliveryChannel } from "../../domain/model/quote.types";

export interface QuoteDeliveryConfirmationValue {
  channel: QuoteDeliveryChannel;
  recipientEmail?: string;
  recipient?: string;
  note?: string;
  sentAt: string;
  fileName?: string;
}

interface QuoteDeliveryConfirmationModalProps {
  isOpen: boolean;
  quoteNumber: string;
  locale: string;
  initialChannel?: QuoteDeliveryChannel;
  initialRecipientEmail?: string;
  initialRecipient?: string;
  initialFileName?: string;
  channelLocked?: boolean;
  onClose(): void;
  onConfirm(value: QuoteDeliveryConfirmationValue): void | Promise<void>;
}

const CUSTOMER_CHANNELS: QuoteDeliveryChannel[] = ["GMAIL", "EMAIL", "ZALO", "CHAT_APP", "SMS", "OTHER"];

const channelLabel = (channel: QuoteDeliveryChannel, vi: boolean): string => ({
  GMAIL: "Gmail",
  EMAIL: vi ? "Email khác" : "Other email",
  ZALO: "Zalo",
  CHAT_APP: vi ? "Ứng dụng chat" : "Chat app",
  SMS: "SMS",
  OTHER: vi ? "Kênh khác" : "Other channel",
  PDF: "PDF",
})[channel];

function currentLocalDateTime(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export const QuoteDeliveryConfirmationModal: React.FC<QuoteDeliveryConfirmationModalProps> = ({
  isOpen,
  quoteNumber,
  locale,
  initialChannel = "ZALO",
  initialRecipientEmail = "",
  initialRecipient = "",
  initialFileName,
  channelLocked = false,
  onClose,
  onConfirm,
}) => {
  const vi = locale === "vi";
  const [channel, setChannel] = React.useState<QuoteDeliveryChannel>(initialChannel);
  const [recipientEmail, setRecipientEmail] = React.useState(initialRecipientEmail);
  const [recipient, setRecipient] = React.useState(initialRecipient);
  const [sentAt, setSentAt] = React.useState(currentLocalDateTime);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setChannel(initialChannel);
    setRecipientEmail(initialRecipientEmail);
    setRecipient(initialRecipient);
    setSentAt(currentLocalDateTime());
    setNote("");
    setError("");
    setBusy(false);
  }, [isOpen, initialChannel, initialRecipientEmail, initialRecipient]);

  const emailChannel = channel === "GMAIL" || channel === "EMAIL";

  const submit = async () => {
    const email = recipientEmail.trim();
    const destination = recipient.trim();
    if (emailChannel && !/^\S+@\S+\.\S+$/.test(email)) {
      setError(vi ? "Hãy nhập email người nhận hợp lệ." : "Enter a valid recipient email.");
      return;
    }
    if (!emailChannel && !destination) {
      setError(vi ? "Hãy nhập người nhận, số điện thoại hoặc tài khoản đích." : "Enter the recipient, phone number, or destination account.");
      return;
    }
    const parsedSentAt = new Date(sentAt);
    if (!sentAt || Number.isNaN(parsedSentAt.getTime())) {
      setError(vi ? "Thời điểm gửi không hợp lệ." : "The sent time is invalid.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onConfirm({
        channel,
        recipientEmail: emailChannel ? email : undefined,
        recipient: emailChannel ? undefined : destination,
        note: note.trim() || undefined,
        sentAt: parsedSentAt.toISOString(),
        fileName: initialFileName,
      });
    } catch (caught) {
      setError(formatApplicationError(caught, { locale }));
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => undefined : onClose}
      size="md"
      variant="form"
      title={vi ? "Xác nhận Báo giá đã được gửi" : "Confirm quote delivery"}
      footer={(
        <>
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>{vi ? "Chưa gửi" : "Not sent yet"}</Button>
          <Button
            type="button"
            variant="success"
            loading={busy}
            icon={<CheckCircle2 size={13} />}
            data-guidance-id="quotes.delivery.confirm"
            onClick={() => { void submit(); }}
          >
            {vi ? "Xác nhận đã gửi" : "Confirm sent"}
          </Button>
        </>
      )}
    >
      <div className="crm-form-surface space-y-4 text-sm text-slate-600">
        <p>
          {vi
            ? "Chỉ xác nhận sau khi Báo giá đã thực sự được gửi. CRM sẽ chuyển trạng thái sang Đã gửi và lưu kênh liên hệ làm bằng chứng."
            : "Confirm only after the quote was actually delivered. CRM will move it to Sent and retain the contact channel as evidence."}
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <strong>{vi ? "Báo giá" : "Quote"}:</strong> {quoteNumber}
          {initialFileName && <div className="mt-1"><strong>PDF:</strong> {initialFileName}</div>}
        </div>

        {channelLocked ? (
          <Input id="quote-delivery-channel-locked" label={vi ? "Kênh gửi" : "Delivery channel"} value={channelLabel(channel, vi)} disabled />
        ) : (
          <Select
            id="quote-delivery-channel"
            label={vi ? "Kênh gửi *" : "Delivery channel *"}
            value={channel}
            onChange={(event) => { setChannel(event.target.value as QuoteDeliveryChannel); setError(""); }}
          >
            {CUSTOMER_CHANNELS.map((item) => <option key={item} value={item}>{channelLabel(item, vi)}</option>)}
          </Select>
        )}

        {emailChannel ? (
          <Input
            id="quote-delivery-email"
            type="email"
            label={vi ? "Email người nhận *" : "Recipient email *"}
            value={recipientEmail}
            onChange={(event) => { setRecipientEmail(event.target.value); setError(""); }}
            placeholder="customer@example.com"
          />
        ) : (
          <Input
            id="quote-delivery-recipient"
            label={vi ? "Người nhận / tài khoản đích *" : "Recipient / destination account *"}
            value={recipient}
            onChange={(event) => { setRecipient(event.target.value); setError(""); }}
            placeholder={vi ? "Tên, số điện thoại hoặc tài khoản" : "Name, phone number, or account"}
          />
        )}

        <Input
          id="quote-delivery-sent-at"
          type="datetime-local"
          label={vi ? "Thời điểm đã gửi *" : "Sent at *"}
          value={sentAt}
          onChange={(event) => { setSentAt(event.target.value); setError(""); }}
        />

        <Textarea
          id="quote-delivery-note"
          label={vi ? "Ghi chú / mã tham chiếu" : "Note / reference"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder={vi ? "Ví dụ: Đã gửi cho khách qua Zalo, khách đã nhận file." : "For example: Sent via Zalo and the customer received the file."}
        />

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
      </div>
    </Modal>
  );
};
