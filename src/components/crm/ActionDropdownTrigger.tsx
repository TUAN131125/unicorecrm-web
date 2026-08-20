import React from "react";
import { MoreHorizontal } from "lucide-react";

type ActionDropdownTriggerProps = {
  isOpen: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
};

export const ActionDropdownTrigger = React.forwardRef<
  HTMLButtonElement,
  ActionDropdownTriggerProps
>(({ isOpen, onClick, title = "Thao tác", className = "" }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer focus-visible:outline-none ${
        isOpen
          ? "border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-100"
          : "border-slate-200 text-slate-400 hover:border-violet-300 hover:bg-violet-50 hover:text-slate-700"
      } ${className}`}
      title={title}
      aria-label={title}
      aria-haspopup="menu"
      aria-expanded={isOpen}
    >
      <MoreHorizontal size={14} />
    </button>
  );
});

ActionDropdownTrigger.displayName = "ActionDropdownTrigger";
