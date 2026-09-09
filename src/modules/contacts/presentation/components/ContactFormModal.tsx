import React from "react";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Button, Checkbox, Input, Modal, Select, Textarea } from "@/shared/components/ui";
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
  isOpen: boolean;
  onClose(): void;
  mode: ContactFormMode;
  contact?: Contact;
  onSubmit(draft: ContactFormDraft): void | Promise<void>;
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

function createDraft(contact: Contact | undefined, defaultOwnerId: string): ContactFormDraft {
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
    ownerId: contact.ownerId || defaultOwnerId,
    tagsString: contact.tags?.join(", ") || "",
    lastContactedAt: normalizeDateTime(contact.lastContactedAt),
    nextFollowUpAt: normalizeDateTime(contact.nextFollowUpAt),
    notes: contact.notes || "",
    internalNotes: contact.internalNotes || "",
  };
}

export function ContactFormModal({ isOpen, onClose, mode, contact, onSubmit }: ContactFormModalProps) {
  const { t, locale } = useI18n();
  const vi = locale === "vi";
  const ownership = useRecordOwnershipContext("contacts", CAPABILITIES.CONTACTS_ASSIGN);
  const defaultOwnerId = ownership?.memberId || "";
  const draftFactory = React.useCallback(() => createDraft(contact, defaultOwnerId), [contact, defaultOwnerId]);
  const [draft, setDraft] = React.useState<ContactFormDraft>(draftFactory);
  const [showAdvanced, setShowAdvanced] = React.useState(mode === "edit");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setDraft(draftFactory());
      setShowAdvanced(mode === "edit");
      setErrors({});
      setFormError("");
    }
    wasOpen.current = isOpen;
  }, [draftFactory, isOpen, mode]);

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
    const fieldOrder = ["name", "phone", "email", "ownerId"];
    const firstField = fieldOrder.find((field) => Boolean(nextErrors[field]));
    if (!firstField) return;
    requestAnimationFrame(() => {
      const control = document.getElementById(`contact-${mode}-${firstField}`);
      control?.scrollIntoView({ behavior: "smooth", block: "center" });
      control?.focus({ preventScroll: true });
    });
  }, [mode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = t("contact.edit.validationNameRequired");
    if (draft.name.trim().length > 200) nextErrors.name = vi ? "Họ tên không được vượt quá 200 ký tự." : "Full name must not exceed 200 characters.";
    if (draft.email && !/\S+@\S+\.\S+/.test(draft.email)) nextErrors.email = t("contact.edit.validationEmail");
    if (draft.email.trim().length > 320) nextErrors.email = vi ? "Email không được vượt quá 320 ký tự." : "Email must not exceed 320 characters.";
    if (draft.phone.trim().length > 50) nextErrors.phone = vi ? "Số điện thoại không được vượt quá 50 ký tự." : "Phone must not exceed 50 characters.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      focusFirstInvalidField(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    try {
      await onSubmit({
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
      });
    } catch (error) {
      const normalized = normalizeApplicationError(error);
      const serverErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(normalized.fieldErrors ?? {})) {
        const localField = field === "fullName" ? "name" : field === "workEmail" ? "email" : field === "mobilePhone" ? "phone" : field;
        serverErrors[localField] = messages.join(" ");
      }
      setErrors((current) => ({ ...current, ...serverErrors }));
      setFormError(formatOperationUnavailableError(normalized, { locale }));
      focusFirstInvalidField(serverErrors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showComplete = mode === "edit" || showAdvanced;
  return (
    <Modal
      variant="form"
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? t("contactList.actions.addContact") : t("contact.edit.title")}
      size="lg"
    >
      <form id={`contact-${mode}-form`} onSubmit={submit} className="crm-form-surface space-y-5" data-guidance-id="contacts.form.canonical">
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
            {mode === "edit" ? <Input id={`contact-${mode}-organizationName`} label={t("contactList.quickCreate.organization")} value={draft.organizationName} onChange={(event) => update("organizationName", event.target.value)} error={errors.organizationName} /> : null}
            {mode === "edit" ? <Input label={t("contactList.form.contactCode")} value={draft.contactCode} onChange={(event) => update("contactCode", event.target.value)} /> : null}
            {showComplete ? <Input label={t("contact.edit.jobTitle")} value={draft.title} onChange={(event) => update("title", event.target.value)} /> : null}
            {showComplete ? <Input label={t("contact.edit.department")} value={draft.department} onChange={(event) => update("department", event.target.value)} /> : null}
            {showComplete ? (
              <Select label={t("contact.edit.decisionRole")} value={draft.decisionRole} onChange={(event) => update("decisionRole", event.target.value as ContactDecisionRole | "")}>
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
            {mode === "edit" ? (
              <Select label={t("contact.edit.avatarColor")} value={draft.avatarColor} onChange={(event) => update("avatarColor", event.target.value)}>
                <option value="">{t("common.notSet")}</option>
                <option value="indigo">Indigo</option><option value="emerald">Emerald</option><option value="violet">Violet</option><option value="amber">Amber</option><option value="rose">Rose</option><option value="cyan">Cyan</option>
              </Select>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="border-b border-indigo-50 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{t("contact.edit.communication")}</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input id={`contact-${mode}-phone`} label={t("contact.edit.phone")} value={draft.phone} onChange={(event) => update("phone", event.target.value)} error={errors.phone} />
            <Input id={`contact-${mode}-email`} label={t("contact.edit.email")} type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} error={errors.email} />
            {showComplete ? <Input label={t("contact.edit.zaloId")} value={draft.zaloId} onChange={(event) => update("zaloId", event.target.value)} /> : null}
            {showComplete ? (
              <Select label={t("contact.edit.preferredChannel")} value={draft.preferredChannel} onChange={(event) => update("preferredChannel", event.target.value as PreferredContactChannel | "")}>
                <option value="">{t("common.notSet")}</option>
                <option value="email">Email</option><option value="phone">Phone</option><option value="zalo">Zalo</option><option value="facebook">Facebook</option><option value="sms">SMS</option>
              </Select>
            ) : null}
            {showComplete ? <div className="md:col-span-2"><Input label={t("contact.edit.address")} value={draft.address} onChange={(event) => update("address", event.target.value)} /></div> : null}
            {mode === "edit" ? <div className="md:col-span-2"><Checkbox id={`contact-${mode}-consent`} label={t("contact.edit.communicationConsent")} checked={draft.communicationConsent} onChange={(event) => update("communicationConsent", event.target.checked)} /></div> : null}
          </div>
        </section>

        {mode === "edit" ? (
          <section className="space-y-3">
            <h4 className="border-b border-indigo-50 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{t("contact.edit.relationshipContext")}</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label={t("contact.edit.relationshipType")} value={draft.relationshipType} onChange={(event) => update("relationshipType", event.target.value)} />
              <Select label={t("contact.edit.influenceLevel")} value={draft.influenceLevel} onChange={(event) => update("influenceLevel", event.target.value as InfluenceLevel)}>
                <option value="low">{vi ? "Thấp" : "Low"}</option><option value="medium">{vi ? "Trung bình" : "Medium"}</option><option value="high">{vi ? "Cao" : "High"}</option>
              </Select>
              <Checkbox id={`contact-${mode}-primary`} label={t("contact.edit.isPrimaryContact")} checked={draft.isPrimaryContact} onChange={(event) => update("isPrimaryContact", event.target.checked)} />
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h4 className="border-b border-indigo-50 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{t("contact.edit.salesContext")}</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mode === "edit" ? <Input id={`contact-${mode}-nextFollowUpAt`} label={t("contact.edit.nextFollowUpAt")} type="datetime-local" value={draft.nextFollowUpAt} onChange={(event) => update("nextFollowUpAt", event.target.value)} error={errors.nextFollowUpAt} /> : null}
            <Select id={`contact-${mode}-ownerId`} label={t("contact.edit.ownerId")} value={draft.ownerId} onChange={(event) => update("ownerId", event.target.value)} disabled={!ownership?.canAssign} error={errors.ownerId}>
              {ownerOptions.map((owner) => <option key={owner.memberId} value={owner.memberId}>{owner.displayName}</option>)}
            </Select>
            {showComplete ? (
              <Select label={t("contactList.form.source")} value={draft.source} onChange={(event) => update("source", event.target.value)}>
                <option value="Website">{getTranslatedSource("Website", t)}</option>
                <option value="Hội thảo / Webinar">{getTranslatedSource("Hội thảo / Webinar", t)}</option>
                <option value="Giới thiệu / Referral">{getTranslatedSource("Giới thiệu / Referral", t)}</option>
                <option value="Facebook">Facebook</option><option value="Google Search">Google Search</option><option value="Direct">Direct</option>
              </Select>
            ) : null}
            {mode === "edit" ? (
              <Select label={t("contactList.filters.status")} value={draft.status} onChange={(event) => update("status", event.target.value as ContactStatus)}>
                <option value="active">{t("contactStatus.active")}</option><option value="needs_follow_up">{t("contactStatus.needs_follow_up")}</option><option value="in_consulting">{t("contactStatus.in_consulting")}</option><option value="has_open_opportunity">{t("contactStatus.has_open_opportunity")}</option><option value="inactive">{t("contactStatus.inactive")}</option>
                {mode === "edit" ? <option value="do_not_contact">{t("contactStatus.do_not_contact")}</option> : null}
                {mode === "edit" ? <option value="archived">{t("contactStatus.archived")}</option> : null}
              </Select>
            ) : null}
            {mode === "edit" ? (
              <Select label={t("contact.edit.priority")} value={draft.priority} onChange={(event) => update("priority", event.target.value as ContactPriority)}>
                <option value="LOW">{t("contactList.priority.low")}</option><option value="MEDIUM">{t("contactList.priority.medium")}</option><option value="HIGH">{t("contactList.priority.high")}</option><option value="URGENT">{t("contactList.priority.urgent")}</option>
              </Select>
            ) : null}
            {mode === "edit" ? <Input label={t("contact.edit.lastContactedAt")} type="datetime-local" value={draft.lastContactedAt} onChange={(event) => update("lastContactedAt", event.target.value)} /> : null}
            {showComplete ? <div className="md:col-span-2"><Input label={t("contact.edit.tags")} value={draft.tagsString} onChange={(event) => update("tagsString", event.target.value)} /></div> : null}
          </div>
        </section>

        {showComplete ? (
          <section className="space-y-3">
            <h4 className="border-b border-indigo-50 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{t("contact.edit.notesSection")}</h4>
            <Textarea label={t("contact.edit.notes")} value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
            {mode === "edit" ? <Textarea label={t("contact.edit.internalNotes")} value={draft.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /> : null}
          </section>
        ) : null}

        <div className="crm-form-action-bar sticky bottom-0 z-10 flex justify-end gap-2 border-t border-slate-100 bg-white pt-4">
          {formError ? <p role="alert" className="mr-auto text-sm font-medium text-rose-700">{formError}</p> : null}
          <Button variant="secondary" onClick={onClose} type="button" disabled={isSubmitting}>{t("common.cancel")}</Button>
          <Button variant="primary" type="submit" loading={isSubmitting} disabled={isSubmitting}>{mode === "create" ? t("contactList.form.btnSave", "Lưu liên hệ") : t("common.save")}</Button>
        </div>
      </form>
    </Modal>
  );
}
