import React from "react";
import { cn } from "../../lib/classnames/cn";

export interface MenuSectionProps {
  title: string;
}

export const MenuSection: React.FC<MenuSectionProps> = ({ title }) => {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 select-none block text-left">
      {title}
    </div>
  );
};

export const MenuDivider: React.FC = () => {
  return <div className="border-t border-slate-100 my-1" />;
};

export interface MenuItemButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  variant?: "default" | "danger" | "primary";
  danger?: boolean;
  showAiBadge?: boolean;
  tooltip?: string;
}

export const MenuItemButton: React.FC<MenuItemButtonProps> = ({
  children,
  icon,
  variant = "default",
  danger,
  showAiBadge,
  tooltip,
  className,
  disabled,
  ...props
}) => {
  const resolvedVariant = danger ? "danger" : variant;

  const variantClasses = {
    default: "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
    danger: "text-rose-600 hover:bg-rose-50 hover:text-rose-700",
    primary: "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700",
  };

  const disabledClasses = "text-slate-400 cursor-not-allowed hover:bg-transparent pointer-events-none opacity-80";

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left px-3 py-1.5 text-xs md:text-[13px] font-medium flex items-center justify-between transition-all rounded-lg select-none outline-none focus:ring-1 focus:ring-slate-100 min-h-[32px] md:min-h-[34px] cursor-pointer",
        disabled ? disabledClasses : variantClasses[resolvedVariant],
        className
      )}
      disabled={disabled}
      title={tooltip || props.title}
      {...props}
    >
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className={cn("shrink-0", disabled ? "text-slate-300" : (resolvedVariant === "danger" ? "text-rose-500" : (resolvedVariant === "primary" ? "text-indigo-500" : "text-slate-400 hover:text-slate-600")))}>
            {icon}
          </span>
        )}
        <span>{children}</span>
      </div>
      {showAiBadge && (
        <span className="inline-flex items-center text-[9px] md:text-[10px] font-extrabold rounded-full bg-blue-600 text-white px-1.5 py-0.5 ml-1.5 align-middle select-none shadow-sm shadow-blue-100">
          AI
        </span>
      )}
    </button>
  );
};
