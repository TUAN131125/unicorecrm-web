import { formatApplicationError } from "@/shared/operations";
import React from "react";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
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
  onConfirm: (input: LeadTransitionProfileInput) => void | Promise<unknown>;
  onSave?: (input: LeadTransitionProfileInput) => Promise<boolean>;
  onBindSave?: (save: (() => Promise<boolean>) | undefined) => void;
  onPendingChange?: (pending: boolean) => void;
}

const supportedFields = new Set<LeadProfileField>(["companyName", "painPoint", "nextFollowUpAt"]);

export const LeadTransitionRequirementsModal: React.FC<LeadTransitionRequirementsModalProps> = ({
  isOpen,
  lead,
  requiredFields,
  onClose,
  onConfirm,
  onSave,
  onBindSave,
  onPendingChange,
}) => {
  const { locale } = useI18n();
  const configuration = useWorkspaceOperationalConfiguration();
  const workspaceTimeZone = configuration.localeRegion.timezone;
  const formId = "lead-transition-requirements-form";
  const [values, setValues] = React.useState<LeadTransitionProfileInput>({});
  const [errors, setErrors] = React.useState<Partial<Record<LeadProfileField, string>>>({});
  const pending = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const mounted = React.useRef(true);
  const wasOpen = React.useRef(false);
  const opening = React.useRef({ targetId: lead?.id, workspaceId: getWorkspaceContextSnapshot().workspaceId, cycle: 0 });
  const live = React.useRef({ isOpen, targetId: lead?.id }); live.current = { isOpen, targetId: lead?.id };
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const editableFields = React.useMemo(
    () => requiredFields.filter((field) => supportedFields.has(field)),
    [requiredFields],
  );

  React.useEffect(() => {
    const opened = isOpen && !wasOpen.current;
    if (isOpen !== wasOpen.current) opening.current.cycle++;
    wasOpen.current = isOpen;
    if (!opened || !lead) return;
    opening.current = { targetId: lead.id, workspaceId: getWorkspaceContextSnapshot().workspaceId, cycle: opening.current.cycle };
    setValues({
      companyName: lead.companyName || "",
      painPoint: lead.painPoint || "",
      nextFollowUpAt: normalizeDateTimeInputValue(lead.nextFollowUpAt, workspaceTimeZone),
    });
    setErrors({});
  }, [isOpen, lead, workspaceTimeZone]);

  const save = async (): Promise<boolean> => {
    if (!lead || !isOpen || pending.current || !mounted.current || opening.current.targetId !== lead.id
      || opening.current.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false;
    const cycle = opening.current.cycle;

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
      return false;
    }

    try {
      pending.current = true; setBusy(true); onPendingChange?.(true);
      const input = {
        ...(editableFields.includes("companyName") ? { companyName: values.companyName?.trim() } : {}),
        ...(editableFields.includes("painPoint") ? { painPoint: values.painPoint?.trim() } : {}),
        ...(editableFields.includes("nextFollowUpAt") && values.nextFollowUpAt
          ? { nextFollowUpAt: dateTimeLocalValueToIso(values.nextFollowUpAt, workspaceTimeZone) }
          : {}),
      };
      const saved = onSave ? (await onSave(input)) === true : (await onConfirm(input)) !== false;
      if (!saved || !mounted.current || cycle !== opening.current.cycle || !live.current.isOpen
        || opening.current.targetId !== live.current.targetId || opening.current.workspaceId !== getWorkspaceContextSnapshot().workspaceId) return false;
      if (onSave) onClose();
      return true;
    } catch (error) {
      setErrors({
        nextFollowUpAt: formatApplicationError(error, {
          locale,
          fallbackMessage: locale === "vi" ? "Thời gian đã chọn không hợp lệ." : "The selected time is invalid.",
        }),
      });
      return false;
    } finally { pending.current = false; onPendingChange?.(false); if (mounted.current) setBusy(false); }
  };
  React.useEffect(() => {
    const lease = { active: true };
    onBindSave?.(() => lease.active && onSave ? save() : Promise.resolve(false));
    return () => { lease.active = false; onBindSave?.(undefined); };
  });
  const handleSubmit = async (event: React.FormEvent) => { event.preventDefault(); await save(); };

  return (
    <Modal
      isOpen={isOpen && editableFields.length > 0}
      onClose={() => { if (!pending.current) onClose(); }}
      title={locale === "vi" ? "Bổ sung thông tin theo cấu hình" : "Complete configured information"}
      size="sm"
      variant="form"
      footer={(
        <>
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {locale === "vi" ? "Hủy" : "Cancel"}
          </Button>
          <Button type="submit" form={formId} loading={busy} disabled={busy}>
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
            onChange={(patch) => { if (!pending.current) setValues((current) => ({ ...current, ...patch })); }}
          />
        </form>
      )}
    </Modal>
  );
};

export type { LeadTransitionProfileInput } from "./LeadVerificationRequirementsForm";
