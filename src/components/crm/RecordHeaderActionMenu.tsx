import React, { Suspense } from "react";
import { CircleHelp, FileClock } from "lucide-react";
import { ActionDropdown, type ActionDropdownSection } from "@/components/crm/ActionDropdown";
import { PageHeaderMoreButton } from "@/components/crm/PageHeaderActions";
import { OperationGuideModal, type OperationGuideContent } from "@/components/crm/OperationGuide";
import { Button, Modal } from "@/shared/components/ui";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";

const AuditTrailViewer = React.lazy(() => import("@/platform/audit/react/AuditTrailViewer").then((module) => ({ default: module.AuditTrailViewer })));

export interface RecordHeaderAuditAction {
  resourceKey: string;
  recordId: string;
  title: string;
  label: string;
  sectionTitle?: string;
  closeLabel?: string;
}

export interface RecordHeaderActionMenuProps {
  sections: ActionDropdownSection[];
  label: string;
  guide?: OperationGuideContent;
  guideLabel?: string;
  closeGuideLabel?: string;
  width?: number;
  audit?: RecordHeaderAuditAction;
}

export const RecordHeaderActionMenu: React.FC<RecordHeaderActionMenuProps> = ({
  sections,
  label,
  guide,
  guideLabel = "Hướng dẫn thao tác",
  closeGuideLabel = "Đã hiểu",
  width = 260,
  audit,
}) => {
  const access = useEffectiveAccess();
  const [open, setOpen] = React.useState(false);
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const canReadAudit = Boolean(audit && access.can(CAPABILITIES.AUDIT_READ));
  const resolvedSections = React.useMemo<ActionDropdownSection[]>(() => {
    const next = [...sections];
    if (canReadAudit && audit) {
      next.push({
        id: "audit",
        title: audit.sectionTitle,
        items: [{ id: "record-audit", label: audit.label, icon: <FileClock size={14} />, onClick: () => setAuditOpen(true), variant: "secondary" }],
      });
    }
    if (guide) {
      next.push({
        id: "help",
        title: guideLabel,
        items: [{ id: "operation-guide", label: guideLabel, icon: <CircleHelp size={14} />, onClick: () => setGuideOpen(true), variant: "secondary" }],
      });
    }
    return next;
  }, [audit, canReadAudit, guide, guideLabel, sections]);

  return (
    <>
      <div className="relative inline-flex">
        <PageHeaderMoreButton
          active={open}
          title={label}
          aria-label={label}
          onClick={(event) => {
            event.stopPropagation();
            setAnchor(event.currentTarget);
            setOpen((value) => !value);
          }}
        />
        <ActionDropdown
          isOpen={open}
          anchorRef={anchor}
          onClose={() => { setOpen(false); setAnchor(null); }}
          sections={resolvedSections}
          width={width}
        />
      </div>
      {guide ? <OperationGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} guide={guide} closeLabel={closeGuideLabel} /> : null}
      {audit ? (
        <Modal
          isOpen={auditOpen}
          onClose={() => setAuditOpen(false)}
          title={audit.title}
          size="lg"
          footer={<Button variant="secondary" onClick={() => setAuditOpen(false)}>{audit.closeLabel ?? "Đóng"}</Button>}
        >
          <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">…</div>}>
            <AuditTrailViewer resourceKey={audit.resourceKey} recordId={audit.recordId} title={audit.title} embedded />
          </Suspense>
        </Modal>
      ) : null}
    </>
  );
};
