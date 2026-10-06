import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, Select, Textarea } from "@/shared/components/ui";
import type { CustomerDocumentDeliveryChannel, CustomerDocumentDeliveryValue } from "@/shared/domain/commercialDocumentDelivery";
import { formatApplicationError } from "@/shared/operations";

import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";

export interface CustomerDocumentDeliveryModalProps {
  isOpen: boolean;
  documentNumber: string;
  documentId?: string;
  documentLabel: { vi: string; en: string };
  locale: string;
  idPrefix: string;
  guidanceId: string;
  initialChannel?: CustomerDocumentDeliveryChannel;
  initialRecipientEmail?: string;
  initialRecipient?: string;
  initialFileName?: string;
  channelLocked?: boolean;
  onClose(): void;
  onConfirm(value: CustomerDocumentDeliveryValue): void | boolean | Promise<void | boolean>;
}

const CUSTOMER_CHANNELS: CustomerDocumentDeliveryChannel[] = ["GMAIL", "EMAIL", "ZALO", "CHAT_APP", "SMS", "OTHER"];

const channelLabel = (channel: CustomerDocumentDeliveryChannel, vi: boolean): string => ({
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

export const CustomerDocumentDeliveryModal: React.FC<CustomerDocumentDeliveryModalProps> = ({
  isOpen,
  documentNumber,
  documentId,
  documentLabel,
  locale,
  idPrefix,
  guidanceId,
  initialChannel = "ZALO",
  initialRecipientEmail = "",
  initialRecipient = "",
  initialFileName,
  channelLocked = false,
  onClose,
  onConfirm,
}) => {
  const vi = locale === "vi";
  const label = vi ? documentLabel.vi : documentLabel.en;
  const [channel, setChannel] = React.useState<CustomerDocumentDeliveryChannel>(initialChannel);
  const [recipientEmail, setRecipientEmail] = React.useState(initialRecipientEmail);
  const [recipient, setRecipient] = React.useState(initialRecipient);
  const [sentAt, setSentAt] = React.useState(currentLocalDateTime);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const workspaceId = useWorkspaceContextSnapshot().workspaceId;
  const target = documentId ?? documentNumber;
  const pending = React.useRef(false);
  const mounted = React.useRef(true);
  const cycle = React.useRef(0);
  const wasOpen = React.useRef(false);
  const opening = React.useRef<{ workspaceId: string; target: string; number: string; fileName: string | undefined; locked: boolean; baseline: string; confirm: CustomerDocumentDeliveryModalProps["onConfirm"] } | undefined>(undefined);
  const fingerprint = (c: CustomerDocumentDeliveryChannel, email: string, destination: string, time: string, memo: string) => JSON.stringify([c, c === "GMAIL" || c === "EMAIL" ? email.trim() : destination.trim(), time, memo.trim()]);
  const dirty = isOpen && opening.current !== undefined && fingerprint(channel, recipientEmail, recipient, sentAt, note) !== opening.current.baseline;
  const guard = useUnsavedChangesGuard(onClose);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => { guard.setIsDirty(dirty); }, [dirty, guard.setIsDirty]);
  React.useEffect(() => {
    if (isOpen && (!wasOpen.current || (opening.current?.target !== target && opening.current?.workspaceId === workspaceId && !dirty && !pending.current))) {
      const time = currentLocalDateTime();
      cycle.current += 1;
      opening.current = { workspaceId, target, number: documentNumber, fileName: initialFileName, locked: channelLocked, baseline: fingerprint(initialChannel, initialRecipientEmail, initialRecipient, time, ""), confirm: onConfirm };
      setChannel(initialChannel); setRecipientEmail(initialRecipientEmail); setRecipient(initialRecipient); setSentAt(time); setNote(""); setError(""); setBusy(pending.current);
    }
    if (!isOpen && wasOpen.current) { cycle.current += 1; guard.setIsConfirmOpen(false); }
    wasOpen.current = isOpen;
  });
  React.useEffect(() => {
    if (isOpen && opening.current?.workspaceId !== workspaceId && !dirty && !pending.current) onClose();
  }, [isOpen, workspaceId, dirty, onClose]);
  const close = () => { if (!pending.current) guard.requestClose(); };

  const emailChannel = channel === "GMAIL" || channel === "EMAIL";

  const submit = async (): Promise<boolean> => {
    if (pending.current || !isOpen || !mounted.current || !opening.current) return false;
    if (opening.current.workspaceId !== getWorkspaceContextSnapshot().workspaceId) { setError(vi ? "Hãy trở lại workspace đang mở để xác nhận." : "Return to the opening workspace to confirm."); return false; }
    if (opening.current.target !== target) { setError(vi ? "Hãy trở lại tài liệu đang mở để xác nhận, hoặc bỏ thay đổi." : "Return to the opening document to confirm, or discard the draft."); return false; }
    const interaction = opening.current;
    const submittingCycle = cycle.current;
    const email = recipientEmail.trim();
    const destination = recipient.trim();
    if (emailChannel && !/^\S+@\S+\.\S+$/.test(email)) {
      setError(vi ? "Hãy nhập email người nhận hợp lệ." : "Enter a valid recipient email.");
      document.getElementById(`${idPrefix}-delivery-email`)?.focus();
      return false;
    }
    if (!emailChannel && !destination) {
      setError(vi ? "Hãy nhập người nhận, số điện thoại hoặc tài khoản đích." : "Enter the recipient, phone number, or destination account.");
      document.getElementById(`${idPrefix}-delivery-recipient`)?.focus();
      return false;
    }
    const parsedSentAt = new Date(sentAt);
    if (!sentAt || Number.isNaN(parsedSentAt.getTime())) {
      setError(vi ? "Thời điểm gửi không hợp lệ." : "The sent time is invalid.");
      document.getElementById(`${idPrefix}-delivery-sent-at`)?.focus();
      return false;
    }

    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await interaction.confirm({
        channel,
        recipientEmail: emailChannel ? email : undefined,
        recipient: emailChannel ? undefined : destination,
        note: note.trim() || undefined,
        sentAt: parsedSentAt.toISOString(),
        fileName: interaction.fileName,
      });
      if (result === false) return false;
      if (!mounted.current || cycle.current !== submittingCycle || interaction.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false;
      interaction.baseline = fingerprint(channel, recipientEmail, recipient, sentAt, note);
      guard.setIsDirty(false);
      return true;
    } catch (caught) {
      // MA-08: `onConfirm` runs an authoritative delivery command, so a refusal here
      // carries internal topology. Route it through the central formatter.
      if (mounted.current && cycle.current === submittingCycle) setError(formatApplicationError(caught, { locale }));
      return false;
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const registeredCycle = cycle.current;
    return registerUnsavedWork({ id: `document-delivery:${idPrefix}:${opening.current?.target}:${registeredCycle}`, title: label, isDirty: dirty || busy,
      save: () => mounted.current && cycle.current === registeredCycle ? submit() : Promise.resolve(false),
      canDiscard: () => mounted.current && cycle.current === registeredCycle && !pending.current,
      discard: () => { if (mounted.current && cycle.current === registeredCycle && !pending.current) guard.confirmDiscard(); },
    });
  });
  React.useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="md"
      variant="form"
      title={vi ? `Xác nhận ${label} đã được gửi` : `Confirm ${label.toLowerCase()} was sent`}
      footer={(
        <>
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>{vi ? "Chưa gửi" : "Not sent yet"}</Button>
          <Button
            type="button"
            variant="success"
            loading={busy}
            disabled={busy}
            icon={<CheckCircle2 size={13} />}
            data-guidance-id={guidanceId}
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
            ? `Chỉ xác nhận sau khi ${label} đã thực sự được gửi. CRM sẽ lưu kênh liên hệ, người nhận và thời điểm gửi làm bằng chứng.`
            : `Confirm only after the ${label.toLowerCase()} was actually sent. CRM retains the communication channel, recipient, and sent time as evidence.`}
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <strong>{label}:</strong> {opening.current?.number ?? documentNumber}
          {opening.current?.fileName && <div className="mt-1"><strong>PDF:</strong> {opening.current.fileName}</div>}
        </div>

        {(opening.current?.locked ?? channelLocked) ? (
          <Input id={`${idPrefix}-delivery-channel-locked`} label={vi ? "Kênh gửi" : "Sending channel"} value={channelLabel(channel, vi)} disabled />
        ) : (
          <Select
            id={`${idPrefix}-delivery-channel`}
            label={vi ? "Kênh gửi *" : "Sending channel *"}
            disabled={busy}
            value={channel}
            onChange={(event) => { setChannel(event.target.value as CustomerDocumentDeliveryChannel); setError(""); }}
          >
            {CUSTOMER_CHANNELS.map((item) => <option key={item} value={item}>{channelLabel(item, vi)}</option>)}
          </Select>
        )}

        {emailChannel ? (
          <Input
            id={`${idPrefix}-delivery-email`}
            type="email"
            label={vi ? "Email người nhận *" : "Recipient email *"}
            disabled={busy}
            value={recipientEmail}
            onChange={(event) => { setRecipientEmail(event.target.value); setError(""); }}
            placeholder="customer@example.com"
          />
        ) : (
          <Input
            id={`${idPrefix}-delivery-recipient`}
            label={vi ? "Người nhận / tài khoản đích *" : "Recipient / destination account *"}
            disabled={busy}
            value={recipient}
            onChange={(event) => { setRecipient(event.target.value); setError(""); }}
            placeholder={vi ? "Tên, số điện thoại hoặc tài khoản" : "Name, phone number, or account"}
          />
        )}

        <Input
          id={`${idPrefix}-delivery-sent-at`}
          type="datetime-local"
          label={vi ? "Thời điểm đã gửi *" : "Sent at *"}
          disabled={busy}
          value={sentAt}
          onChange={(event) => { setSentAt(event.target.value); setError(""); }}
        />

        <Textarea
          id={`${idPrefix}-delivery-note`}
          label={vi ? "Ghi chú / mã tham chiếu" : "Note / reference"}
          disabled={busy}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder={vi ? "Ví dụ: Khách đã nhận tài liệu qua Zalo." : "For example: The customer received the document via Zalo."}
        />

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
      </div>
    </Modal>
    <ConfirmDialog isOpen={guard.isConfirmOpen} onClose={() => guard.setIsConfirmOpen(false)} onConfirm={() => { if (!pending.current) guard.confirmDiscard(); }} title={vi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"} message={vi ? "Bằng chứng gửi chưa được lưu." : "Delivery evidence has not been saved."} confirmText={vi ? "Bỏ thay đổi" : "Discard changes"} cancelText={vi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" />
    </>
  );
};
