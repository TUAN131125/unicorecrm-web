import { formatApplicationError } from "@/shared/operations";
import { money } from "@/shared/money";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  User, 
  Building, 
  MapPin, 
  Activity, 
  Info, 
  FileText, 
  AlertCircle,
  Tag, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap
} from "lucide-react";
import { useI18n } from "@/i18n";
import { 
  Input, 
  Select, 
  Textarea, 
  Button,
  Switch,
} from "@/shared/components/ui";
import type { Lead, LeadSource, LeadCampaign } from "../../domain/model/lead.types";
import type { Product } from "@/modules/products";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";
import { validateLeadProgressiveProfile } from "../../domain/rules/leadProgressiveProfile";
import { FieldHelp } from "@/guidance/presentation/FieldHelp";
import { businessStatusLabel } from "@/i18n/productGlossary";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { validateLeadContactData } from "../../domain/rules/leadContactData";
import { useConfigurationRuntime, type RuntimeFormFieldPlacement } from "@/platform/configuration-runtime";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { dateTimeLocalValueToIso, normalizeDateTimeInputValue } from "@/shared/lib/datetime/workspaceDateTime";



interface LeadOwnerOption {
  memberId: string;
  displayName: string;
  email?: string;
}

export interface LeadFormProps {
  initialLead?: Partial<Lead>;
  onSubmit: (data: Partial<Lead>) => void | Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  isEdit?: boolean;
  ownerOptions?: LeadOwnerOption[];
  sources?: LeadSource[];
  campaigns?: LeadCampaign[];
  products?: Product[];
  defaultOwnerId?: string;
  canAssignOwner?: boolean;
  defaultMode?: "quick" | "complete";
  formId?: string;
  footerPortalId?: string;
}


type LeadCustomFieldValue = string | number | boolean | string[];

function evaluateCustomFieldVisibility(placement: RuntimeFormFieldPlacement, values: Record<string, LeadCustomFieldValue>): boolean {
  const condition = placement.visibilityCondition;
  if (!condition) return true;
  const current = values[condition.fieldKey];
  if (condition.operator === "HAS_VALUE") return current !== undefined && current !== "" && (!Array.isArray(current) || current.length > 0);
  if (condition.operator === "EQUALS") return String(current ?? "") === String(condition.value ?? "");
  return String(current ?? "") !== String(condition.value ?? "");
}
export function useLeadFormController(props: LeadFormProps) {
  const {
    initialLead,
    onSubmit,
    onCancel,
    isEdit = false,
    ownerOptions = [],
    sources = [],
    campaigns = [],
    products = [],
    defaultOwnerId,
    canAssignOwner = true,
    onDirtyChange,
    formId,
    footerPortalId,
  } = props;
  const defaultMode = props.defaultMode ?? (isEdit ? "complete" : "quick");
  const { t, locale } = useI18n();
  const configurationRuntime = useConfigurationRuntime();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const workspaceTimeZone = workspaceConfiguration.localeRegion.timezone;
  const formContext = isEdit ? "EDIT" : "CREATE";
  const isNewLead = !isEdit;
  const runtimeForm = React.useMemo(() => configurationRuntime.businessForms
    .filter((form) => form.objectType === "lead" && form.context === formContext && form.status === "EFFECTIVE")
    .sort((left, right) => right.version - left.version)[0], [configurationRuntime.businessForms, formContext]);
  const leadSchema = React.useMemo(() => configurationRuntime.objectSchemas.find((schema) => schema.objectType === "lead"), [configurationRuntime.objectSchemas]);
  const customFieldByKey = React.useMemo(() => new Map((leadSchema?.fields ?? []).filter((field) => field.origin === "CUSTOM" && field.status === "ACTIVE").map((field) => [field.key, field])), [leadSchema]);
  const customFormSections = React.useMemo(() => (runtimeForm?.sections ?? []).map((section) => ({
    ...section,
    fields: section.fields.filter((placement) => customFieldByKey.has(placement.fieldKey) && !placement.hidden),
  })).filter((section) => section.fields.length > 0), [customFieldByKey, runtimeForm]);
  const generatedFormId = React.useId();
  const resolvedFormId = formId || `lead-form-${generatedFormId.replace(/:/g, "")}`;
  const [footerPortalTarget, setFooterPortalTarget] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!footerPortalId || typeof document === "undefined") {
      setFooterPortalTarget(null);
      return;
    }
    setFooterPortalTarget(document.getElementById(footerPortalId));
  }, [footerPortalId]);

  const tf = (key: string, fallback?: string) => {
    const fullKey = `leadForm.${key}`;
    const value = t(fullKey);
    return value === fullKey ? (fallback ?? key) : value;
  };

  const defaultNextFollowUp = React.useMemo(() => {
    if (initialLead?.nextFollowUpAt) return normalizeDateTimeInputValue(initialLead.nextFollowUpAt, workspaceTimeZone);
    return "";
  }, [initialLead?.nextFollowUpAt, isEdit, workspaceTimeZone]);
  const [showAdvanced, setShowAdvanced] = useState(defaultMode === "complete");

  // Form fields state
  const [salutation, setSalutation] = useState(initialLead?.salutation || "");
  const [name, setName] = useState(initialLead?.name || "");
  const [title, setTitle] = useState(initialLead?.title || "");
  const [department, setDepartment] = useState(initialLead?.department || "");
  const [phone, setPhone] = useState(initialLead?.phone || "");
  const [workPhone, setWorkPhone] = useState(initialLead?.workPhone || "");
  const [otherPhone, setOtherPhone] = useState(initialLead?.otherPhone || "");
  const [email, setEmail] = useState(initialLead?.email || "");
  const [personalEmail, setPersonalEmail] = useState(initialLead?.personalEmail || "");
  const [zalo, setZalo] = useState(initialLead?.zaloId || "");
  const [facebook, setFacebook] = useState(initialLead?.facebook || "");
  const [preferredChannel, setPreferredChannel] = useState(() => {
    if (initialLead?.preferredChannel) return initialLead.preferredChannel;
    if (initialLead?.phone || initialLead?.workPhone || initialLead?.otherPhone) return "phone";
    if (initialLead?.email || initialLead?.personalEmail) return "email";
    if (initialLead?.zaloId) return "zalo";
    if (initialLead?.facebook) return "facebook";
    return "";
  });
  const [doNotCall, setDoNotCall] = useState(initialLead?.doNotCall || false);
  const [doNotEmail, setDoNotEmail] = useState(initialLead?.doNotEmail || false);

  // Corporate profiles
  const [companyName, setCompanyName] = useState(initialLead?.companyName || "");
  const [companySize, setCompanySize] = useState(initialLead?.companySize || "");
  const [industry, setIndustry] = useState(initialLead?.industry || "");
  const [businessType, setBusinessType] = useState(initialLead?.businessType || "");
  const [website, setWebsite] = useState(initialLead?.website || "");
  const [taxCode, setTaxCode] = useState(initialLead?.taxCode || "");

  // Regional address records
  const [companyAddress, setCompanyAddress] = useState(initialLead?.companyAddress || "");
  const [country, setCountry] = useState(initialLead?.country || "");
  const [province, setProvince] = useState(initialLead?.province || "");
  const [district, setDistrict] = useState(initialLead?.district || "");
  const [ward, setWard] = useState(initialLead?.ward || "");
  const [contactAddress, setContactAddress] = useState(initialLead?.contactAddress || initialLead?.address || "");

  // Marketing origin & Ownership
  const [sourceId, setSourceId] = useState(() => {
    if (!initialLead) return "";
    const matched = sources.find((source) => source.name === initialLead.source || source.id === initialLead.source);
    return matched ? matched.id : (initialLead.source || "");
  });
  const [campaignId, setCampaignId] = useState(initialLead?.campaignId || "");
  const availableOwnerOptions = React.useMemo(() => {
    const next = [...ownerOptions];
    const currentOwnerId = initialLead?.ownerId;
    if (currentOwnerId && !next.some((owner) => owner.memberId === currentOwnerId)) {
      next.push({ memberId: currentOwnerId, displayName: resolveWorkspaceMemberLabel(currentOwnerId, locale) });
    }
    return next;
  }, [initialLead?.ownerId, locale, ownerOptions]);
  const [ownerId, setOwnerId] = useState(initialLead?.ownerId || defaultOwnerId || availableOwnerOptions[0]?.memberId || "");
  const [assignedTeam, setAssignedTeam] = useState(initialLead?.assignedTeam || "");

  // Sales & Qualification
  const [decisionRole, setDecisionRole] = useState(initialLead?.decisionRole || "");
  const [priority, setPriority] = useState<"" | "low" | "medium" | "high">(initialLead?.priority || "");
  const [interestedProducts, setInterestedProducts] = useState<string[]>(() => {
    if (!initialLead?.interestedProducts) return [];
    return (initialLead.interestedProducts as any[]).map((p: any) => typeof p === "string" ? p : p.productId);
  });
  const [expectedValue, setExpectedValue] = useState<string>(initialLead?.expectedValue?.toString() || "");
  const [budgetRange, setBudgetRange] = useState(initialLead?.budgetRange || "");
  const [purchaseTimeline, setPurchaseTimeline] = useState(initialLead?.purchaseTimeline || "");
  const [painPoint, setPainPoint] = useState(initialLead?.painPoint || "");
  const [nextFollowUpAt, setNextFollowUpAt] = useState(defaultNextFollowUp);
  const [followUpNote, setFollowUpNote] = useState(initialLead?.followUpNote || "");
  const [tagsInput, setTagsInput] = useState(initialLead?.tags?.join(", ") || "");

  // Secondary text
  const [description, setDescription] = useState(initialLead?.description || "");
  const [internalNotes, setInternalNotes] = useState(initialLead?.internalNotes || "");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number | boolean | string[]>>(() => structuredClone(initialLead?.customFields ?? {}));

  // Zalo sync state
  const [syncZalo, setSyncZalo] = useState(Boolean(isEdit && initialLead?.zaloId && initialLead.zaloId === initialLead.phone));

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = React.useRef(false);

  // Sync Zalo with phone number when phone number changes & sync is active
  useEffect(() => {
    if (syncZalo) setZalo(phone);
  }, [phone, syncZalo]);

  useEffect(() => {
    const available = {
      phone: Boolean(phone.trim() || workPhone.trim() || otherPhone.trim()),
      email: Boolean(email.trim() || personalEmail.trim()),
      zalo: Boolean(zalo.trim()),
      facebook: Boolean(facebook.trim()),
    };
    if (preferredChannel && preferredChannel !== "other" && available[preferredChannel as keyof typeof available]) return;
    const nextChannel = available.phone ? "phone" : available.email ? "email" : available.zalo ? "zalo" : available.facebook ? "facebook" : "";
    if (preferredChannel !== nextChannel) setPreferredChannel(nextChannel);
  }, [email, facebook, otherPhone, personalEmail, phone, preferredChannel, workPhone, zalo]);

  useEffect(() => {
    if (!isEdit && defaultOwnerId && ownerId !== defaultOwnerId && !canAssignOwner) {
      setOwnerId(defaultOwnerId);
    }
  }, [canAssignOwner, defaultOwnerId, isEdit, ownerId]);

  const formSnapshot = JSON.stringify({
    salutation, name, title, department, phone, workPhone, otherPhone, email, personalEmail, zalo, facebook,
    preferredChannel, doNotCall, doNotEmail, companyName, companySize, industry, businessType, website, taxCode,
    companyAddress, country, province, district, ward, contactAddress, sourceId, campaignId, ownerId, assignedTeam,
    decisionRole, priority, interestedProducts, expectedValue, budgetRange, purchaseTimeline, painPoint, customFieldValues, nextFollowUpAt,
    followUpNote, tagsInput, description, internalNotes,
  });
  const initialSnapshotRef = React.useRef(formSnapshot);
  const isDirty = formSnapshot !== initialSnapshotRef.current;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Turn off sync if user manually overrides zalo and it differs from phone
  const handleZaloChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setZalo(val);
    if (val !== phone) {
      setSyncZalo(false);
    }
  };

  const focusFirstInvalidField = (fieldErrors: Record<string, string>) => {
    const fieldOrder = [
      "name", "phone", "workPhone", "otherPhone", "email", "personalEmail", "preferredChannel",
      "source", "ownerId", "nextFollowUpAt", "companyName", "painPoint", "expectedValue",
      ...customFormSections.flatMap((section) => section.fields.map((placement) => `custom:${placement.fieldKey}`)),
    ];
    const fieldIds: Record<string, string> = {
      name: "lead-name",
      phone: "lead-phone",
      workPhone: "lead-work-phone",
      otherPhone: "lead-other-phone",
      email: "lead-email",
      personalEmail: "lead-personal-email",
      preferredChannel: "lead-preferred-channel",
      source: "lead-source",
      ownerId: "lead-owner",
      nextFollowUpAt: "lead-next-follow-up",
      companyName: "lead-company-name",
      painPoint: "lead-pain-point",
      expectedValue: "lead-expected-value",
      ...Object.fromEntries(customFormSections.flatMap((section) => section.fields.map((placement) => [`custom:${placement.fieldKey}`, `lead-custom-${placement.fieldKey}`]))),
    };
    window.requestAnimationFrame(() => {
      for (const field of fieldOrder) {
        if (!fieldErrors[field]) continue;
        const element = document.getElementById(fieldIds[field]);
        if (!element) continue;
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.focus({ preventScroll: true });
        return;
      }
      document.getElementById("lead-form-error-summary")?.focus();
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = tf("validationNameRequired", "Full name is required.");

    const hasPhone = Boolean(phone.trim());
    const hasWorkPhone = Boolean(workPhone.trim());
    const hasOtherPhone = Boolean(otherPhone.trim());
    const hasEmail = Boolean(email.trim());
    const hasPersonalEmail = Boolean(personalEmail.trim());
    const hasZalo = Boolean(zalo.trim());
    const hasFacebook = Boolean(facebook.trim());
    if (!hasPhone && !hasWorkPhone && !hasOtherPhone && !hasEmail && !hasPersonalEmail && !hasZalo && !hasFacebook) {
      const message = tf("validationContactRequired", "Please enter at least one contact channel: phone, email, Zalo, or Facebook.");
      newErrors.phone = message;
    }

    Object.assign(newErrors, validateLeadContactData({ phone, workPhone, otherPhone, email, personalEmail }));

    const preferredChannelIsAvailable = preferredChannel === "phone"
      ? hasPhone || hasWorkPhone || hasOtherPhone
      : preferredChannel === "email"
        ? hasEmail || hasPersonalEmail
        : preferredChannel === "zalo"
          ? hasZalo
          : preferredChannel === "facebook"
            ? hasFacebook
            : preferredChannel === "other";
    if ((hasPhone || hasWorkPhone || hasOtherPhone || hasEmail || hasPersonalEmail || hasZalo || hasFacebook) && !preferredChannelIsAvailable) {
      newErrors.preferredChannel = tf("validationPreferredChannel", "Select an available preferred contact channel.");
    }

    if (expectedValue.trim()) {
      const numericValue = Number(expectedValue);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        newErrors.expectedValue = tf("validationExpectedValue", "Expected value must be zero or greater.");
      }
    }

    let normalizedNextFollowUpAt: string | undefined;
    if (nextFollowUpAt) {
      try {
        normalizedNextFollowUpAt = dateTimeLocalValueToIso(nextFollowUpAt, workspaceTimeZone);
      } catch (caught) {
        newErrors.nextFollowUpAt = formatApplicationError(caught, { locale });
      }
    }

    const lifecycleState = initialLead?.leadWorkState || LeadWorkState.NEW;
    const missingProfileFields = validateLeadProgressiveProfile({
      name,
      phone,
      workPhone,
      otherPhone,
      email,
      personalEmail,
      zaloId: zalo,
      facebook,
      companyName,
      source: sources.find((source) => source.id === sourceId)?.name || sourceId,
      ownerId,
      nextFollowUpAt: normalizedNextFollowUpAt,
      painPoint,
    }, lifecycleState, showAdvanced ? "COMPLETE" : "QUICK");
    if (missingProfileFields.includes("source")) newErrors.source = tf("validationSourceRequired");
    if (missingProfileFields.includes("ownerId")) newErrors.ownerId = tf("validationOwnerRequired");
    if (missingProfileFields.includes("nextFollowUpAt")) newErrors.nextFollowUpAt = tf("validationNextFollowUpRequired");
    if (missingProfileFields.includes("companyName")) newErrors.companyName = tf("validationCompanyRequired");
    if (missingProfileFields.includes("painPoint")) newErrors.painPoint = tf("validationPainPointRequired");

    for (const section of customFormSections) {
      for (const placement of section.fields) {
        const field = customFieldByKey.get(placement.fieldKey);
        if (!field || placement.readOnly) continue;
        const value = customFieldValues[field.key];
        const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
        const errorKey = `custom:${field.key}`;
        if ((placement.required || field.required) && empty) {
          newErrors[errorKey] = locale === "vi" ? `${field.labels.vi} là bắt buộc.` : `${field.labels.en} is required.`;
          continue;
        }
        if (empty) continue;
        if (["NUMBER", "CURRENCY"].includes(field.dataType)) {
          const numeric = Number(value);
          if (!Number.isFinite(numeric)) newErrors[errorKey] = locale === "vi" ? "Giá trị phải là số." : "Value must be numeric.";
          else if (field.validation?.min !== undefined && numeric < field.validation.min) newErrors[errorKey] = locale === "vi" ? `Giá trị tối thiểu là ${field.validation.min}.` : `Minimum value is ${field.validation.min}.`;
          else if (field.validation?.max !== undefined && numeric > field.validation.max) newErrors[errorKey] = locale === "vi" ? `Giá trị tối đa là ${field.validation.max}.` : `Maximum value is ${field.validation.max}.`;
        }
        if (typeof value === "string") {
          if (field.validation?.minLength !== undefined && value.length < field.validation.minLength) newErrors[errorKey] = locale === "vi" ? `Cần ít nhất ${field.validation.minLength} ký tự.` : `At least ${field.validation.minLength} characters are required.`;
          if (field.validation?.maxLength !== undefined && value.length > field.validation.maxLength) newErrors[errorKey] = locale === "vi" ? `Tối đa ${field.validation.maxLength} ký tự.` : `Maximum ${field.validation.maxLength} characters.`;
          if (field.validation?.pattern) {
            try { if (!new RegExp(field.validation.pattern).test(value)) newErrors[errorKey] = locale === "vi" ? "Giá trị không đúng định dạng." : "Value does not match the required format."; } catch { /* invalid patterns are blocked by schema validation */ }
          }
        }
      }
    }

    setErrors(newErrors);
    setFormError(null);
    if (Object.keys(newErrors).length > 0) {
      focusFirstInvalidField(newErrors);
      return;
    }

    const processedTags = tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean);
    const finalLeadData: Partial<Lead> = {
      salutation: salutation.trim() || undefined,
      name: name.trim(),
      title: title.trim() || undefined,
      department: department.trim() || undefined,
      phone: phone.trim() || undefined,
      workPhone: workPhone.trim() || undefined,
      otherPhone: otherPhone.trim() || undefined,
      email: email.trim() || undefined,
      personalEmail: personalEmail.trim() || undefined,
      zaloId: zalo.trim() || undefined,
      facebook: facebook.trim() || undefined,
      preferredChannel: preferredChannel || undefined,
      doNotCall,
      doNotEmail,
      companyName: companyName.trim() || undefined,
      companySize: companySize.trim() || undefined,
      industry: industry.trim() || undefined,
      businessType: businessType.trim() || undefined,
      website: website.trim() || undefined,
      taxCode: taxCode.trim() || undefined,
      companyAddress: companyAddress.trim() || undefined,
      country: country.trim() || undefined,
      province: province.trim() || undefined,
      district: district.trim() || undefined,
      ward: ward.trim() || undefined,
      contactAddress: contactAddress.trim() || undefined,
      address: contactAddress.trim() || undefined,
      ...(sourceId ? { source: sources.find((source) => source.id === sourceId)?.name || sourceId } : {}),
      campaignId: campaignId || undefined,
      ownerId: ownerId || undefined,
      assignedTeam: assignedTeam || undefined,
      decisionRole: decisionRole.trim() || undefined,
      ...(priority ? { priority } : {}),
      interestedProducts: interestedProducts.map((productId) => {
        const existing = (initialLead?.interestedProducts || []).find((product) => typeof product === "string" ? product === productId : product.productId === productId);
        if (existing && typeof existing !== "string") return existing;
        const product = products.find((candidate) => candidate.id === productId);
        return {
          id: `lip_${productId}_${Date.now()}`,
          productId,
          skuSnapshot: product?.sku,
          productNameSnapshot: product?.name || "",
          productTypeSnapshot: product?.type,
          interestLevel: "medium" as const,
          estimatedQuantity: 1,
          expectedBudget: product?.listPrice || 0,
          expectedBudgetMoney: money(String(product?.listPrice || 0), product?.currency || workspaceConfiguration.localeRegion.currencies.baseCurrency),
          createdAt: new Date().toISOString(),
        };
      }),
      ...(expectedValue ? {
        expectedValue: Number(expectedValue),
        estimatedValue: money(expectedValue, workspaceConfiguration.localeRegion.currencies.baseCurrency),
      } : {}),
      budgetRange: budgetRange.trim() || undefined,
      purchaseTimeline: purchaseTimeline.trim() || undefined,
      painPoint: painPoint.trim() || undefined,
      nextFollowUpAt: normalizedNextFollowUpAt,
      followUpNote: followUpNote.trim() || undefined,
      tags: processedTags,
      description: description.trim() || undefined,
      internalNotes: internalNotes.trim() || undefined,
      customFields: normalizeLeadCustomFields(customFieldValues),
    };

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      await onSubmit(finalLeadData);
      initialSnapshotRef.current = formSnapshot;
      onDirtyChange?.(false);
      setFormError(null);
    } catch (caught) {
      setFormError(formatApplicationError(caught, { locale }));
      window.requestAnimationFrame(() => document.getElementById("lead-form-error-summary")?.focus());
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };
  return {
    initialLead,
    onSubmit,
    onCancel,
    isEdit,
    ownerOptions,
    sources,
    campaigns,
    products,
    defaultOwnerId,
    canAssignOwner,
    defaultMode,
    onDirtyChange,
    formId,
    footerPortalId,
    evaluateCustomFieldVisibility,
    t,
    locale,
    configurationRuntime,
    workspaceTimeZone,
    formContext,
    runtimeForm,
    leadSchema,
    customFieldByKey,
    customFormSections,
    generatedFormId,
    resolvedFormId,
    footerPortalTarget,
    setFooterPortalTarget,
    tf,
    defaultNextFollowUp,
    showAdvanced,
    setShowAdvanced,
    salutation,
    setSalutation,
    name,
    setName,
    title,
    setTitle,
    department,
    setDepartment,
    phone,
    setPhone,
    workPhone,
    setWorkPhone,
    otherPhone,
    setOtherPhone,
    email,
    setEmail,
    personalEmail,
    setPersonalEmail,
    zalo,
    setZalo,
    facebook,
    setFacebook,
    preferredChannel,
    setPreferredChannel,
    doNotCall,
    setDoNotCall,
    doNotEmail,
    setDoNotEmail,
    companyName,
    setCompanyName,
    companySize,
    setCompanySize,
    industry,
    setIndustry,
    businessType,
    setBusinessType,
    website,
    setWebsite,
    taxCode,
    setTaxCode,
    companyAddress,
    setCompanyAddress,
    country,
    setCountry,
    province,
    setProvince,
    district,
    setDistrict,
    ward,
    setWard,
    contactAddress,
    setContactAddress,
    sourceId,
    setSourceId,
    campaignId,
    setCampaignId,
    availableOwnerOptions,
    ownerId,
    setOwnerId,
    assignedTeam,
    setAssignedTeam,
    decisionRole,
    setDecisionRole,
    priority,
    setPriority,
    interestedProducts,
    setInterestedProducts,
    expectedValue,
    setExpectedValue,
    budgetRange,
    setBudgetRange,
    purchaseTimeline,
    setPurchaseTimeline,
    painPoint,
    setPainPoint,
    nextFollowUpAt,
    setNextFollowUpAt,
    followUpNote,
    setFollowUpNote,
    tagsInput,
    setTagsInput,
    description,
    setDescription,
    internalNotes,
    setInternalNotes,
    customFieldValues,
    setCustomFieldValues,
    isNewLead,
    syncZalo,
    setSyncZalo,
    errors,
    setErrors,
    formError,
    setFormError,
    isSubmitting,
    setIsSubmitting,
    submitInFlightRef,
    formSnapshot,
    initialSnapshotRef,
    isDirty,
    handleZaloChange,
    focusFirstInvalidField,
    handleFormSubmit,
  };
}
function normalizeLeadCustomFields(
  values: Readonly<Record<string, string | number | boolean | readonly string[]>>,
): Record<string, string | number | boolean | string[]> {
  const normalized: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === "" || (Array.isArray(value) && value.length === 0)) continue;
    if (Array.isArray(value)) {
      normalized[key] = [...value];
      continue;
    }
    normalized[key] = value as string | number | boolean;
  }
  return normalized;
}
