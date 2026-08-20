import React from "react";
import { Button, resolveButtonVariant, type ButtonVariant } from "@/shared/components/ui";

export interface PageHeaderAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  hidden?: boolean;
  title?: string;
  tooltip?: string;
}

interface PageHeaderActionsProps {
  actions: PageHeaderAction[];
  moreActions?: React.ReactNode;
  className?: string;
}

export const PageHeaderActions: React.FC<PageHeaderActionsProps> = ({
  actions,
  moreActions,
  className = "",
}) => {
  const visibleActions = actions.filter((act) => !act.hidden);

  return (
    <div className={`flex items-center gap-2 flex-wrap justify-start sm:justify-end ${className}`}>
      {visibleActions.map((action) => {
        const resolvedVariant = resolveButtonVariant(action.variant, action.id, action.label, action.title, action.tooltip);
        const variantClassMap: Record<ButtonVariant, string> = {
          primary: "bg-violet-600 hover:bg-violet-700 text-white font-extrabold border-transparent shadow-sm",
          secondary: "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-violet-200 hover:text-violet-700",
          success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border-transparent",
          danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm border-transparent",
          ghost: "bg-transparent border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-none",
          outline: "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm",
          indigo: "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-sm",
          warning: "bg-amber-500 hover:bg-amber-600 text-white border-transparent shadow-sm",
          info: "bg-sky-600 hover:bg-sky-700 text-white border-transparent shadow-sm",
          neutral: "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-sm",
        };

        return (
          <Button
            key={action.id}
            type="button"
            onClick={action.onClick}
            variant={resolvedVariant}
            size="sm"
            icon={action.icon}
            disabled={action.disabled}
            title={action.title || action.tooltip}
            className={`h-9 rounded-xl whitespace-nowrap ${variantClassMap[resolvedVariant]}`}
          >
            {action.label}
          </Button>
        );
      })}
      {moreActions}
    </div>
  );
};

interface PageHeaderMoreButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
}

export const PageHeaderMoreButton: React.FC<PageHeaderMoreButtonProps> = ({
  active,
  icon,
  className = "",
  ...props
}) => {
  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-violet-700 hover:bg-slate-50 shadow-sm transition cursor-pointer ${
        active ? "ring-2 ring-violet-500/20 bg-slate-100 border-violet-300 text-violet-700" : ""
      } ${className}`}
      {...props}
    >
      {icon || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      )}
    </button>
  );
};
