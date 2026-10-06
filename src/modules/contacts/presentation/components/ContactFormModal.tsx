import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import React from "react";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Button, Checkbox, ConfirmDialog, Input, Modal, Select, Textarea } from "@/shared/components/ui";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { useI18n } from "@/i18n";
import { normalizeApplicationError } from "@/shared/domain";
import { formatOperationUnavailableError } from "@/shared/operations";
import { CAPABILITIES } from "@/platform/access-control";
import { useRecordOwnershipContext } from "@/platform/record-ownership";
import type {
  Contact,
  ContactDecisionRole,
  PreferredContactChannel,
  ContactStatus,
} from "../../domain/model/contact.types";
import { getTranslatedSource } from "../list/contactList.helpers";

export type ContactFormMode = "create" | "edit";
type ContactPriority = NonNullable<Contact["priority"]>;
type InfluenceLevel = NonNullable<Contact["influenceLevel"]>;

export interface ContactFormDraft {
  name: string;
  contactCode: string;
  title: string;
  department: string;
  decisionRole: ContactDecisionRole | "";
  avatarColor: string;
  email: string;
  phone: string;
  zaloId: string;
  address: string;
  preferredChannel: PreferredContactChannel | "";
  communicationConsent: boolean;
  organizationName: string;
  relationshipType: string;
  isPrimaryContact: boolean;
  influenceLevel: InfluenceLevel;
  source: string;
  status: ContactStatus;
  priority: ContactPriority;
  ownerId: string;
  tagsString: string;
  lastContactedAt: string;
  nextFollowUpAt: string;
  notes: string;
  internalNotes: string;
}

export interface ContactFormModalProps {
  guardChanges?: boolean;
  isOpen: boolean;
  onClose(): void;
  mode: ContactFormMode;
  contact?: Contact;
  onSubmit(draft: ContactFormDraft, opening: { contact: Contact | undefined; draft: ContactFormDraft; intentId: string }): void | boolean | Promise<void | boolean>;
}

function localDateTimeInput(value: Date): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeDateTime(value?: string, fallback?: Date): string {
  if (!value) return fallback ? localDateTimeInput(fallback) : "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : localDateTimeInput(parsed);
}

export function createContactFormDraft(contact: Contact | undefined, defaultOwnerId: string): ContactFormDraft {
  if (!contact) {
    return {
      name: "",
      contactCode: "",
      title: "",
      department: "",
      decisionRole: "",
      avatarColor: "",
      email: "",
      phone: "",
      zaloId: "",
      address: "",
      preferredChannel: "",
      communicationConsent: false,
      organizationName: "",
      relationshipType: "",
      isPrimaryContact: false,
      influenceLevel: "medium",
      source: "Website",
      status: "active",
      priority: "MEDIUM",
      ownerId: defaultOwnerId,
      tagsString: "",
      lastContactedAt: "",
      nextFollowUpAt: normalizeDateTime(undefined, new Date(Date.now() + 24 * 60 * 60 * 1000)),
      notes: "",
      internalNotes: "",
    };
  }

  return {
    name: contact.fullName || contact.name || "",
    contactCode: contact.contactCode || contact.code || "",
    title: contact.title || contact.roleTitle || "",
    department: contact.department || "",
    decisionRole: contact.decisionRole || "",
    avatarColor: contact.avatarColor || "",
    email: contact.email || contact.workEmail || "",
    phone: contact.phone || contact.mobilePhone || "",
    zaloId: contact.zaloId || contact.zalo || "",
    address: contact.address || "",
    preferredChannel: contact.preferredContactChannel || "",
    communicationConsent: contact.communicationConsent || false,
    organizationName: contact.organizationName || contact.companyName || "",
    relationshipType: contact.relationshipType || "",
    isPrimaryContact: contact.isPrimaryContact || false,
    influenceLevel: contact.influenceLevel || "medium",
    source: contact.source || "",
    status: contact.status || "active",
    priority: contact.priority || "MEDIUM",
    ownerId: contact.ownerId || "",
    tagsString: contact.tags?.join(", ") || "",
    lastContactedAt: normalizeDateTime(contact.lastContactedAt),
    nextFollowUpAt: normalizeDateTime(contact.nextFollowUpAt),
    notes: contact.notes || "",
    internalNotes: contact.internalNotes || "",
  };
}

function businessValues(draft: ContactFormDraft): string {
  return JSON.stringify({
    name: draft.name.trim(), title: draft.title.trim(), department: draft.department.trim(),
    decisionRole: draft.decisionRole, email: draft.email.trim(), phone: draft.phone.trim(),
    zaloId: draft.zaloId.trim(), address: draft.address.trim(), preferredChannel: draft.preferredChannel,
    source: draft.source.trim(), ownerId: draft.ownerId.trim(),
    tags: draft.tagsString.split(",").map(tag => tag.trim()).filter(Boolean), notes: draft.notes.trim(),
  });
}

export function ContactFormModal({ isOpen, onClose, mode, contact, onSubmit, guardChanges = true }: ContactFormModalProps) {
  const { t, locale } = useI18n();
  const workspace = useWorkspaceContextSnapshot();
  const openingWorkspace = React.useRef(workspace.workspaceId);
  const vi = locale === "vi";
  const ownership = useRecordOwnershipContext("contacts", CAPABILITIES.CONTACTS_ASSIGN);
  const defaultOwnerId = ownership?.memberId || "";
  const draftFactory = React.useCallback(() => createContactFormDraft(contact, defaultOwnerId), [contact, defaultOwnerId]);
  const [draft, setDraft] = React.useState<ContactFormDraft>(draftFactory);
  const [showAdvanced, setShowAdvanced] = React.useState(mode === "edit");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const wasOpen = React.useRef(false);
  const openingContact = React.useRef(contact ? structuredClone(contact) : undefined);
  const pending = React.useRef(false);
  const openRef = React.useRef(isOpen); openRef.current = isOpen;
  const mounted = React.useRef(true);
  const cycle = React.useRef(0);
  const intentId = React.useRef(`contact-${crypto.randomUUID()}`);
  const activeCycle = cycle.current;
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const initialDraft = React.useRef(draft);
  const unsavedChanges = useUnsavedChangesGuard(onClose);
  const canonicalDirty = isOpen && businessValues(draft) !== businessValues(initialDraft.current);
  React.useEffect(() => {
    unsavedChanges.setIsDirty(canonicalDirty);
    if (!isOpen) unsavedChanges.setIsConfirmOpen(false);
  }, [draft, isOpen, unsavedChanges.setIsDirty, unsavedChanges.setIsConfirmOpen]);
  const requestClose = () => {
    if (pending.current) return;
    if (!guardChanges) { onClose(); return; }
    if (!isSubmitting) unsavedChanges.requestClose();
  };

  React.useEffect(() => {
    if (isOpen && (!wasOpen.current || (openingContact.current?.id !== contact?.id && !canonicalDirty && !pending.current))) {
      openingWorkspace.current = workspace.workspaceId;
      cycle.current++;
      intentId.current = `contact-${crypto.randomUUID()}`;
      openingContact.current = contact ? structuredClone(contact) : undefined;
      initialDraft.current = draftFactory();
      setDraft(initialDraft.current);
      setShowAdvanced(mode === "edit");
      setErrors({});
      setFormError("");
    }
    wasOpen.current = isOpen;
  }, [draftFactory, isOpen, mode, canonicalDirty, isSubmitting]);

  React.useEffect(() => {
    if (isOpen && openingWorkspace.current !== workspace.workspaceId && !canonicalDirty && !pending.current) onClose();
  }, [isOpen, workspace.workspaceId, canonicalDirty, onClose]);

  const update = React.useCallback(<K extends keyof ContactFormDraft>(field: K, value: ContactFormDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  }, []);

  const ownerOptions = React.useMemo(() => {
    const options = ownership?.assignableOwners || [];
    if (!draft.ownerId || options.some((owner) => owner.memberId === draft.ownerId)) return options;
    return [{ memberId: draft.ownerId, displayName: draft.ownerId }, ...options];
  }, [draft.ownerId, ownership?.assignableOwners]);

  const focusFirstInvalidField = React.useCallback((nextErrors: Record<string, string>) => {
    const fieldOrder = ["name", "title", "department", "decisionRole", "phone", "email", "zaloId", "preferredChannel", "address", "ownerId", "source", "tagsString", "notes"];
    const firstField = fieldOrder.find((field) => Boolean(nextErrors[field]));
    if (!firstField) return;
    requestAnimationFrame(() => {
      const control = document.getElementById(`contact-${mode}-${firstField}`);
      control?.scrollIntoView({ behavior: "smooth", block: "center" });
      control?.focus({ preventScroll: true });
    });
  }, [mode]);

  const save = async (): Promise<boolean> => {
    if (pending.current || !isOpen || !openRef.current || !mounted.current || cycle.current !== activeCycle) return false;
    if (openingWorkspace.current !== getWorkspaceContextSnapshot().workspaceId) {
      setFormError(vi ? "Hãy trở lại không gian làm việc đang mở hoặc bỏ thay đổi." : "Return to the opening workspace or discard this draft.");
      return false;
    }
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = t("contact.edit.validationNameRequired");
    if (draft.name.trim().length > 200) nextErrors.name = vi ? "Họ tên không được vượt quá 200 ký tự." : "Full name must not exceed 200 characters.";
    if (draft.email && !/\S+@\S+\.\S+/.test(draft.email)) nextErrors.email = t("contact.edit.validationEmail");
    if (draft.email.trim().length > 320) nextErrors.email = vi ? "Email không được vượt quá 320 ký tự." : "Email must not exceed 320 characters.";
    if (draft.phone.trim().length > 50) nextErrors.phone = vi ? "Số điện thoại không được vượt quá 50 ký tự." : "Phone must not exceed 50 characters.";

    for (const [field, value, limit] of [
      ["title", draft.title, 160], ["department", draft.department, 160], ["zaloId", draft.zaloId, 120],
      ["address", draft.address, 700], ["source", draft.source, 160], ["notes", draft.notes, 5000],
    ] as const) {
      if (value.trim().length > limit) nextErrors[field] = vi ? `Không được vượt quá ${limit} ký tự.` : `Must not exceed ${limit} characters.`;
    }
    if (draft.tagsString.split(",").some(tag => tag.trim().length > 100)) nextErrors.tagsString = vi ? "Mỗi nhãn không được vượt quá 100 ký tự." : "Each tag must not exceed 100 characters.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      focusFirstInvalidField(nextErrors);
      return false;
    }

    pending.current = true;
    const submittingCycle = cycle.current;
    setIsSubmitting(true);
    setFormError("");
    try {
      const saved = await onSubmit({
        ...draft,
        name: draft.name.trim(),
        contactCode: draft.contactCode.trim(),
        title: draft.title.trim(),
        department: draft.department.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        zaloId: draft.zaloId.trim(),
        address: draft.address.trim(),
        organizationName: draft.organizationName.trim(),
        relationshipType: draft.relationshipType.trim(),
        source: draft.source.trim(),
        tagsString: draft.tagsString.trim(),
        notes: draft.notes.trim(),
        internalNotes: draft.internalNotes.trim(),
      }, { contact: openingContact.current, draft: initialDraft.current, intentId: intentId.current });
      if (saved === false) return false;
      if (!mounted.current || cycle.current !== submittingCycle) return false;
      initialDraft.current = draft;
      unsavedChanges.setIsDirty(false);
      return true;
    } catch (error) {
      if (!mounted.current || !openRef.current || cycle.current !== submittingCycle) return false;
      const normalized = normalizeApplicationError(error);
      const serverErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(normalized.fieldErrors ?? {})) {
        const localField = field === "fullName" ? "name" : field === "workEmail" ? "email" : field === "mobilePhone" ? "phone" : field === "jobTitle" ? "title" : field === "preferredContactChannel" ? "preferredChannel" : field === "tags" ? "tagsString" : field;
        serverErrors[localField] = messages.join(" ");
      }
      setErrors((current) => ({ ...current, ...serverErrors }));
      setFormError(formatOperationUnavailableError(normalized, { locale }));
      focusFirstInvalidField(serverErrors);
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const canDiscard = () => mounted.current && openRef.current && cycle.current === activeCycle && !pending.current;
    const cleanup = registerUnsavedWork({
      id: `contact-form:${mode}:${openingContact.current?.id ?? "new"}`,
      title: mode === "edit" ? "Edit Contact" : "Create Contact",
      isDirty: canonicalDirty || isSubmitting,
      save,
      canDiscard,
      discard: () => { if (canDiscard()) unsavedChanges.confirmDiscard(); },
    });
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (canonicalDirty || isSubmitting) window.addEventListener("beforeunload", warn);
    return () => { cleanup(); window.removeEventListener("beforeunload", warn); };
  });

  const showComplete = mode === "edit" || showAdvanced;
  return (
    <>
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={requestClose}
      title={mode === "create" ? t("contactList.actions.addContact") : t("contact.edit.title")}
      size="md"
    >
      <form id={`contact-${mode}-form`} onSubmit={(event) => { event.preventDefault(); void save(); }} className="crm-form-surface space-y-5" data-guidance-id="contacts.form.canonical" data-contact-target-id={openingContact.current?.id}>
        {mode === "create" ? (
          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4" data-guidance-id="contacts.form.progressive-profile">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Zap size={17} /></span>
                <p className="text-sm font-semibold text-slate-900">{showAdvanced ? t("contactList.quickCreate.completeTitle") : t("contactList.quickCreate.title")}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowAdvanced((current) => !current)} data-guidance-id="contacts.form.advanced-toggle">
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAdvanced ? t("contactList.quickCreate.useQuick") : t("contactList.quickCreate.showAdvanced")}
              </Button>
            </div>
          </div>
        ) : null}

        <section className="space-y-3">
          <h4 className="border-b border-indigo-50 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{t("contact.edit.basicIdentity")}</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input id={`contact-${mode}-name`} label={`${t("contactList.form.fullName")} *`} required value={draft.name} onChange={(event) => update("name", event.target.value)} error={errors.name} />
            {showComplete ? <Input id={`contact-${mode}-title`} error={errors.title} label={t("contact.edit.jobTitle")} value={draft.title} onChange={(event) => update("title", event.target.value)} /> : null}
            {showComplete ? <Input id={`contact-${mode}-department`} error={errors.department} label={t("contact.edit.department")} value={draft.department} onChange={(event) => update("department", event.target.value)} /> : null}
            {showComplete ? (
              <Select id={`contact-${mode}-decisionRole`} error={errors.decisionRole} label={t("contact.edit.decisionRole")} value={draft.decisionRole} onChange={(event) => update("decisionRole", event.target.value as ContactDecisionRole | "")}>
                <option value="">{t("common.notSet")}</option>
                <option value="decision_maker">{vi ? "Người quyết định" : "Decision maker"}</option>
                <option value="influencer">{vi ? "Người ảnh hưởng" : "Influencer"}</option>
                <option value="user">{vi ? "Người dùng" : "User"}</option>
                <option value="buyer">{vi ? "Người mua" : "Buyer"}</option>
                <option value="technical">{vi ? "Kỹ thuật" : "Technical"}</option>
                <option value="finance">{vi ? "Tài chính" : "Finance"}</option>
                <option value="other">{vi ? "Khác" : "Other"}</option>
              </Select>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="border-b border-indigo-50 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{t("contact.edit.communication")}</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input id={`contact-${mode}-phone`} label={t("contact.edit.phone")} value={draft.phone} onChange={(event) => update("phone", event.target.value)} error={errors.phone} />
            <Input id={`contact-${mode}-email`} label={t("contact.edit.email")} type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} error={errors.email} />
            {showComplete ? <Input id={`contact-${mode}-zaloId`} error={errors.zaloId} label={t("contact.edit.zaloId")} value={draft.zaloId} onChange={(event) => update("zaloId", event.target.value)} /> : null}
            {showComplete ? (
              <Select id={`contact-${mode}-preferredChannel`} error={errors.preferredChannel} label={t("contact.edit.preferredChannel")} value={draft.preferredChannel} onChange={(event) => update("preferredChannel", event.target.value as PreferredContactChannel | "")}>
                <option value="">{t("common.notSet")}</option>
                <option value="email">Email</option><option value="phone">Phone</option><option value="zalo">Zalo</option><option value="facebook">Facebook</option><option value="sms">SMS</option>
              </Select>
            ) : null}
            {showComplete ? <div className="md:col-span-2"><Input id={`contact-${mode}-address`} error={errors.address} label={t("contact.edit.address")} value={draft.address} onChange={(event) => update("address", event.target.value)} /></div> : null}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="border-b border-indigo-50 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{t("contact.edit.salesContext")}</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select id={`contact-${mode}-ownerId`} label={t("contact.edit.ownerId")} value={draft.ownerId} onChange={(event) => update("ownerId", event.target.value)} disabled={!ownership?.canAssign} error={errors.ownerId}>
              <option value="">{t("common.notSet")}</option>
              {ownerOptions.map((owner) => <option key={owner.memberId} value={owner.memberId}>{owner.displayName}</option>)}
            </Select>
            {showComplete ? (
              <Select id={`contact-${mode}-source`} error={errors.source} label={t("contactList.form.source")} value={draft.source} onChange={(event) => update("source", event.target.value)}>
                <option value="">{t("common.notSet")}</option>
                <option value="Website">{getTranslatedSource("Website", t)}</option>
                <option value="Hội thảo / Webinar">{getTranslatedSource("Hội thảo / Webinar", t)}</option>
                <option value="Giới thiệu / Referral">{getTranslatedSource("Giới thiệu / Referral", t)}</option>
                <option value="Facebook">Facebook</option><option value="Google Search">Google Search</option><option value="Direct">Direct</option>
              </Select>
            ) : null}
            {showComplete ? <div className="md:col-span-2"><Input id={`contact-${mode}-tagsString`} error={errors.tagsString} label={t("contact.edit.tags")} value={draft.tagsString} onChange={(event) => update("tagsString", event.target.value)} /></div> : null}
          </div>
        </section>

        {showComplete ? (
          <section className="space-y-3">
            <h4 className="border-b border-indigo-50 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{t("contact.edit.notesSection")}</h4>
            <Textarea id={`contact-${mode}-notes`} error={errors.notes} label={t("contact.edit.notes")} value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
          </section>
        ) : null}

        <div className="crm-form-action-bar sticky bottom-0 z-10 flex justify-end gap-2 border-t border-slate-100 bg-white pt-4">
          {formError ? <p role="alert" className="mr-auto text-sm font-medium text-rose-700">{formError}</p> : null}
          <Button variant="secondary" onClick={requestClose} type="button" disabled={isSubmitting}>{t("common.cancel")}</Button>
          <Button variant="primary" type="submit" loading={isSubmitting} disabled={isSubmitting}>{mode === "create" ? t("contactList.form.btnSave", "Lưu liên hệ") : t("common.save")}</Button>
        </div>
      </form>
    </Modal>
    {guardChanges && <ConfirmDialog
      isOpen={unsavedChanges.isConfirmOpen}
      onClose={() => unsavedChanges.setIsConfirmOpen(false)}
      onConfirm={() => { if (!pending.current) unsavedChanges.confirmDiscard(); }}
      title={vi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"}
      message={vi ? "Các thay đổi chưa được lưu. Bạn có muốn đóng biểu mẫu?" : "Your changes have not been saved. Close the form?"}
      confirmText={vi ? "Bỏ thay đổi" : "Discard changes"}
      cancelText={vi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning"
    />}
    </>
  );
}
