import React from "react";

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const AuthField: React.FC<AuthFieldProps> = ({
  label,
  icon,
  trailing,
  className = "",
  ...props
}) => (
  <label className="group block space-y-2 text-xs font-medium text-slate-700">
    {label ? <span className="inline-flex items-center gap-1.5 transition group-focus-within:text-indigo-700">{label}</span> : null}
    <span className="relative block">
      {icon && <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition group-focus-within:text-indigo-600">{icon}</span>}
      <input
        {...props}
        className={`h-12 w-full rounded-2xl border border-slate-200 bg-white text-sm font-normal text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 ${icon ? "pl-11" : "pl-4"} ${trailing ? "pr-12" : "pr-4"} ${className}`}
      />
      {trailing && <span className="absolute inset-y-0 right-0 flex items-center pr-3.5">{trailing}</span>}
    </span>
  </label>
);

interface AuthCodeFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export const AuthCodeField: React.FC<AuthCodeFieldProps> = ({ label, className = "", ...props }) => (
  <label className="block space-y-2 text-xs font-medium text-slate-700">
    <span>{label}</span>
    <input
      {...props}
      type="text"
      className={`h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center text-xl font-semibold tracking-[0.6em] text-slate-900 outline-none transition placeholder:tracking-[0.45em] placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 ${className}`}
    />
  </label>
);
