import React from "react";
import { Input, Textarea } from "@/shared/components/ui";
import type { LeadProfileField } from "../../../domain/rules/leadProgressiveProfile";

export interface LeadTransitionProfileInput {
  companyName?: string;
  painPoint?: string;
  nextFollowUpAt?: string;
}

interface LeadVerificationRequirementsFormProps {
  locale: "vi" | "en";
  requiredFields: readonly LeadProfileField[];
  values: LeadTransitionProfileInput;
  errors: Partial<Record<LeadProfileField, string>>;
  onChange: (patch: LeadTransitionProfileInput) => void;
}

export const LeadVerificationRequirementsForm: React.FC<LeadVerificationRequirementsFormProps> = ({
  locale,
  requiredFields,
  values,
  errors,
  onChange,
}) => (
  <div className="grid gap-4" data-lead-transition-requirements-form="verification">
    {requiredFields.includes("companyName") && (
      <Input
        label={locale === "vi" ? "Công ty / tổ chức" : "Company / organization"}
        value={values.companyName ?? ""}
        onChange={(event) => onChange({ companyName: event.target.value })}
        error={errors.companyName}
        required
      />
    )}

    {requiredFields.includes("nextFollowUpAt") && (
      <Input
        type="datetime-local"
        label={locale === "vi" ? "Lịch chăm sóc tiếp theo" : "Next follow-up"}
        value={values.nextFollowUpAt ?? ""}
        onChange={(event) => onChange({ nextFollowUpAt: event.target.value })}
        error={errors.nextFollowUpAt}
        required
      />
    )}

    {requiredFields.includes("painPoint") && (
      <Textarea
        label={locale === "vi" ? "Nhu cầu / vấn đề cần giải quyết" : "Need / problem to solve"}
        value={values.painPoint ?? ""}
        onChange={(event) => onChange({ painPoint: event.target.value })}
        error={errors.painPoint}
        rows={4}
        required
      />
    )}
  </div>
);
