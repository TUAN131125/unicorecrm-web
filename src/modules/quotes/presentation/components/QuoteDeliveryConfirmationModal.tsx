import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { formatApplicationError } from "@/shared/operations";
import React from "react";
import { createDurableId } from "@/shared/ids";
import { CheckCircle2 } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, Select, Textarea } from "@/shared/components/ui";
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
  /** Complete authoritative command path; true means delivery evidence was persisted. */
  onSave?(value: QuoteDeliveryConfirmationValue, deliveryId: string): Promise<boolean>;
  targetId?: string;
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
  onSave,
  targetId = quoteNumber,
}) => {
  const vi = locale === "vi";
  const [channel, setChannel] = React.useState<QuoteDeliveryChannel>(initialChannel);
  const [recipientEmail, setRecipientEmail] = React.useState(initialRecipientEmail);
  const [recipient, setRecipient] = React.useState(initialRecipient);
  const [sentAt, setSentAt] = React.useState(currentLocalDateTime);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const workspaceId = useWorkspaceContextSnapshot().workspaceId;
  const liveWorkspace = React.useRef(workspaceId); liveWorkspace.current = workspaceId;
  const openRef = React.useRef(isOpen); openRef.current = isOpen;
  const liveTarget = React.useRef(targetId); liveTarget.current = targetId;
  const registration = React.useRef<object | undefined>(undefined);
  const previousOpen = React.useRef(false);
  const pending = React.useRef(false);
  const mounted = React.useRef(true);
  const cycle = React.useRef(0);
  const opening = React.useRef({ workspaceId, quoteNumber, targetId, initialFileName, channelLocked, onConfirm, onSave, onClose });
  const attempts = React.useRef(new Map<string, string>());
  const fingerprint = JSON.stringify({ channel, recipientEmail: recipientEmail.trim(), recipient: recipient.trim(), sentAt, note: note.trim() });
  const baseline = React.useRef(fingerprint);
  const dirty = baseline.current !== fingerprint;
  const reset = () => { setChannel(initialChannel); setRecipientEmail(initialRecipientEmail); setRecipient(initialRecipient); setSentAt(currentLocalDateTime()); setNote(""); setError(""); };
  const guard = useUnsavedChangesGuard(() => { reset(); opening.current.onClose(); });
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => {
    if (isOpen && !pending.current && (!previousOpen.current || (opening.current.quoteNumber !== quoteNumber && !dirty))) {
      cycle.current += 1;
      opening.current = { workspaceId, quoteNumber, targetId, initialFileName, channelLocked, onConfirm, onSave, onClose };
      attempts.current.clear();
      const time = currentLocalDateTime();
      setChannel(initialChannel); setRecipientEmail(initialRecipientEmail); setRecipient(initialRecipient); setSentAt(time); setNote(""); setError("");
      baseline.current = JSON.stringify({ channel: initialChannel, recipientEmail: initialRecipientEmail.trim(), recipient: initialRecipient.trim(), sentAt: time, note: "" });
    }
    if (!isOpen && previousOpen.current) cycle.current += 1;
    if (!isOpen || !pending.current) previousOpen.current = isOpen;
    guard.setIsDirty(isOpen && dirty);
  });
  React.useEffect(() => {
    if (!isOpen) return;
    const capturedCycle = cycle.current;
    const token = {}; registration.current = token;
    const ownsEntry = () => mounted.current && openRef.current && cycle.current === capturedCycle && registration.current === token;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (dirty || busy) window.addEventListener("beforeunload", warn);
    const unregister = registerUnsavedWork({ id: `quote-delivery-confirmation:${opening.current.quoteNumber}:${capturedCycle}`, title: vi ? "Xác nhận gửi Báo giá" : "Quote delivery confirmation", isDirty: dirty || busy,
      save: () => ownsEntry() && quoteNumber === opening.current.quoteNumber && opening.current.onSave ? submit(true) : Promise.resolve(false),
      canDiscard: () => ownsEntry() && !pending.current,
      discard: () => { if (ownsEntry() && !pending.current) { reset(); opening.current.onClose(); } },
    });
    return () => { unregister(); if (registration.current === token) registration.current = undefined; window.removeEventListener("beforeunload", warn); };
  });
  const close = () => { if (!pending.current) guard.requestClose(); };

  const emailChannel = channel === "GMAIL" || channel === "EMAIL";

  const submit = async (globalSave = false): Promise<boolean> => {
    globalSave = globalSave || Boolean(opening.current.onSave);
    if (pending.current || !mounted.current || !openRef.current) return false;
    if (opening.current.targetId !== targetId || (globalSave && !opening.current.onSave)) return false;
    if (opening.current.workspaceId !== getWorkspaceContextSnapshot().workspaceId) { setError(vi ? "Workspace đã thay đổi. Hãy đóng bản nháp này và mở lại." : "Workspace changed. Close this draft and reopen it."); return false; }
    const email = recipientEmail.trim();
    const destination = recipient.trim();
    if (emailChannel && !/^\S+@\S+\.\S+$/.test(email)) {
      setError(vi ? "Hãy nhập email người nhận hợp lệ." : "Enter a valid recipient email.");
      document.getElementById("quote-delivery-email")?.focus(); return false;
    }
    if (!emailChannel && !destination) {
      setError(vi ? "Hãy nhập người nhận, số điện thoại hoặc tài khoản đích." : "Enter the recipient, phone number, or destination account.");
      document.getElementById("quote-delivery-recipient")?.focus(); return false;
    }
    const parsedSentAt = new Date(sentAt);
    if (!sentAt || Number.isNaN(parsedSentAt.getTime())) {
      setError(vi ? "Thời điểm gửi không hợp lệ." : "The sent time is invalid.");
      document.getElementById("quote-delivery-sent-at")?.focus(); return false;
    }

    pending.current = true;
    const capturedCycle = cycle.current;
    setBusy(true);
    setError("");
    try {
      const value = {
        channel,
        recipientEmail: emailChannel ? email : undefined,
        recipient: emailChannel ? undefined : destination,
        note: note.trim() || undefined,
        sentAt: parsedSentAt.toISOString(),
        fileName: opening.current.initialFileName,
      };
      if (globalSave) {
        const key = JSON.stringify(value);
        const deliveryId = attempts.current.get(key) ?? createDurableId("quote_delivery");
        attempts.current.set(key, deliveryId);
        const command = opening.current.onSave?.(value, deliveryId);
        if (!command || typeof command.then !== "function" || (await command) !== true) return false;
        if (!mounted.current || !openRef.current || capturedCycle !== cycle.current || opening.current.workspaceId !== getWorkspaceContextSnapshot().workspaceId
          || opening.current.targetId !== liveTarget.current) return false;
      } else await opening.current.onConfirm(value);
      if (mounted.current && capturedCycle === cycle.current) baseline.current = fingerprint;
      if (globalSave) { openRef.current = false; guard.setIsDirty(false); opening.current.onClose(); }
      return true;
    } catch (caught) {
      if (mounted.current && capturedCycle === cycle.current) setError(formatApplicationError(caught, { locale }));
      return false;
    } finally {
      pending.current = false; if (mounted.current) setBusy(false);
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="md"
      variant="form"
      title={vi ? "Xác nhận Báo giá đã được gửi" : "Confirm quote delivery"}
      footer={(
        <>
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>{vi ? "Chưa gửi" : "Not sent yet"}</Button>
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
          <strong>{vi ? "Báo giá" : "Quote"}:</strong> {opening.current.quoteNumber}
          {initialFileName && <div className="mt-1"><strong>PDF:</strong> {initialFileName}</div>}
        </div>

        {opening.current.channelLocked ? (
          <Input id="quote-delivery-channel-locked" label={vi ? "Kênh gửi" : "Delivery channel"} value={channelLabel(channel, vi)} disabled />
        ) : (
          <Select disabled={busy}
            id="quote-delivery-channel"
            label={vi ? "Kênh gửi *" : "Delivery channel *"}
            value={channel}
            onChange={(event) => { setChannel(event.target.value as QuoteDeliveryChannel); setError(""); }}
          >
            {CUSTOMER_CHANNELS.map((item) => <option key={item} value={item}>{channelLabel(item, vi)}</option>)}
          </Select>
        )}

        {emailChannel ? (
          <Input disabled={busy}
            id="quote-delivery-email"
            type="email"
            label={vi ? "Email người nhận *" : "Recipient email *"}
            value={recipientEmail}
            onChange={(event) => { setRecipientEmail(event.target.value); setError(""); }}
            placeholder="customer@example.com"
          />
        ) : (
          <Input disabled={busy}
            id="quote-delivery-recipient"
            label={vi ? "Người nhận / tài khoản đích *" : "Recipient / destination account *"}
            value={recipient}
            onChange={(event) => { setRecipient(event.target.value); setError(""); }}
            placeholder={vi ? "Tên, số điện thoại hoặc tài khoản" : "Name, phone number, or account"}
          />
        )}

        <Input disabled={busy}
          id="quote-delivery-sent-at"
          type="datetime-local"
          label={vi ? "Thời điểm đã gửi *" : "Sent at *"}
          value={sentAt}
          onChange={(event) => { setSentAt(event.target.value); setError(""); }}
        />

        <Textarea disabled={busy}
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
    <ConfirmDialog isOpen={guard.isConfirmOpen} onClose={() => guard.setIsConfirmOpen(false)} onConfirm={() => { if (!pending.current) guard.confirmDiscard(); }}
      title={vi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"} message={vi ? "Các thay đổi chưa được lưu. Bạn có muốn đóng biểu mẫu?" : "Your changes have not been saved. Close the form?"}
      confirmText={vi ? "Bỏ thay đổi" : "Discard changes"} cancelText={vi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" />
    </>
  );
};
