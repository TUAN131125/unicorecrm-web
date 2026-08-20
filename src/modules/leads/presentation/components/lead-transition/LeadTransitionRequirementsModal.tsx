import { formatApplicationError } from "@/shared/operations";
import React from "react";
import { Button, Modal } from "@/shared/components/ui";
import type { Lead } from "../../../domain/model/lead.types";
import type { LeadProfileField } from "../../../domain/rules/leadProgressiveProfile";
import { useI18n } from "@/i18n";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import {
  dateTimeLocalValueToIso,
  normalizeDateTimeInputValue,
} from "@/shared/lib/datetime/workspaceDateTime";
import {
  LeadVerificationRequirementsForm,
  type LeadTransitionProfileInput,
} from "./LeadVerificationRequirementsForm";

interface LeadTransitionRequirementsModalProps {
  isOpen: boolean;
  lead: Lead | null;
  requiredFields: readonly LeadProfileField[];
  onClose: () => void;
  onConfirm: (input: LeadTransitionProfileInput) => void;
}

const supportedFields = new Set<LeadProfileField>(["companyName", "painPoint", "nextFollowUpAt"]);

export const LeadTransitionRequirementsModal: React.FC<LeadTransitionRequirementsModalProps> = ({
  isOpen,
  lead,
  requiredFields,
  onClose,
  onConfirm,
}) => {
  const { locale } = useI18n();
  const configuration = useWorkspaceOperationalConfiguration();
  const workspaceTimeZone = configuration.localeRegion.timezone;
  const formId = "lead-transition-requirements-form";
  const [values, setValues] = React.useState<LeadTransitionProfileInput>({});
  const [errors, setErrors] = React.useState<Partial<Record<LeadProfileField, string>>>({});

  const editableFields = React.useMemo(
    () => requiredFields.filter((field) => supportedFields.has(field)),
    [requiredFields],
  );

  React.useEffect(() => {
    if (!isOpen || !lead) return;
    setValues({
      companyName: lead.companyName || "",
      painPoint: lead.painPoint || "",
      nextFollowUpAt: normalizeDateTimeInputValue(lead.nextFollowUpAt, workspaceTimeZone),
    });
    setErrors({});
  }, [isOpen, lead, workspaceTimeZone]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!lead) return;

    const nextErrors: Partial<Record<LeadProfileField, string>> = {};
    if (editableFields.includes("companyName") && !values.companyName?.trim()) {
      nextErrors.companyName = locale === "vi" ? "Hãy nhập tên công ty hoặc tổ chức." : "Enter the company or organization name.";
    }
    if (editableFields.includes("painPoint") && !values.painPoint?.trim()) {
      nextErrors.painPoint = locale === "vi" ? "Hãy ghi nhận nhu cầu hoặc vấn đề cần giải quyết." : "Record the need or problem to solve.";
    }
    if (editableFields.includes("nextFollowUpAt") && !values.nextFollowUpAt) {
      nextErrors.nextFollowUpAt = locale === "vi" ? "Hãy chọn lịch chăm sóc tiếp theo." : "Select the next follow-up time.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      onConfirm({
        ...(editableFields.includes("companyName") ? { companyName: values.companyName?.trim() } : {}),
        ...(editableFields.includes("painPoint") ? { painPoint: values.painPoint?.trim() } : {}),
        ...(editableFields.includes("nextFollowUpAt") && values.nextFollowUpAt
          ? { nextFollowUpAt: dateTimeLocalValueToIso(values.nextFollowUpAt, workspaceTimeZone) }
          : {}),
      });
    } catch (error) {
      setErrors({
        nextFollowUpAt: formatApplicationError(error, {
          locale,
          fallbackMessage: locale === "vi" ? "Thời gian đã chọn không hợp lệ." : "The selected time is invalid.",
        }),
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen && editableFields.length > 0}
      onClose={onClose}
      title={locale === "vi" ? "Bổ sung thông tin theo cấu hình" : "Complete configured information"}
      size="sm"
      variant="form"
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {locale === "vi" ? "Hủy" : "Cancel"}
          </Button>
          <Button type="submit" form={formId}>
            {locale === "vi" ? "Tiếp tục" : "Continue"}
          </Button>
        </>
      )}
    >
      {lead && (
        <form id={formId} onSubmit={handleSubmit}>
          <LeadVerificationRequirementsForm
            locale={locale}
            requiredFields={editableFields}
            values={values}
            errors={errors}
            onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          />
        </form>
      )}
    </Modal>
  );
};

export type { LeadTransitionProfileInput } from "./LeadVerificationRequirementsForm";
