import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  User, 
  Building, 
  MapPin, 
  Activity, 
  Info, 
  FileText, 
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
import { ProductPickerModal, type Product, type SelectedPickerItem } from "@/modules/products";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";
import { validateLeadProgressiveProfile } from "../../domain/rules/leadProgressiveProfile";
import { FieldHelp } from "@/guidance/presentation/FieldHelp";
import { businessStatusLabel } from "@/i18n/productGlossary";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { validateLeadContactData } from "../../domain/rules/leadContactData";
import { useConfigurationRuntime, type RuntimeFormFieldPlacement } from "@/platform/configuration-runtime";
import { addDurationAsDateTimeLocal, dateTimeLocalValueToIso, normalizeDateTimeInputValue } from "@/shared/lib/datetime/workspaceDateTime";
import type { useLeadFormController } from "../hooks/useLeadFormController";

type LeadFormViewController = ReturnType<typeof useLeadFormController>;

export function LeadFormView({ controller }: { controller: LeadFormViewController }) {
  const {
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
    handleFormSubmit,
  } = controller;

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const selectedProductItems: SelectedPickerItem[] = interestedProducts
    .map((productId) => products.find((product) => product.id === productId))
    .filter((product): product is Product => Boolean(product))
    .map((product) => ({ product, quantity: 1 }));

  return (
    <>
    <form id={resolvedFormId} onSubmit={handleFormSubmit} data-contained-form-layout="true" className="crm-form-surface flex h-full min-h-0 flex-col overflow-hidden text-slate-800 font-sans">
      {/* Scrollable Form Body */}
      <div 
        id="lead-form-scroll-container" 
        className="min-h-0 flex-1 overflow-y-auto crm-scroll-y px-6 py-5 space-y-7 pr-4 scroll-smooth"
      >
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4" data-guidance-id="leads.form.progressive-profile">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Zap size={17} /></span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">{showAdvanced ? tf("progressive.completeTitle") : tf("progressive.quickTitle")}</p>
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowAdvanced((current) => !current)} data-guidance-id="leads.form.advanced-toggle">
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showAdvanced ? tf("progressive.useQuick") : tf("progressive.showAdvanced")}
            </Button>
          </div>
        </div>

        {!showAdvanced ? (
          <div className="space-y-5" data-guidance-id="leads.form.quick-create">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input id="lead-name" label={tf("fields.fullName")} placeholder={tf("placeholders.fullName")} value={name} onChange={(event) => { setName(event.target.value); if (errors.name) setErrors({ ...errors, name: "" }); }} error={errors.name} required />
              <Input id="lead-company-name" label={tf("fields.companyName")} placeholder={tf("placeholders.companyName")} value={companyName} onChange={(event) => setCompanyName(event.target.value)} error={errors.companyName} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input id="lead-phone" label={tf("fields.mobilePhone")} placeholder={tf("placeholders.mobilePhone")} value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} error={errors.phone} />
              <Input id="lead-email" label={tf("fields.workEmail")} placeholder={tf("placeholders.workEmail")} type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select id="lead-source" label={tf("fields.source")} value={sourceId} onChange={(event) => setSourceId(event.target.value)} error={errors.source} required>
                <option value="">{tf("placeholders.selectSource")}</option>
                {sources.filter((source) => source.isActive).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
              </Select>
              <Input id="lead-next-follow-up" label={tf("fields.nextFollowUpAt")} type="datetime-local" value={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} error={errors.nextFollowUpAt} required />
            </div>
            <div data-guidance-id="leads.form.owner">
              <Select id="lead-owner" label={tf("fields.owner")} value={ownerId} onChange={(event) => setOwnerId(event.target.value)} disabled={!canAssignOwner} error={errors.ownerId} required>
                {availableOwnerOptions.map((owner) => <option key={owner.memberId} value={owner.memberId}>{owner.displayName}</option>)}
              </Select>
            </div>
          </div>
        ) : (
          <>
        {/* SECTION A: Basic contact information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
              <User size={16} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
              {tf("sections.basicContactInfo")}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
              label={tf("fields.salutation")}
              placeholder={tf("placeholders.salutation")}
              value={salutation}
              onChange={(e) => setSalutation(e.target.value)}
            />
            <div className="md:col-span-2">
              <Input 
                id="lead-name"
                label={tf("fields.fullName")}
                placeholder={tf("placeholders.fullName")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors({ ...errors, name: "" });
                  }
                }}
                error={errors.name}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label={tf("fields.jobTitle")}
              placeholder={tf("placeholders.jobTitle")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input 
              label={tf("fields.department")}
              placeholder={tf("placeholders.department")}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
              id="lead-phone"
              label={tf("fields.mobilePhone")}
              placeholder={tf("placeholders.mobilePhone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              error={errors.phone}
            />
            <Input 
              id="lead-work-phone"
              label={tf("fields.workPhone")}
              placeholder={tf("placeholders.workPhone")}
              value={workPhone}
              onChange={(e) => setWorkPhone(e.target.value)}
              inputMode="tel"
              error={errors.workPhone}
            />
            <Input 
              id="lead-other-phone"
              label={tf("fields.otherPhone")}
              placeholder={tf("placeholders.otherPhone")}
              value={otherPhone}
              onChange={(e) => setOtherPhone(e.target.value)}
              inputMode="tel"
              error={errors.otherPhone}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              id="lead-email"
              label={tf("fields.workEmail")}
              placeholder={tf("placeholders.workEmail")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Input 
              id="lead-personal-email"
              label={tf("fields.personalEmail")}
              placeholder={tf("placeholders.personalEmail")}
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              error={errors.personalEmail}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Input 
                label={tf("fields.zalo")}
                placeholder={tf("placeholders.zalo")}
                value={zalo}
                onChange={handleZaloChange}
              />
              <div className="mt-2 text-left">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={syncZalo} 
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSyncZalo(checked);
                      if (checked) {
                        setZalo(phone);
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {tf("zaloSyncLabel")}
                  </span>
                </label>
              </div>
            </div>
            <Input 
              label={tf("fields.facebook")}
              placeholder={tf("placeholders.facebook")}
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1.5 bg-slate-50/50 rounded-xl px-4 border border-slate-100">
            <Select
              id="lead-preferred-channel"
              label={tf("fields.preferredChannel")}
              value={preferredChannel}
              error={errors.preferredChannel}
              onChange={(e) => setPreferredChannel(e.target.value)}
            >
              <option value="">{tf("placeholders.selectPreferredChannel", "Select a contact channel")}</option>
              <option value="phone">{tf("options.preferredChannel.phone")}</option>
              <option value="email">{tf("options.preferredChannel.email")}</option>
              <option value="zalo">{tf("options.preferredChannel.zalo")}</option>
              <option value="facebook">{tf("options.preferredChannel.facebook")}</option>
              <option value="other">{tf("options.preferredChannel.other")}</option>
            </Select>

            <div className="flex items-center h-full pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={doNotCall}
                  onChange={(e) => setDoNotCall(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-600">
                  {tf("fields.doNotCall")}
                </span>
              </label>
            </div>

            <div className="flex items-center h-full pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={doNotEmail}
                  onChange={(e) => setDoNotEmail(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-600">
                  {tf("fields.doNotEmail")}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* SECTION B: Company information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
              <Building size={16} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
              {tf("sections.companyInfo")}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              id="lead-company-name"
              label={tf("fields.companyName")}
              placeholder={tf("placeholders.companyName")}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              error={errors.companyName}
            />
            <Select 
              label={tf("fields.companySize")}
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
            >
              <option value="">{tf("placeholders.companySize")}</option>
              <option value="1-10">1 - 10 {tf("options.companySize.suffix")}</option>
              <option value="11-50">11 - 50 {tf("options.companySize.suffix")}</option>
              <option value="51-200">51 - 200 {tf("options.companySize.suffix")}</option>
              <option value="201-500">201 - 500 {tf("options.companySize.suffix")}</option>
              <option value="500+">500+ {tf("options.companySize.suffix")}</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label={tf("fields.industry")}
              placeholder={tf("placeholders.industry")}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
            <Input 
              label={tf("fields.businessType")}
              placeholder={tf("placeholders.businessType")}
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label={tf("fields.website")}
              placeholder={tf("placeholders.website")}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
            <Input 
              label={tf("fields.taxCode")}
              placeholder={tf("placeholders.taxCode")}
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
            />
          </div>
        </div>

        {/* SECTION C: Address records */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
              <MapPin size={16} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
              {tf("sections.addressInfo")}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label={tf("fields.country")}
              placeholder={tf("placeholders.country")}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
            <Input 
              label={tf("fields.province")}
              placeholder={tf("placeholders.province")}
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label={tf("fields.district")}
              placeholder={tf("placeholders.district")}
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
            <Input 
              label={tf("fields.ward")}
              placeholder={tf("placeholders.ward")}
              value={ward}
              onChange={(e) => setWard(e.target.value)}
            />
          </div>

          <Input 
            label={tf("fields.contactAddress")}
            placeholder={tf("placeholders.contactAddress")}
            value={contactAddress}
            onChange={(e) => setContactAddress(e.target.value)}
          />

          <Input 
            label={tf("fields.companyAddress")}
            placeholder={tf("placeholders.companyAddress")}
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
          />
        </div>

        {/* SECTION D: Marketing origin & Ownership */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
              <Tag size={16} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
              {tf("sections.sourceOwnership")}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              id="lead-source"
              label={tf("fields.source")}
              value={sourceId}
              error={errors.source}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">{tf("placeholders.selectSource")}</option>
              {sources.map(source => (
                <option key={source.id} value={source.id}>{source.name}</option>
              ))}
            </Select>

            <Select 
              label={tf("fields.campaign")}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">{tf("placeholders.selectCampaign")}</option>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </Select>

            <div data-guidance-id="leads.form.owner" className="relative">
              <FieldHelp helpKey="field.leads.owner" className="absolute right-0 top-0 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-violet-50 hover:text-violet-700" />
              <Select 
                id="lead-owner"
                label={tf("fields.owner")}
                value={ownerId}
                error={errors.ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                disabled={!canAssignOwner || isEdit}
              >
                <option value="">{tf("placeholders.selectOwner")}</option>
                {availableOwnerOptions.map((owner) => (
                  <option key={owner.memberId} value={owner.memberId}>{owner.displayName}</option>
                ))}
              </Select>
            </div>

            <Select 
              label={tf("fields.assignedTeam")}
              value={assignedTeam}
              onChange={(e) => setAssignedTeam(e.target.value)}
            >
              <option value="">{tf("placeholders.selectTeam")}</option>
              <option value="Sales">{tf("options.assignedTeam.sales")}</option>
              <option value="Marketing">{tf("options.assignedTeam.marketing")}</option>
              <option value="Customer Success">{tf("options.assignedTeam.success")}</option>
              <option value="Other">{tf("options.assignedTeam.other")}</option>
            </Select>
          </div>
        </div>

        {/* SECTION E: Sales & Qualification indicators */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
              <Activity size={16} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
              {tf("sections.salesContext")}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label={tf("fields.priority")}
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
            >
              <option value="low">{tf("options.priority.low")}</option>
              <option value="medium">{tf("options.priority.medium")}</option>
              <option value="high">{tf("options.priority.high")}</option>
            </Select>

            <Input 
              id="lead-expected-value"
              label={tf("fields.expectedValue")}
              placeholder="e.g., 25000000"
              type="number"
              min={0}
              step="1"
              error={errors.expectedValue}
              value={expectedValue}
              onChange={(e) => setExpectedValue(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label={tf("fields.budgetRange")}
              placeholder={tf("placeholders.budgetRange")}
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value)}
            />
            <Input 
              label={tf("fields.purchaseTimeline")}
              placeholder={tf("placeholders.purchaseTimeline")}
              value={purchaseTimeline}
              onChange={(e) => setPurchaseTimeline(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Select
              label={tf("fields.decisionRole")}
              value={decisionRole}
              onChange={(e) => setDecisionRole(e.target.value)}
            >
              <option value="">{tf("placeholders.decisionRolePlaceholder")}</option>
              <option value="Decision Maker">{tf("options.decisionRole.decisionMaker")}</option>
              <option value="Influencer">{tf("options.decisionRole.influencer")}</option>
              <option value="End User">{tf("options.decisionRole.endUser")}</option>
              <option value="Evaluator">{tf("options.decisionRole.evaluator")}</option>
              <option value="Gatekeeper">{tf("options.decisionRole.gatekeeper")}</option>
            </Select>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-700">{tf("fields.interestedProducts")}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {locale === "vi" ? "Tìm và chọn từ danh mục sản phẩm thay vì tải toàn bộ danh sách vào biểu mẫu." : "Search and select from the product catalog instead of loading the full catalog in the form."}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setProductPickerOpen(true)}>
                {locale === "vi" ? "Chọn sản phẩm" : "Select products"}
              </Button>
            </div>
            {selectedProductItems.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
                {locale === "vi" ? "Chưa chọn sản phẩm quan tâm." : "No interested products selected."}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {selectedProductItems.map(({ product }) => (
                  <div key={product.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-0.5 break-all text-[10px] text-slate-500">{product.sku}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInterestedProducts((current) => current.filter((id) => id !== product.id))}
                      className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-900"
                    >
                      {locale === "vi" ? "Bỏ" : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Textarea 
            id="lead-pain-point"
            label={tf("fields.painPoint")}
            error={errors.painPoint}
            placeholder={tf("placeholders.painPoint")}
            value={painPoint}
            onChange={(e) => setPainPoint(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              id="lead-next-follow-up"
              label={tf("fields.nextFollowUpAt")}
              type="datetime-local"
              error={errors.nextFollowUpAt}
              value={nextFollowUpAt}
              onChange={(e) => setNextFollowUpAt(e.target.value)}
            />
            <Input 
              label={tf("fields.followUpNote")}
              placeholder={tf("placeholders.followUpNote")}
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
            />
          </div>

          <Input 
            label={tf("fields.tags")}
            placeholder={tf("placeholders.tags")}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
        </div>

        {/* SECTION F: Descriptions & Internal notes */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg">
              <FileText size={16} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
              {tf("sections.descriptionNotes")}
            </h3>
          </div>

          <Textarea 
            label={tf("fields.description")}
            placeholder={tf("placeholders.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Textarea 
            label={tf("fields.internalNotes")}
            placeholder={tf("placeholders.internalNotes")}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
          />
        </div>

        {customFormSections.map((section) => (
          <div key={section.id} className="space-y-4" data-configuration-consumer="lead-business-form">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="rounded-lg bg-violet-50 p-1.5 text-violet-600"><Sparkles size={16} /></div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">{section.labels[locale]}</h3>
            </div>
            <div className={`grid grid-cols-1 gap-4 ${section.columns === 2 ? "md:grid-cols-2" : ""}`}>
              {section.fields.map((placement) => {
                const field = customFieldByKey.get(placement.fieldKey);
                if (!field) return null;
                const visible = evaluateCustomFieldVisibility(placement, customFieldValues);
                if (!visible) return null;
                const value = customFieldValues[field.key];
                const label = field.labels[locale];
                const error = errors[`custom:${field.key}`];
                const setValue = (next: string | number | boolean | string[]) => setCustomFieldValues((current) => ({ ...current, [field.key]: next }));
                const common = { id: `lead-custom-${field.key}`, disabled: Boolean(placement.readOnly || field.readOnly), "aria-invalid": Boolean(error), "aria-describedby": error ? `lead-custom-${field.key}-error` : undefined };
                return (
                  <label key={field.key} className={`space-y-1 ${placement.columnSpan === 2 ? "md:col-span-2" : ""}`}>
                    <span className="text-xs font-bold text-slate-600">{label}{(placement.required || field.required) ? " *" : ""}</span>
                    {field.dataType === "CHECKBOX" ? (
                      <div className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3.5 text-sm ${value ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}><span>{Boolean(value) ? (locale === "vi" ? "Đã bật" : "Enabled") : (locale === "vi" ? "Đã tắt" : "Disabled")}</span><Switch id={common.id} checked={Boolean(value)} disabled={common.disabled} ariaLabel={`${label}: ${Boolean(value) ? (locale === "vi" ? "Đã bật" : "Enabled") : (locale === "vi" ? "Đã tắt" : "Disabled")}`} onCheckedChange={(checked) => setValue(checked)} /></div>
                    ) : field.dataType === "SELECT" ? (
                      <select {...common} value={typeof value === "string" ? value : ""} onChange={(event) => setValue(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"><option value="">{locale === "vi" ? "Chọn giá trị" : "Select a value"}</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.labels[locale]}</option>)}</select>
                    ) : field.dataType === "MULTI_SELECT" ? (
                      <select {...common} multiple value={Array.isArray(value) ? value.map(String) : []} onChange={(event) => setValue(Array.from(event.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>, (option) => option.value))} className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">{field.options?.map((option) => <option key={option.value} value={option.value}>{option.labels[locale]}</option>)}</select>
                    ) : (
                      <Input {...common} type={field.dataType === "DATE" ? "date" : ["NUMBER", "CURRENCY"].includes(field.dataType) ? "number" : "text"} value={typeof value === "string" || typeof value === "number" ? value : ""} min={field.validation?.min} max={field.validation?.max} onChange={(event) => setValue(["NUMBER", "CURRENCY"].includes(field.dataType) && event.target.value !== "" ? Number(event.target.value) : event.target.value)} className="h-11" />
                    )}
                    {error && <span id={`lead-custom-${field.key}-error`} className="block text-[11px] font-semibold text-rose-600">{error}</span>}
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {/* SECTION G: System Indicators (Read-Only) */}
        {isEdit && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="bg-slate-100 text-slate-600 p-1.5 rounded-lg">
                <Info size={16} />
              </div>
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                {tf("sections.systemInfo")}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4 text-[11px] space-y-1">
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.status")}</p>
                <div className="mt-1 font-extrabold text-xs text-indigo-600 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                  <span>{businessStatusLabel(initialLead?.qualificationOutcome || initialLead?.leadWorkState, locale)}</span>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.owner")}</p>
                <p className="mt-1 font-semibold text-slate-700">
                  {availableOwnerOptions.find((owner) => owner.memberId === initialLead?.ownerId)?.displayName || resolveWorkspaceMemberLabel(initialLead?.ownerId, locale)}
                </p>
              </div>

              {initialLead?.createdBy && (
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.createdBy")}</p>
                  <p className="mt-1 font-semibold text-slate-700">{resolveWorkspaceMemberLabel(initialLead.createdBy, locale)}</p>
                </div>
              )}

              {initialLead?.createdAt && (
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.createdAt")}</p>
                  <p className="mt-1 font-semibold text-slate-700">{initialLead.createdAt}</p>
                </div>
              )}

              {initialLead?.updatedBy && (
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.updatedBy", "Updated By")}</p>
                  <p className="mt-1 font-semibold text-slate-700">{resolveWorkspaceMemberLabel(initialLead.updatedBy, locale)}</p>
                </div>
              )}

              {initialLead?.updatedAt && (
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.updatedAt")}</p>
                  <p className="mt-1 font-semibold text-slate-700">{initialLead.updatedAt}</p>
                </div>
              )}

              {initialLead?.relationshipRef && (
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.relationshipRef", "Liên kết quan hệ")}</p>
                  <p className="mt-1 font-semibold text-slate-700">{initialLead.relationshipRef.type}:{initialLead.relationshipRef.id}</p>
                </div>
              )}

              {initialLead?.dealRef && (
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.dealRef", "Cơ hội liên kết")}</p>
                  <p className="mt-1 font-semibold text-slate-700">{initialLead.dealRef}</p>
                </div>
              )}

              {initialLead?.disqualificationReason && (
                <div className="md:col-span-2">
                  <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.disqualificationReason", "Lý do loại bỏ (Disqualification)")}</p>
                  <p className="mt-1 font-semibold text-rose-600">
                    {initialLead.disqualificationReason} {initialLead.disqualificationNote ? `- ${initialLead.disqualificationNote}` : ""}
                  </p>
                </div>
              )}

              {initialLead?.recontactAt && (
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">{tf("fields.recontactAt", "Ngày liên hệ lại")}</p>
                  <p className="mt-1 font-semibold text-slate-700">{initialLead.recontactAt}</p>
                </div>
              )}
            </div>
            
          </div>
        )}
        {formError && (
          <p id="lead-form-error-summary" role="alert" aria-live="polite" tabIndex={-1} className="text-xs font-medium text-rose-700">
            {formError}
          </p>
        )}
          </>
        )}
      </div>

      {!footerPortalId && (
        <div className="crm-form-action-bar relative z-10 flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-12px_24px_-24px_rgba(15,23,42,0.45)]">
          <Button type="button" variant="secondary" size="md" className="min-w-28" onClick={onCancel} disabled={isSubmitting}>
            {tf("buttons.cancel")}
          </Button>
          <Button type="submit" variant="primary" size="md" className="min-w-28" loading={isSubmitting} loadingText={tf("buttons.saving", "Saving...")}>
            {tf("buttons.save")}
          </Button>
        </div>
      )}
    </form>
    {footerPortalId && footerPortalTarget
      ? createPortal((
          <>
            <Button type="button" variant="secondary" size="md" className="min-w-28" onClick={onCancel} disabled={isSubmitting}>
              {tf("buttons.cancel")}
            </Button>
            <Button form={resolvedFormId} type="submit" variant="primary" size="md" className="min-w-28" loading={isSubmitting} loadingText={tf("buttons.saving", "Saving...")}>
              {tf("buttons.save")}
            </Button>
          </>
        ), footerPortalTarget)
      : null}
    <ProductPickerModal
      id="lead-interested-product-picker"
      isOpen={productPickerOpen}
      onClose={() => setProductPickerOpen(false)}
      products={products}
      context="lead_interest"
      initialSelected={selectedProductItems}
      onApply={(items) => setInterestedProducts(items.map((item) => item.product.id))}
    />
    </>
  );

}
