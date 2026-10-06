import { listWorkspaceMemberDirectory } from "@/platform/member-directory";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import React from "react";
import { Checkbox, Input, Select, Textarea } from "@/shared/components/ui";
import { RelationshipQuickActionModal } from "@/components/crm/relationship-panel/RelationshipQuickActionModal";
import { normalizeApplicationError } from "@/shared/domain";
import { registerUnsavedWork } from "@/platform/unsaved-work";
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
  /** Opening record identity; the caller owns the authoritative command snapshot. */
  targetId?: string;
  recordingOnly?: boolean;
  allowFollowUp?: boolean;
  guardChanges?: boolean;
  titleOverride?: string;
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

function useDraftOnOpen<T>(isOpen: boolean, createDraft: () => T, targetId: string | undefined, formId: string, onSubmit: (draft: T) => void | Promise<void>, onClose: () => void) {
  const workspaceId = useWorkspaceContextSnapshot().workspaceId;
  const liveWorkspace = React.useRef(workspaceId);
  liveWorkspace.current = workspaceId;
  const [draft, setDraft] = React.useState<T>(createDraft);
  const initial = React.useRef(draft);
  const wasOpen = React.useRef(false);
  const opening = React.useRef({ workspaceId, targetId, onSubmit, onClose });
  const pending = React.useRef(false);
  const mounted = React.useRef(true);
  const cycle = React.useRef(0);
  const openRef = React.useRef(isOpen);
  openRef.current = isOpen;
  const registration = React.useRef<object | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const fingerprint = (value: T) => JSON.stringify(value, (_key, field: unknown) => typeof field === "string" ? field.trim() : field);
  const dirty = fingerprint(draft) !== fingerprint(initial.current);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => {
    if (isOpen && !pending.current && (!wasOpen.current || (opening.current.targetId !== targetId && !dirty))) {
      cycle.current += 1;
      opening.current = { workspaceId, targetId, onSubmit, onClose };
      initial.current = createDraft();
      setDraft(initial.current);
      setErrors({});
    }
    if (!isOpen || !pending.current) wasOpen.current = isOpen;
  });
  React.useEffect(() => {
    // Lead action owners already register their lifecycle; explicit targetId opts other callers in.
    if (!isOpen || targetId === undefined) return;
    const capturedCycle = cycle.current;
    const entryToken = {};
    registration.current = entryToken;
    const currentEntry = () => mounted.current && openRef.current && cycle.current === capturedCycle && registration.current === entryToken;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (dirty || busy) window.addEventListener("beforeunload", warn);
    const unregister = registerUnsavedWork({
      id: `${formId}:${opening.current.targetId}:${capturedCycle}`,
      title: formId,
      isDirty: dirty || busy,
      // Policy/field validation lives in the form submit handler; a global save cannot bypass it.
      save: async () => false,
      canDiscard: () => currentEntry() && !pending.current,
      discard: () => { if (currentEntry() && !pending.current) { setDraft(initial.current); opening.current.onClose(); } },
    });
    return () => { unregister(); if (registration.current === entryToken) registration.current = undefined; window.removeEventListener("beforeunload", warn); };
  });
  async function submit(value: T): Promise<void> {
    if (pending.current || !mounted.current) return;
    if (opening.current.workspaceId !== liveWorkspace.current) throw new Error("Workspace changed. Close this draft and reopen it.");
    pending.current = true;
    setBusy(true);
    const capturedCycle = cycle.current;
    try {
      await opening.current.onSubmit(value);
      if (mounted.current && cycle.current === capturedCycle && opening.current.workspaceId === liveWorkspace.current) { initial.current = value; setDraft(value); }
    }
    catch (failure) {
      if (mounted.current && cycle.current === capturedCycle) {
        const normalized = normalizeApplicationError(failure);
        const fields = Object.fromEntries(Object.entries(normalized.fieldErrors ?? {}).map(([field, messages]) => [field, messages.join(" ")]));
        setErrors(fields);
        const first = Object.keys(fields)[0];
        if (first) requestAnimationFrame(() => document.getElementById(`${formId}-${first}`)?.focus());
      }
      throw failure;
    }
    finally {
      if (mounted.current && cycle.current === capturedCycle) { pending.current = false; setBusy(false); }
    }
  }
  const validate = (fields: Record<string, string>): boolean => {
    const invalid = Object.keys(fields).filter(field => !fields[field]?.trim());
    if (!invalid.length) return true;
    setErrors(Object.fromEntries(invalid.map(field => [field, "Required"])));
    document.getElementById(`${formId}-${invalid[0]}`)?.focus();
    return false;
  };
  return { draft, setDraft: (update: React.SetStateAction<T>) => { if (!pending.current) setDraft(update); }, dirty, busy, errors, submit, validate, close: () => { if (!pending.current) opening.current.onClose(); } };
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
  onSubmit(draft: CallActivityDraft): void | Promise<void>;
}

export function CallActivityCreateModal({
  guardChanges = true,
  targetId,
  recordingOnly = false,
  allowFollowUp = false,
  titleOverride,
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
    nextFollowUpAt: recordingOnly && !allowFollowUp ? undefined : defaults?.nextFollowUpAt ? normalizeLocalDateTime(defaults.nextFollowUpAt) : undefined,
    createFollowUpTask: recordingOnly && !allowFollowUp ? false : defaults?.createFollowUpTask ?? false,
  }), [defaults]);
  const lifecycle = useDraftOnOpen(isOpen, createDraft, targetId, formId, onSubmit, onClose);
  const { draft, setDraft, dirty } = lifecycle;
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
    <RelationshipQuickActionModal guardChanges={guardChanges} dirty={dirty}
      isOpen={isOpen}
      onClose={lifecycle.close}
      title={titleOverride ?? (vi ? "Ghi nhận cuộc gọi" : "Log call")}
      formId={formId}
      cancelLabel={vi ? "Hủy" : "Cancel"}
      submitLabel={vi ? "Lưu hoạt động" : "Save activity"}
      submitDisabled={lifecycle.busy || !draft.subject.trim() || !draft.occurredAt}
      onSubmit={(event) => {
        event.preventDefault();
        if (contactPolicy?.restricted && !confirmed) {
          setPolicyError(vi ? "Bạn phải xác nhận quyền liên lạc trước khi tiếp tục." : "Confirm contact authorization before continuing.");
          return;
        }
        if (!lifecycle.validate({ subject: draft.subject, occurredAt: draft.occurredAt })) return;
        if (recordingOnly && allowFollowUp && draft.createFollowUpTask && !lifecycle.validate({ nextFollowUpAt: draft.nextFollowUpAt ?? "" })) return;
        return lifecycle.submit({ ...draft, subject: draft.subject.trim(), recipient: draft.recipient.trim(), body: draft.body.trim() });
      }}
    >
      <ContactPolicyNotice confirmationId={`${formId}-contact-policy-confirmation`} policy={contactPolicy} checked={confirmed} error={policyError} onChange={(value) => { setConfirmed(value); if (value) setPolicyError(""); }} />
      <Input error={lifecycle.errors.subject} id={`${formId}-subject`} label={vi ? "Tiêu đề cuộc gọi" : "Call subject"} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} required />
      <Input error={lifecycle.errors.recipient} id={`${formId}-recipient`} label={vi ? "Số điện thoại" : "Phone number"} value={draft.recipient} onChange={(event) => setDraft((current) => ({ ...current, recipient: event.target.value }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select error={lifecycle.errors.direction} id={`${formId}-direction`} label={vi ? "Chiều cuộc gọi" : "Direction"} value={draft.direction} onChange={(event) => setDraft((current) => ({ ...current, direction: event.target.value as CallActivityDraft["direction"] }))}>
          <option value="outbound">{vi ? "Gọi ra" : "Outbound"}</option>
          <option value="inbound">{vi ? "Gọi vào" : "Inbound"}</option>
        </Select>
        <Select error={lifecycle.errors.result} id={`${formId}-result`} label={vi ? "Kết quả" : "Result"} value={draft.result} onChange={(event) => setDraft((current) => ({ ...current, result: event.target.value as CallActivityDraft["result"] }))}>
          <option value="connected">{vi ? "Đã kết nối" : "Connected"}</option>
          <option value="no_answer">{vi ? "Không trả lời" : "No answer"}</option>
          <option value="busy">{vi ? "Máy bận" : "Busy"}</option>
          <option value="voicemail">Voicemail</option>
          <option value="callback">{vi ? "Hẹn gọi lại" : "Callback requested"}</option>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input error={lifecycle.errors.occurredAt} id={`${formId}-occurredAt`} label={vi ? "Thời điểm" : "Occurred at"} readOnly={recordingOnly} type="datetime-local" value={draft.occurredAt} onChange={(event) => setDraft((current) => ({ ...current, occurredAt: event.target.value }))} required />
        <Input label={vi ? "Thời lượng (phút)" : "Duration (minutes)"} type="number" min="0" value={String(draft.durationMinutes)} onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) || 0 }))} />
      </div>
      <Textarea error={lifecycle.errors.body} id={`${formId}-body`} label={vi ? "Tóm tắt và kết quả" : "Summary and outcome"} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={4} />
      <Input error={lifecycle.errors.nextFollowUpAt} id={`${formId}-nextFollowUpAt`} label={vi ? "Theo dõi tiếp theo" : "Next follow-up"} type="datetime-local" readOnly={recordingOnly && !allowFollowUp} value={draft.nextFollowUpAt ?? ""} onChange={(event) => setDraft((current) => ({ ...current, nextFollowUpAt: event.target.value || undefined }))} />
      <Checkbox id={`${formId}-follow-up-task`} label={vi ? "Tạo công việc theo dõi" : "Create follow-up task"} disabled={recordingOnly && !allowFollowUp} checked={draft.createFollowUpTask} onChange={(event) => setDraft((current) => ({ ...current, createFollowUpTask: event.target.checked }))} />
    </RelationshipQuickActionModal>
  );
}

export interface MeetingActivityCreateModalProps extends BaseActivityModalProps {
  recordingTaskBacked?: boolean;
  defaults?: Partial<MeetingActivityDraft>;
  onSubmit(draft: MeetingActivityDraft): void | Promise<void>;
}

export function MeetingActivityCreateModal({ recordingTaskBacked = true,
  guardChanges = true,
  targetId,
  recordingOnly = false,
  titleOverride,
  isOpen,
  onClose,
  defaults,
  onSubmit,
  contactPolicy,
  formId = "canonical-meeting-activity-form",
}: MeetingActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const taskOwners = React.useMemo(() => listWorkspaceMemberDirectory(), [isOpen]);
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
      reminder: recordingOnly ? false : defaults?.reminder ?? true,
    };
  }, [defaults]);
  const lifecycle = useDraftOnOpen(isOpen, createDraft, targetId, formId, onSubmit, onClose);
  const { draft, setDraft, dirty } = lifecycle;
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
    <RelationshipQuickActionModal guardChanges={guardChanges} dirty={dirty}
      isOpen={isOpen}
      onClose={lifecycle.close}
      title={titleOverride ?? (vi ? "Thêm lịch hẹn" : "Add meeting")}
      formId={formId}
      cancelLabel={vi ? "Hủy" : "Cancel"}
      submitLabel={recordingOnly ? (recordingTaskBacked ? (vi ? "Tạo công việc" : "Create task") : (vi ? "Ghi nhận lịch hẹn" : "Record meeting")) : (vi ? "Lưu lịch hẹn" : "Save meeting")}
      submitDisabled={lifecycle.busy || !draft.title.trim() || !draft.startAt}
      onSubmit={(event) => {
        event.preventDefault();
        if (!lifecycle.validate({ title: draft.title, startAt: draft.startAt })) return;
        if (recordingOnly && recordingTaskBacked && !taskOwners.some(member => member.memberId === draft.owner)) {
          setError(vi ? "Chọn thành viên workspace phụ trách công việc." : "Select the task assignee from workspace members.");
          document.getElementById(`${formId}-owner`)?.focus(); return;
        }
        if (draft.endAt && new Date(draft.endAt).getTime() < new Date(draft.startAt).getTime()) {
          setError(vi ? "Thời gian kết thúc phải sau thời gian bắt đầu." : "End time must be after start time.");
          return;
        }
        if (policyApplies && !confirmed) {
          setError(vi ? "Bạn phải xác nhận quyền liên lạc trước khi tiếp tục." : "Confirm contact authorization before continuing.");
          return;
        }
        return lifecycle.submit({ ...draft, title: draft.title.trim(), location: draft.location?.trim() || undefined, attendees: draft.attendees?.trim() || undefined, owner: draft.owner?.trim() || undefined, agenda: draft.agenda?.trim() || undefined });
      }}
    >
      {policyApplies ? <ContactPolicyNotice confirmationId={`${formId}-contact-policy-confirmation`} policy={contactPolicy} checked={confirmed} error={error} onChange={(value) => { setConfirmed(value); if (value) setError(""); }} /> : null}
      <Input error={lifecycle.errors.title} id={`${formId}-title`} label={vi ? "Tiêu đề cuộc hẹn" : "Meeting title"} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input error={lifecycle.errors.startAt} id={`${formId}-startAt`} label={vi ? "Bắt đầu" : "Start"} type="datetime-local" value={draft.startAt} onChange={(event) => { setDraft((current) => ({ ...current, startAt: event.target.value })); setError(""); }} required />
        <Input error={lifecycle.errors.endAt} id={`${formId}-endAt`} label={vi ? "Kết thúc" : "End"} type="datetime-local" value={draft.endAt ?? ""} onChange={(event) => { setDraft((current) => ({ ...current, endAt: event.target.value || undefined })); setError(""); }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select error={lifecycle.errors.channel} id={`${formId}-channel`} label={vi ? "Hình thức" : "Channel"} value={draft.channel} onChange={(event) => { setDraft((current) => ({ ...current, channel: event.target.value as MeetingActivityDraft["channel"] })); setConfirmed(false); setError(""); }}>
          <option value="online">Online</option>
          <option value="in_person">{vi ? "Trực tiếp" : "In person"}</option>
          <option value="phone">{vi ? "Điện thoại" : "Phone"}</option>
        </Select>
        {recordingOnly && recordingTaskBacked ? <Select error={lifecycle.errors.owner} id={`${formId}-owner`} label={vi ? "Người phụ trách công việc" : "Task assignee"} value={draft.owner ?? ""} onChange={(event) => setDraft(current => ({ ...current, owner: event.target.value }))} required>
          <option value="">{vi ? "Chọn thành viên workspace" : "Select workspace member"}</option>
          {taskOwners.map(member => <option key={member.memberId} value={member.memberId}>{member.displayName}</option>)}
        </Select> : <Input error={lifecycle.errors.owner} id={`${formId}-owner`} label={vi ? "Người phụ trách" : "Owner"} value={draft.owner ?? ""} onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))} />}
      </div>
      <Input error={lifecycle.errors.location} id={`${formId}-location`} label={vi ? "Địa điểm / liên kết họp" : "Location / meeting link"} value={draft.location ?? ""} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} />
      <Input error={lifecycle.errors.attendees} id={`${formId}-attendees`} label={vi ? "Người tham dự" : "Attendees"} value={draft.attendees ?? ""} onChange={(event) => setDraft((current) => ({ ...current, attendees: event.target.value }))} />
      <Textarea error={lifecycle.errors.agenda} id={`${formId}-agenda`} label={vi ? "Chương trình / ghi chú" : "Agenda / notes"} value={draft.agenda ?? ""} onChange={(event) => setDraft((current) => ({ ...current, agenda: event.target.value }))} rows={4} />
      {recordingOnly && <p className="text-xs text-slate-500">{recordingTaskBacked ? (vi ? "Ghi nhận bằng Công việc; không tạo lịch hoặc nhắc hẹn tự động." : "Task-backed recording; no calendar event or automatic reminder.") : (vi ? "Ghi nhận hoạt động; không tạo lịch hoặc nhắc hẹn tự động." : "Activity recording; no calendar event or automatic reminder.")}</p>}
      <Checkbox id={`${formId}-reminder`} label={vi ? "Nhắc trước 15 phút" : "Remind 15 minutes before"} disabled={recordingOnly} checked={draft.reminder} onChange={(event) => setDraft((current) => ({ ...current, reminder: event.target.checked }))} />
      {error && !policyApplies ? <div className="text-xs font-semibold text-rose-600">{error}</div> : null}
    </RelationshipQuickActionModal>
  );
}

export interface EmailActivityCreateModalProps extends BaseActivityModalProps {
  titleOverride?: string;
  submitLabelOverride?: string;
  helperTextOverride?: string;
  defaults?: Partial<EmailActivityDraft>;
  onSubmit(draft: EmailActivityDraft): void | Promise<void>;
}

export function EmailActivityCreateModal({ guardChanges = true, targetId, recordingOnly = false, titleOverride, submitLabelOverride, helperTextOverride, isOpen, onClose, defaults, onSubmit, contactPolicy, formId = "canonical-email-activity-form" }: EmailActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const createDraft = React.useCallback((): EmailActivityDraft => ({ to: defaults?.to ?? "", subject: defaults?.subject ?? "", body: defaults?.body ?? "", attachProposal: recordingOnly ? false : defaults?.attachProposal ?? false }), [defaults]);
  const lifecycle = useDraftOnOpen(isOpen, createDraft, targetId, formId, onSubmit, onClose);
  const { draft, setDraft, dirty } = lifecycle;
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState("");
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !wasOpen.current) { setConfirmed(false); setError(""); }
    wasOpen.current = isOpen;
  }, [isOpen]);
  return (
    <RelationshipQuickActionModal guardChanges={guardChanges} dirty={dirty} isOpen={isOpen} onClose={lifecycle.close} title={titleOverride ?? (vi ? "Ghi nhận Email" : "Log email")} formId={formId} cancelLabel={vi ? "Hủy" : "Cancel"} submitLabel={submitLabelOverride ?? (recordingOnly ? (vi ? "Ghi nhận Email" : "Record email") : (vi ? "Gửi Email" : "Send email"))} submitDisabled={lifecycle.busy || !draft.to.trim() || !draft.subject.trim() || !draft.body.trim()} onSubmit={(event) => { event.preventDefault(); if (contactPolicy?.restricted && !confirmed) { setError(vi ? "Bạn phải xác nhận quyền liên lạc trước khi tiếp tục." : "Confirm contact authorization before continuing."); return; } if (!lifecycle.validate({ to: draft.to, subject: draft.subject, body: draft.body })) return; return lifecycle.submit({ ...draft, to: draft.to.trim(), subject: draft.subject.trim(), body: draft.body.trim() }); }}>
      {helperTextOverride && <p className="text-xs text-slate-500">{helperTextOverride}</p>}
      <ContactPolicyNotice confirmationId={`${formId}-contact-policy-confirmation`} policy={contactPolicy} checked={confirmed} error={error} onChange={(value) => { setConfirmed(value); if (value) setError(""); }} />
      <Input error={lifecycle.errors.to} id={`${formId}-to`} label={vi ? "Người nhận" : "Recipient"} type="email" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} required />
      <Input error={lifecycle.errors.subject} id={`${formId}-subject`} label={vi ? "Tiêu đề" : "Subject"} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} required />
      <Textarea error={lifecycle.errors.body} id={`${formId}-body`} label={vi ? "Nội dung Email" : "Email body"} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={6} required />
      <Checkbox id={`${formId}-attachment`} label={vi ? "Đính kèm tài liệu giới thiệu" : "Attach product introduction"} disabled={recordingOnly} checked={draft.attachProposal} onChange={(event) => setDraft((current) => ({ ...current, attachProposal: event.target.checked }))} />
    </RelationshipQuickActionModal>
  );
}

export interface SmsActivityCreateModalProps extends BaseActivityModalProps {
  titleOverride?: string;
  submitLabelOverride?: string;
  helperTextOverride?: string;
  defaults?: Partial<SmsActivityDraft>;
  onSubmit(draft: SmsActivityDraft): void | Promise<void>;
}

export function SmsActivityCreateModal({ guardChanges = true, targetId, recordingOnly = false, titleOverride, submitLabelOverride, helperTextOverride, isOpen, onClose, defaults, onSubmit, contactPolicy, formId = "canonical-sms-activity-form" }: SmsActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const createDraft = React.useCallback((): SmsActivityDraft => ({ phone: defaults?.phone ?? "", body: defaults?.body ?? "" }), [defaults]);
  const lifecycle = useDraftOnOpen(isOpen, createDraft, targetId, formId, onSubmit, onClose);
  const { draft, setDraft, dirty } = lifecycle;
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState("");
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !wasOpen.current) { setConfirmed(false); setError(""); }
    wasOpen.current = isOpen;
  }, [isOpen]);
  return (
    <RelationshipQuickActionModal guardChanges={guardChanges} dirty={dirty} isOpen={isOpen} onClose={lifecycle.close} title={titleOverride ?? (vi ? "Ghi nhận SMS" : "Log SMS")} formId={formId} cancelLabel={vi ? "Hủy" : "Cancel"} submitLabel={submitLabelOverride ?? (recordingOnly ? (vi ? "Ghi nhận SMS" : "Record SMS") : (vi ? "Gửi tin nhắn" : "Send message"))} submitDisabled={lifecycle.busy || !draft.phone.trim() || !draft.body.trim()} onSubmit={(event) => { event.preventDefault(); if (contactPolicy?.restricted && !confirmed) { setError(vi ? "Bạn phải xác nhận quyền liên lạc trước khi tiếp tục." : "Confirm contact authorization before continuing."); return; } if (!lifecycle.validate({ phone: draft.phone, body: draft.body })) return; return lifecycle.submit({ phone: draft.phone.trim(), body: draft.body.trim() }); }}>
      {helperTextOverride && <p className="text-xs text-slate-500">{helperTextOverride}</p>}
      <ContactPolicyNotice confirmationId={`${formId}-contact-policy-confirmation`} policy={contactPolicy} checked={confirmed} error={error} onChange={(value) => { setConfirmed(value); if (value) setError(""); }} />
      <Input error={lifecycle.errors.phone} id={`${formId}-phone`} label={vi ? "Số điện thoại" : "Phone number"} value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} required />
      <Textarea error={lifecycle.errors.body} id={`${formId}-body`} label={vi ? "Nội dung tin nhắn" : "Message"} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value.slice(0, 160) }))} rows={4} required />
      <div className="text-right text-xs font-semibold text-slate-400">{draft.body.length}/160</div>
    </RelationshipQuickActionModal>
  );
}

export interface NoteActivityCreateModalProps extends Omit<BaseActivityModalProps, "contactPolicy" | "titleOverride"> {
  defaults?: Partial<NoteActivityDraft>;
  onSubmit(draft: NoteActivityDraft): void | Promise<void>;
}

export function NoteActivityCreateModal({ guardChanges = true, targetId, recordingOnly = false, isOpen, onClose, defaults, onSubmit, formId = "canonical-note-activity-form" }: NoteActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const createDraft = React.useCallback((): NoteActivityDraft => ({ title: defaults?.title ?? "", body: defaults?.body ?? "", category: defaults?.category ?? "care", pinned: recordingOnly ? false : defaults?.pinned ?? false, occurredAt: normalizeLocalDateTime(defaults?.occurredAt) }), [defaults]);
  const lifecycle = useDraftOnOpen(isOpen, createDraft, targetId, formId, onSubmit, onClose);
  const { draft, setDraft, dirty } = lifecycle;
  return (
    <RelationshipQuickActionModal guardChanges={guardChanges} dirty={dirty} isOpen={isOpen} onClose={lifecycle.close} title={vi ? "Ghi chú nhanh" : "Quick note"} formId={formId} cancelLabel={vi ? "Hủy" : "Cancel"} submitLabel={vi ? "Lưu ghi chú" : "Save note"} submitDisabled={lifecycle.busy || !draft.title.trim() || !draft.body.trim()} onSubmit={(event) => { event.preventDefault(); if (!lifecycle.validate({ title: draft.title, body: draft.body })) return; return lifecycle.submit({ ...draft, title: draft.title.trim(), body: draft.body.trim() }); }}>
      {recordingOnly && <p className="text-xs text-slate-500">{vi ? "Ghi nhận hoạt động; thời điểm do hệ thống xác định, không ghim hoặc gửi nội dung." : "Activity recording; time is assigned by the system. No pinning or delivery."}</p>}
      <Input error={lifecycle.errors.title} id={`${formId}-title`} label={vi ? "Tiêu đề ghi chú" : "Note title"} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required />
      <Select error={lifecycle.errors.category} id={`${formId}-category`} label={vi ? "Phân loại" : "Category"} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as NoteActivityDraft["category"] }))}>
        <option value="care">{vi ? "Chăm sóc" : "Care"}</option>
        <option value="internal">{vi ? "Nội bộ" : "Internal"}</option>
        <option value="call_summary">{vi ? "Tóm tắt cuộc gọi" : "Call summary"}</option>
        <option value="consulting">{vi ? "Tư vấn" : "Consulting"}</option>
      </Select>
      <Textarea error={lifecycle.errors.body} id={`${formId}-body`} label={vi ? "Nội dung ghi chú" : "Note details"} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={5} required />
      <Input error={lifecycle.errors.occurredAt} id={`${formId}-occurredAt`} label={vi ? "Thời điểm" : "Occurred at"} readOnly={recordingOnly} type="datetime-local" value={draft.occurredAt} onChange={(event) => setDraft((current) => ({ ...current, occurredAt: event.target.value }))} required />
      <Checkbox id={`${formId}-pinned`} label={vi ? "Ghim ghi chú" : "Pin note"} disabled={recordingOnly} checked={draft.pinned} onChange={(event) => setDraft((current) => ({ ...current, pinned: event.target.checked }))} />
    </RelationshipQuickActionModal>
  );
}
