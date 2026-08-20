import React from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/shared/lib/classnames/cn";

interface DetailPanelToggleProps {
  isPanelVisible: boolean;
  onToggle(): void;
  visibleLabel: string;
  hiddenLabel: string;
  className?: string;
}

export const DetailPanelToggle: React.FC<DetailPanelToggleProps> = ({
  isPanelVisible,
  onToggle,
  visibleLabel,
  hiddenLabel,
  className,
}) => {
  const label = isPanelVisible ? visibleLabel : hiddenLabel;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-pressed={isPanelVisible}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm outline-none transition-colors",
        "hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40",
        isPanelVisible && "border-indigo-200 bg-indigo-50 text-indigo-700",
        className,
      )}
    >
      {isPanelVisible ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
    </button>
  );
};
