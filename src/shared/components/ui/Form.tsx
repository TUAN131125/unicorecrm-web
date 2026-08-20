import React from "react";
import { cn } from "../../lib/classnames/cn";

export const FormSection: React.FC<{
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, children, className }) => (
  <section className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      {icon && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">{title}</h3>
      </div>
    </div>
    <div className="p-5 sm:p-6">{children}</div>
  </section>
);

export const FormActionBar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("crm-form-action-bar flex flex-col-reverse items-stretch justify-end gap-3 border-t border-slate-200 bg-slate-50/95 px-5 py-4 sm:flex-row sm:items-center sm:px-6", className)}>
    {children}
  </div>
);
