import React from "react";
import { Checkbox, Input, Select, Textarea } from "@/shared/components/ui";
import { RelationshipQuickActionModal } from "@/components/crm/relationship-panel/RelationshipQuickActionModal";
import { useI18n } from "@/i18n";

export interface ActivityContactPolicy {
  restricted?: boolean;
  warning?: string;
  confirmationLabel?: string;
}

export interface CallActivityDraft {
  subject: string;
  recipient: string;
  direction: "outbound" | "inbound";
  result: "connected" | "no_answer" | "busy" | "voicemail" | "callback";
  occurredAt: string;
  durationMinutes: number;
  body: string;
  nextFollowUpAt?: string;
  createFollowUpTask: boolean;
}

export interface MeetingActivityDraft {
  title: string;
  startAt: string;
  endAt?: string;
  channel: "online" | "in_person" | "phone";
  location?: string;
  attendees?: string;
  owner?: string;
  agenda?: string;
  reminder: boolean;
}

export interface EmailActivityDraft {
  to: string;
  subject: string;
  body: string;
  attachProposal: boolean;
}

export interface SmsActivityDraft {
  phone: string;
  body: string;
}

export interface NoteActivityDraft {
  title: string;
  body: string;
  category: "care" | "internal" | "call_summary" | "consulting";
  pinned: boolean;
  occurredAt: string;
}

interface BaseActivityModalProps {
  isOpen: boolean;
  onClose(): void;
  formId?: string;
  contactPolicy?: ActivityContactPolicy;
}

function localDateTimeInput(value = new Date()): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeLocalDateTime(value?: string, fallback = new Date()): string {
  if (!value) return localDateTimeInput(fallback);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? localDateTimeInput(fallback) : localDateTimeInput(parsed);
}

function useDraftOnOpen<T>(isOpen: boolean, createDraft: () => T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [draft, setDraft] = React.useState<T>(createDraft);
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !wasOpen.current) setDraft(createDraft());
    wasOpen.current = isOpen;
  }, [createDraft, isOpen]);

  return [draft, setDraft];
}

function ContactPolicyNotice({
  policy,
  checked,
  onChange,
  error,
  confirmationId,
}: {
  policy?: ActivityContactPolicy;
  checked: boolean;
  onChange(checked: boolean): void;
  error: string;
  confirmationId: string;
}) {
  const { locale } = useI18n();
  if (!policy?.restricted) return null;
  const vi = locale === "vi";
  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
      <div className="text-xs font-bold">
        {policy.warning ?? (vi ? "Khách hàng đang có yêu cầu hạn chế liên lạc." : "The customer has an active contact restriction.")}
      </div>
      <Checkbox
        id={confirmationId}
        label={policy.confirmationLabel ?? (vi
          ? "Tôi xác nhận được phép thực hiện hành động này."
          : "I confirm that I am authorized to perform this action.")}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {error ? <div className="text-xs font-semibold text-rose-600">{error}</div> : null}
    </div>
  );
}

export interface CallActivityCreateModalProps extends BaseActivityModalProps {
  defaults?: Partial<CallActivityDraft>;
  onSubmit(draft: CallActivityDraft): void;
}

export function CallActivityCreateModal({
  isOpen,
  onClose,
  defaults,
  onSubmit,
  contactPolicy,
  formId = "canonical-call-activity-form",
}: CallActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const createDraft = React.useCallback((): CallActivityDraft => ({
    subject: defaults?.subject ?? "",
    recipient: defaults?.recipient ?? "",
    direction: defaults?.direction ?? "outbound",
    result: defaults?.result ?? "connected",
    occurredAt: normalizeLocalDateTime(defaults?.occurredAt),
    durationMinutes: defaults?.durationMinutes ?? 10,
    body: defaults?.body ?? "",
    nextFollowUpAt: defaults?.nextFollowUpAt ? normalizeLocalDateTime(defaults.nextFollowUpAt) : undefined,
    createFollowUpTask: defaults?.createFollowUpTask ?? false,
  }), [defaults]);
  const [draft, setDraft] = useDraftOnOpen(isOpen, createDraft);
  const [confirmed, setConfirmed] = React.useState(false);
  const [policyError, setPolicyError] = React.useState("");

  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setConfirmed(false);
      setPolicyError("");
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  return (
    <RelationshipQuickActionModal
      isOpen={isOpen}
      onClose={onClose}
      title={vi ? "Ghi nhận cuộc gọi" : "Log call"}
      formId={formId}
      cancelLabel={vi ? "Hủy" : "Cancel"}
      submitLabel={vi ? "Lưu hoạt động" : "Save activity"}
      submitDisabled={!draft.subject.trim() || !draft.occurredAt}
      onSubmit={(event) => {
        event.preventDefault();
        if (contactPolicy?.restricted && !confirmed) {
          setPolicyError(vi ? "Bạn phải xác nhận quyền liên lạc trước khi tiếp tục." : "Confirm contact authorization before continuing.");
          return;
        }
        onSubmit({ ...draft, subject: draft.subject.trim(), recipient: draft.recipient.trim(), body: draft.body.trim() });
      }}
    >
      <ContactPolicyNotice confirmationId={`${formId}-contact-policy-confirmation`} policy={contactPolicy} checked={confirmed} error={policyError} onChange={(value) => { setConfirmed(value); if (value) setPolicyError(""); }} />
      <Input label={vi ? "Tiêu đề cuộc gọi" : "Call subject"} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} required />
      <Input label={vi ? "Số điện thoại" : "Phone number"} value={draft.recipient} onChange={(event) => setDraft((current) => ({ ...current, recipient: event.target.value }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={vi ? "Chiều cuộc gọi" : "Direction"} value={draft.direction} onChange={(event) => setDraft((current) => ({ ...current, direction: event.target.value as CallActivityDraft["direction"] }))}>
          <option value="outbound">{vi ? "Gọi ra" : "Outbound"}</option>
          <option value="inbound">{vi ? "Gọi vào" : "Inbound"}</option>
        </Select>
        <Select label={vi ? "Kết quả" : "Result"} value={draft.result} onChange={(event) => setDraft((current) => ({ ...current, result: event.target.value as CallActivityDraft["result"] }))}>
          <option value="connected">{vi ? "Đã kết nối" : "Connected"}</option>
          <option value="no_answer">{vi ? "Không trả lời" : "No answer"}</option>
          <option value="busy">{vi ? "Máy bận" : "Busy"}</option>
          <option value="voicemail">Voicemail</option>
          <option value="callback">{vi ? "Hẹn gọi lại" : "Callback requested"}</option>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={vi ? "Thời điểm" : "Occurred at"} type="datetime-local" value={draft.occurredAt} onChange={(event) => setDraft((current) => ({ ...current, occurredAt: event.target.value }))} required />
        <Input label={vi ? "Thời lượng (phút)" : "Duration (minutes)"} type="number" min="0" value={String(draft.durationMinutes)} onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) || 0 }))} />
      </div>
      <Textarea label={vi ? "Tóm tắt và kết quả" : "Summary and outcome"} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={4} />
      <Input label={vi ? "Theo dõi tiếp theo" : "Next follow-up"} type="datetime-local" value={draft.nextFollowUpAt ?? ""} onChange={(event) => setDraft((current) => ({ ...current, nextFollowUpAt: event.target.value || undefined }))} />
      <Checkbox id={`${formId}-follow-up-task`} label={vi ? "Tạo công việc theo dõi" : "Create follow-up task"} checked={draft.createFollowUpTask} onChange={(event) => setDraft((current) => ({ ...current, createFollowUpTask: event.target.checked }))} />
    </RelationshipQuickActionModal>
  );
}

export interface MeetingActivityCreateModalProps extends BaseActivityModalProps {
  defaults?: Partial<MeetingActivityDraft>;
  onSubmit(draft: MeetingActivityDraft): void;
}

export function MeetingActivityCreateModal({
  isOpen,
  onClose,
  defaults,
  onSubmit,
  contactPolicy,
  formId = "canonical-meeting-activity-form",
}: MeetingActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const createDraft = React.useCallback((): MeetingActivityDraft => {
    const startAt = normalizeLocalDateTime(defaults?.startAt, new Date(Date.now() + 60 * 60 * 1000));
    return {
      title: defaults?.title ?? "",
      startAt,
      endAt: defaults?.endAt ? normalizeLocalDateTime(defaults.endAt) : undefined,
      channel: defaults?.channel ?? "online",
      location: defaults?.location ?? "",
      attendees: defaults?.attendees ?? "",
      owner: defaults?.owner ?? "",
      agenda: defaults?.agenda ?? "",
      reminder: defaults?.reminder ?? true,
    };
  }, [defaults]);
  const [draft, setDraft] = useDraftOnOpen(isOpen, createDraft);
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState("");

  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setConfirmed(false);
      setError("");
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  const policyApplies = contactPolicy?.restricted && draft.channel === "phone";
  return (
    <RelationshipQuickActionModal
      isOpen={isOpen}
      onClose={onClose}
      title={vi ? "Thêm lịch hẹn" : "Add meeting"}
      formId={formId}
      cancelLabel={vi ? "Hủy" : "Cancel"}
      submitLabel={vi ? "Lưu lịch hẹn" : "Save meeting"}
      submitDisabled={!draft.title.trim() || !draft.startAt}
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.endAt && new Date(draft.endAt).getTime() < new Date(draft.startAt).getTime()) {
          setError(vi ? "Thời gian kết thúc phải sau thời gian bắt đầu." : "End time must be after start time.");
          return;
        }
        if (policyApplies && !confirmed) {
          setError(vi ? "Bạn phải xác nhận quyền liên lạc trước khi tiếp tục." : "Confirm contact authorization before continuing.");
          return;
        }
        onSubmit({ ...draft, title: draft.title.trim(), location: draft.location?.trim() || undefined, attendees: draft.attendees?.trim() || undefined, owner: draft.owner?.trim() || undefined, agenda: draft.agenda?.trim() || undefined });
      }}
    >
      {policyApplies ? <ContactPolicyNotice confirmationId={`${formId}-contact-policy-confirmation`} policy={contactPolicy} checked={confirmed} error={error} onChange={(value) => { setConfirmed(value); if (value) setError(""); }} /> : null}
      <Input label={vi ? "Tiêu đề cuộc hẹn" : "Meeting title"} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={vi ? "Bắt đầu" : "Start"} type="datetime-local" value={draft.startAt} onChange={(event) => { setDraft((current) => ({ ...current, startAt: event.target.value })); setError(""); }} required />
        <Input label={vi ? "Kết thúc" : "End"} type="datetime-local" value={draft.endAt ?? ""} onChange={(event) => { setDraft((current) => ({ ...current, endAt: event.target.value || undefined })); setError(""); }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={vi ? "Hình thức" : "Channel"} value={draft.channel} onChange={(event) => { setDraft((current) => ({ ...current, channel: event.target.value as MeetingActivityDraft["channel"] })); setConfirmed(false); setError(""); }}>
          <option value="online">Online</option>
          <option value="in_person">{vi ? "Trực tiếp" : "In person"}</option>
          <option value="phone">{vi ? "Điện thoại" : "Phone"}</option>
        </Select>
        <Input label={vi ? "Người phụ trách" : "Owner"} value={draft.owner ?? ""} onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))} />
      </div>
      <Input label={vi ? "Địa điểm / liên kết họp" : "Location / meeting link"} value={draft.location ?? ""} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} />
      <Input label={vi ? "Người tham dự" : "Attendees"} value={draft.attendees ?? ""} onChange={(event) => setDraft((current) => ({ ...current, attendees: event.target.value }))} />
      <Textarea label={vi ? "Chương trình / ghi chú" : "Agenda / notes"} value={draft.agenda ?? ""} onChange={(event) => setDraft((current) => ({ ...current, agenda: event.target.value }))} rows={4} />
      <Checkbox id={`${formId}-reminder`} label={vi ? "Nhắc trước 15 phút" : "Remind 15 minutes before"} checked={draft.reminder} onChange={(event) => setDraft((current) => ({ ...current, reminder: event.target.checked }))} />
      {error && !policyApplies ? <div className="text-xs font-semibold text-rose-600">{error}</div> : null}
    </RelationshipQuickActionModal>
  );
}

export interface EmailActivityCreateModalProps extends BaseActivityModalProps {
  defaults?: Partial<EmailActivityDraft>;
  onSubmit(draft: EmailActivityDraft): void;
}

export function EmailActivityCreateModal({ isOpen, onClose, defaults, onSubmit, contactPolicy, formId = "canonical-email-activity-form" }: EmailActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const createDraft = React.useCallback((): EmailActivityDraft => ({ to: defaults?.to ?? "", subject: defaults?.subject ?? "", body: defaults?.body ?? "", attachProposal: defaults?.attachProposal ?? false }), [defaults]);
  const [draft, setDraft] = useDraftOnOpen(isOpen, createDraft);
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState("");
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !wasOpen.current) { setConfirmed(false); setError(""); }
    wasOpen.current = isOpen;
  }, [isOpen]);
  return (
    <RelationshipQuickActionModal isOpen={isOpen} onClose={onClose} title={vi ? "Ghi nhận Email" : "Log email"} formId={formId} cancelLabel={vi ? "Hủy" : "Cancel"} submitLabel={vi ? "Gửi Email" : "Send email"} submitDisabled={!draft.to.trim() || !draft.subject.trim() || !draft.body.trim()} onSubmit={(event) => { event.preventDefault(); if (contactPolicy?.restricted && !confirmed) { setError(vi ? "Bạn phải xác nhận quyền liên lạc trước khi tiếp tục." : "Confirm contact authorization before continuing."); return; } onSubmit({ ...draft, to: draft.to.trim(), subject: draft.subject.trim(), body: draft.body.trim() }); }}>
      <ContactPolicyNotice confirmationId={`${formId}-contact-policy-confirmation`} policy={contactPolicy} checked={confirmed} error={error} onChange={(value) => { setConfirmed(value); if (value) setError(""); }} />
      <Input label={vi ? "Người nhận" : "Recipient"} type="email" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} required />
      <Input label={vi ? "Tiêu đề" : "Subject"} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} required />
      <Textarea label={vi ? "Nội dung Email" : "Email body"} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={6} required />
      <Checkbox id={`${formId}-attachment`} label={vi ? "Đính kèm tài liệu giới thiệu" : "Attach product introduction"} checked={draft.attachProposal} onChange={(event) => setDraft((current) => ({ ...current, attachProposal: event.target.checked }))} />
    </RelationshipQuickActionModal>
  );
}

export interface SmsActivityCreateModalProps extends BaseActivityModalProps {
  defaults?: Partial<SmsActivityDraft>;
  onSubmit(draft: SmsActivityDraft): void;
}

export function SmsActivityCreateModal({ isOpen, onClose, defaults, onSubmit, contactPolicy, formId = "canonical-sms-activity-form" }: SmsActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const createDraft = React.useCallback((): SmsActivityDraft => ({ phone: defaults?.phone ?? "", body: defaults?.body ?? "" }), [defaults]);
  const [draft, setDraft] = useDraftOnOpen(isOpen, createDraft);
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState("");
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !wasOpen.current) { setConfirmed(false); setError(""); }
    wasOpen.current = isOpen;
  }, [isOpen]);
  return (
    <RelationshipQuickActionModal isOpen={isOpen} onClose={onClose} title={vi ? "Ghi nhận SMS" : "Log SMS"} formId={formId} cancelLabel={vi ? "Hủy" : "Cancel"} submitLabel={vi ? "Gửi tin nhắn" : "Send message"} submitDisabled={!draft.phone.trim() || !draft.body.trim()} onSubmit={(event) => { event.preventDefault(); if (contactPolicy?.restricted && !confirmed) { setError(vi ? "Bạn phải xác nhận quyền liên lạc trước khi tiếp tục." : "Confirm contact authorization before continuing."); return; } onSubmit({ phone: draft.phone.trim(), body: draft.body.trim() }); }}>
      <ContactPolicyNotice confirmationId={`${formId}-contact-policy-confirmation`} policy={contactPolicy} checked={confirmed} error={error} onChange={(value) => { setConfirmed(value); if (value) setError(""); }} />
      <Input label={vi ? "Số điện thoại" : "Phone number"} value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} required />
      <Textarea label={vi ? "Nội dung tin nhắn" : "Message"} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value.slice(0, 160) }))} rows={4} required />
      <div className="text-right text-xs font-semibold text-slate-400">{draft.body.length}/160</div>
    </RelationshipQuickActionModal>
  );
}

export interface NoteActivityCreateModalProps extends Omit<BaseActivityModalProps, "contactPolicy"> {
  defaults?: Partial<NoteActivityDraft>;
  onSubmit(draft: NoteActivityDraft): void;
}

export function NoteActivityCreateModal({ isOpen, onClose, defaults, onSubmit, formId = "canonical-note-activity-form" }: NoteActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const createDraft = React.useCallback((): NoteActivityDraft => ({ title: defaults?.title ?? "", body: defaults?.body ?? "", category: defaults?.category ?? "care", pinned: defaults?.pinned ?? false, occurredAt: normalizeLocalDateTime(defaults?.occurredAt) }), [defaults]);
  const [draft, setDraft] = useDraftOnOpen(isOpen, createDraft);
  return (
    <RelationshipQuickActionModal isOpen={isOpen} onClose={onClose} title={vi ? "Ghi chú nhanh" : "Quick note"} formId={formId} cancelLabel={vi ? "Hủy" : "Cancel"} submitLabel={vi ? "Lưu ghi chú" : "Save note"} submitDisabled={!draft.title.trim() || !draft.body.trim()} onSubmit={(event) => { event.preventDefault(); onSubmit({ ...draft, title: draft.title.trim(), body: draft.body.trim() }); }}>
      <Input label={vi ? "Tiêu đề ghi chú" : "Note title"} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required />
      <Select label={vi ? "Phân loại" : "Category"} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as NoteActivityDraft["category"] }))}>
        <option value="care">{vi ? "Chăm sóc" : "Care"}</option>
        <option value="internal">{vi ? "Nội bộ" : "Internal"}</option>
        <option value="call_summary">{vi ? "Tóm tắt cuộc gọi" : "Call summary"}</option>
        <option value="consulting">{vi ? "Tư vấn" : "Consulting"}</option>
      </Select>
      <Textarea label={vi ? "Nội dung ghi chú" : "Note details"} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={5} required />
      <Input label={vi ? "Thời điểm" : "Occurred at"} type="datetime-local" value={draft.occurredAt} onChange={(event) => setDraft((current) => ({ ...current, occurredAt: event.target.value }))} required />
      <Checkbox id={`${formId}-pinned`} label={vi ? "Ghim ghi chú" : "Pin note"} checked={draft.pinned} onChange={(event) => setDraft((current) => ({ ...current, pinned: event.target.checked }))} />
    </RelationshipQuickActionModal>
  );
}
