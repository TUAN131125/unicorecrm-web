import React from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

interface AuthPrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
}

export const AuthPrimaryButton: React.FC<AuthPrimaryButtonProps> = ({
  children,
  loading = false,
  loadingLabel,
  disabled,
  className = "",
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
    >
      {loading ? <LoaderCircle size={17} className="animate-spin" /> : null}
      <span>{loading ? loadingLabel ?? children : children}</span>
      {!loading ? <ArrowRight size={16} className="transition group-hover:translate-x-0.5" /> : null}
    </button>
  );
};
