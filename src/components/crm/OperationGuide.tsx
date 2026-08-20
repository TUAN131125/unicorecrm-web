import React from "react";
import { CheckCircle2, CircleHelp, Lightbulb } from "lucide-react";
import { Button, Modal } from "@/shared/components/ui";

export interface OperationGuideContent {
  title: string;
  steps: readonly string[];
  tips?: readonly string[];
}

export interface OperationGuideButtonProps {
  guide: OperationGuideContent;
  label: string;
  closeLabel: string;
  compact?: boolean;
  className?: string;
}

export const OperationGuideModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  guide: OperationGuideContent;
  closeLabel: string;
}> = ({ isOpen, onClose, guide, closeLabel }) => (
  <Modal
    id="operation-guide-modal"
    isOpen={isOpen}
    onClose={onClose}
    size="sm"
    title={guide.title}
    bodyClassName="bg-slate-50/70"
    footer={<Button variant="primary" onClick={onClose}>{closeLabel}</Button>}
  >
    <div className="space-y-4">
      <ol className="space-y-2.5">
        {guide.steps.map((step, index) => (
          <li key={`${index}-${step}`} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-black text-violet-700">{index + 1}</span>
            <span className="pt-0.5 text-sm font-medium leading-5 text-slate-700">{step}</span>
          </li>
        ))}
      </ol>
      {guide.tips?.length ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-sky-800"><Lightbulb size={14} />Tips</div>
          <ul className="mt-2 space-y-1.5 text-xs font-medium leading-5 text-sky-900">
            {guide.tips.map((tip) => <li key={tip} className="flex items-start gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0" /><span>{tip}</span></li>)}
          </ul>
        </div>
      ) : null}
    </div>
  </Modal>
);

export const OperationGuideButton: React.FC<OperationGuideButtonProps> = ({ guide, label, closeLabel, compact = false, className = "" }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<CircleHelp size={14} />}
        onClick={() => setOpen(true)}
        className={className}
        title={label}
        aria-label={label}
      >
        {compact ? undefined : label}
      </Button>
      <OperationGuideModal isOpen={open} onClose={() => setOpen(false)} guide={guide} closeLabel={closeLabel} />
    </>
  );
};
