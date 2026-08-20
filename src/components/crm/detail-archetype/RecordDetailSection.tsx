import React from "react";

interface RecordDetailSectionProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const RecordDetailSection: React.FC<RecordDetailSectionProps> = ({
  children,
  title,
  actions,
  className = "",
}) => (
  <section
    data-record-detail-section="v1"
    className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
  >
    {(title || actions) && (
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        {title && <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>}
        {actions && <div className="ml-auto">{actions}</div>}
      </header>
    )}
    {children}
  </section>
);
