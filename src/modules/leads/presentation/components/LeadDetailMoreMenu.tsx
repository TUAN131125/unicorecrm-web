import { CheckCircle2, Phone, Printer, Tag, Trash2, Unlock, UserPlus, X } from "lucide-react";
import { MenuDivider, MenuItemButton, MenuSection, RowActionPortal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState, QualificationOutcome, isPositiveQualificationOutcome } from "../../domain/model/leadLifecycle.canonical";

interface LeadDetailMoreMenuProps {
  lead: Lead;
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  canAssign: boolean;
  onClose: () => void;
  onMarkContacted: () => void;
  onStartVerifying: () => void;
  onDisqualify: () => void;
  onReopen: () => void;
  onHandover: () => void;
  onManageTags: () => void;
  onPrint: () => void;
  onDelete: () => void;
}

export function LeadDetailMoreMenu({
  lead,
  isOpen,
  anchorEl,
  canAssign,
  onClose,
  onMarkContacted,
  onStartVerifying,
  onDisqualify,
  onReopen,
  onHandover,
  onManageTags,
  onPrint,
  onDelete,
}: LeadDetailMoreMenuProps) {
  const { t, locale } = useI18n();
  return (
    <RowActionPortal
      open={isOpen}
      anchorEl={anchorEl}
      onClose={onClose}
      width={240}
      role="menu"
      ariaLabel={locale === "vi" ? "Thao tác Lead" : "Lead actions"}
      className="space-y-0.5 p-1.5 py-1.5 text-left text-xs font-sans"
    >
        {!isPositiveQualificationOutcome(lead.qualificationOutcome) && (
          <>
            <MenuSection title={t("leadDetail.actions.workflow")} />
            {lead.leadWorkState === LeadWorkState.NEW && (
              <MenuItemButton onClick={onMarkContacted} icon={<Phone size={14} className="shrink-0 text-teal-600" />}>
                {t("leadDetail.actions.markContacted")}
              </MenuItemButton>
            )}
            {lead.leadWorkState === LeadWorkState.CONTACTING && (
              <MenuItemButton onClick={onStartVerifying} icon={<CheckCircle2 size={14} className="shrink-0 text-emerald-500" />} variant="primary">
                {locale === "vi" ? "Đạt chất lượng" : "Qualify"}
              </MenuItemButton>
            )}
            {lead.leadWorkState !== LeadWorkState.CLOSED && (
              <MenuItemButton onClick={onDisqualify} icon={<X size={14} className="shrink-0 text-rose-500" />}>
                {t("leadDetail.actions.disqualify")}
              </MenuItemButton>
            )}
            {lead.qualificationOutcome === QualificationOutcome.DISQUALIFIED && (
              <MenuItemButton onClick={onReopen} icon={<Unlock size={14} className="shrink-0 text-indigo-500" />} variant="primary">
                {t("leadDetail.actions.reopen")}
              </MenuItemButton>
            )}
            <MenuDivider />
          </>
        )}

        <MenuSection title={t("leadDetail.actions.work")} />
        {canAssign && <MenuItemButton onClick={onHandover} icon={<UserPlus size={14} />}>{t("leadDetail.actions.handover")}</MenuItemButton>}
        <MenuItemButton onClick={onManageTags} icon={<Tag size={14} />}>{t("leadDetail.actions.manageTags")}</MenuItemButton>

        <MenuDivider />
        <MenuSection title={t("leadDetail.actions.record")} />
        <MenuItemButton onClick={onPrint} icon={<Printer size={14} />}>{t("leadDetail.actions.print")}</MenuItemButton>

        <MenuDivider />
        <MenuSection title={t("leadDetail.actions.danger")} />
        <MenuItemButton onClick={onDelete} variant="danger" icon={<Trash2 size={14} />}>{t("leadDetail.actions.delete")}</MenuItemButton>
    </RowActionPortal>
  );
}
