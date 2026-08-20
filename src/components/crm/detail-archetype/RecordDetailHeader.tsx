import React from "react";
import { ArrowLeft } from "lucide-react";
import { IconButton } from "@/shared/components/ui";
import {
  recordDetailHeaderActionsClassName,
  recordDetailHeaderAvatarClassName,
  recordDetailHeaderIdentityClassName,
  recordDetailHeaderMainRowClassName,
  recordDetailHeaderMetadataClassName,
  recordDetailHeaderShellClassName,
  recordDetailHeaderTitleClassName,
} from "./recordDetailHeaderContract";

export interface RecordDetailHeaderProps {
  backLabel: string;
  onBack(): void;
  identityIcon: React.ReactNode;
  identityToneClassName: string;
  title: React.ReactNode;
  status?: React.ReactNode;
  metadata?: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
  titleOverflow?: "crm-text-wrap" | "wrap-mobile";
  accessibleTitle?: string;
  actionsPlacement?: "inline" | "stacked" | "responsive";
}

export const RecordDetailHeader: React.FC<RecordDetailHeaderProps> = ({
  backLabel,
  onBack,
  identityIcon,
  identityToneClassName,
  title,
  status,
  metadata,
  actions,
  id,
  titleOverflow = "crm-text-wrap",
  accessibleTitle,
  actionsPlacement = "responsive",
}) => {
  const inlineActions = actions && actionsPlacement !== "stacked";
  const stackedActions = actions && actionsPlacement === "stacked";
  const mainRowClassName = actionsPlacement === "inline"
    ? recordDetailHeaderMainRowClassName.inline
    : actionsPlacement === "stacked"
      ? recordDetailHeaderMainRowClassName.stacked
      : recordDetailHeaderMainRowClassName.responsive;
  const actionsClassName = actionsPlacement === "inline"
    ? recordDetailHeaderActionsClassName.inline
    : actionsPlacement === "stacked"
      ? recordDetailHeaderActionsClassName.stacked
      : recordDetailHeaderActionsClassName.responsive;

  return (
    <div id={id} data-record-detail-header="v1" className={recordDetailHeaderShellClassName}>
      <div className={mainRowClassName}>
        <div className={recordDetailHeaderIdentityClassName}>
          <div className="flex items-start gap-4">
            <IconButton
              type="button"
              onClick={onBack}
              variant="secondary"
              size="sm"
              title={backLabel}
              aria-label={backLabel}
            >
              <ArrowLeft size={14} />
            </IconButton>

            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className={`${recordDetailHeaderAvatarClassName} ${identityToneClassName}`}>
                {identityIcon}
              </div>
              <div className="min-w-0 flex-1 space-y-1 text-left">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2
                    className={`${recordDetailHeaderTitleClassName} ${titleOverflow === "wrap-mobile" ? "crm-text-wrap break-words [overflow-wrap:anywhere] sm:crm-text-wrap sm:crm-text-wrap" : "crm-text-wrap"}`}
                    title={accessibleTitle}
                    aria-label={accessibleTitle}
                  >{title}</h2>
                  {status}
                </div>
                {metadata && <div className={recordDetailHeaderMetadataClassName}>{metadata}</div>}
              </div>
            </div>
          </div>
        </div>

        {inlineActions && <div className={actionsClassName}>{actions}</div>}
      </div>

      {stackedActions && (
        <div className="border-t border-slate-200/80 pt-4">
          <div className={actionsClassName}>{actions}</div>
        </div>
      )}
    </div>
  );
};
