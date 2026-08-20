import React, { type ReactNode } from "react";

export interface CommercialDocumentCompany {
  name: string;
  address?: string;
  taxCode?: string;
  email?: string;
  phone?: string;
}

export interface CommercialDocumentHeaderProps {
  company: CommercialDocumentCompany;
  title: string;
  reference?: string;
  logoLabel?: string;
  badge?: string;
}

export interface CommercialDocumentSectionProps {
  number: number;
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export interface CommercialDocumentField {
  label: ReactNode;
  value: ReactNode;
}

export interface CommercialDocumentFieldGridProps {
  fields: readonly CommercialDocumentField[];
  columns?: 1 | 2;
  className?: string;
}

export interface CommercialDocumentSignatureProps {
  labels: readonly string[];
  hint: string;
  dateHint: string;
}

export const DOCUMENT_NAVY = "#1e293b";
export const DOCUMENT_BORDER = "#cbd5e1";

export const CommercialDocumentSheet = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CommercialDocumentSheet({ children, className = "", ...props }, ref) {
    return (
      <div
        ref={ref}
        {...props}
        className={`w-[860px] shrink-0 bg-white px-12 py-10 text-[13px] leading-5 text-slate-950 shadow-sm [font-family:'Times_New_Roman',Times,serif] print:w-full print:px-0 print:py-0 print:shadow-none ${className}`}
      >
        {children}
      </div>
    );
  },
);

export const CommercialDocumentHeader: React.FC<CommercialDocumentHeaderProps> = ({ company, title, reference, badge }) => (
  <header className="grid grid-cols-[minmax(0,1fr)_260px] items-start gap-10 border-b border-slate-400 pb-5">
    <div className="min-w-0">
      <div className="break-words text-[18px] font-semibold uppercase leading-6 text-slate-950">{company.name}</div>
      <div className="mt-2 space-y-0.5 text-[12px] leading-4 text-slate-700">
        {company.address && <div>{company.address}</div>}
        {company.taxCode && <div>MST: {company.taxCode}</div>}
        {company.email && <div>{company.email}</div>}
        {company.phone && <div>{company.phone}</div>}
      </div>
    </div>
    <div className="text-right">
      <div className="text-[24px] font-semibold uppercase leading-7 tracking-wide text-slate-950">{title}</div>
      {reference && <div className="mt-2 text-[15px] font-semibold text-slate-800">{reference}</div>}
      {badge && <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{badge}</div>}
    </div>
  </header>
);

export const CommercialDocumentSection: React.FC<CommercialDocumentSectionProps> = ({
  number,
  title,
  children,
  className = "",
  bodyClassName = "",
}) => (
  <section className={className}>
    <h2 className="border-b border-slate-300 pb-1 text-[14px] font-semibold uppercase tracking-wide text-slate-900">
      {number}. {title}
    </h2>
    <div className={`pt-2 ${bodyClassName}`}>{children}</div>
  </section>
);

export const CommercialDocumentFieldGrid: React.FC<CommercialDocumentFieldGridProps> = ({ fields, columns = 1, className = "" }) => (
  <dl className={`${columns === 2 ? "grid grid-cols-2 gap-x-10" : "grid grid-cols-1"} ${className}`}>
    {fields.map((field, index) => (
      <div key={index} className="grid min-h-7 grid-cols-[130px_minmax(0,1fr)] gap-3 py-1 text-[12.5px] leading-5">
        <dt className="text-slate-600">{field.label}</dt>
        <dd className="min-w-0 break-words text-slate-950">{field.value || "—"}</dd>
      </div>
    ))}
  </dl>
);

export const CommercialDocumentSignatureGrid: React.FC<CommercialDocumentSignatureProps> = ({ labels, hint, dateHint }) => (
  <div className={`grid gap-10 ${labels.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
    {labels.map((label) => (
      <div key={label} className="min-h-[112px] text-center">
        <div className="text-[13px] font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-[11px] italic text-slate-500">{hint}</div>
        <div className="mt-14 border-t border-slate-300 pt-1 text-[11px] text-slate-500">{dateHint}</div>
      </div>
    ))}
  </div>
);

export const CommercialDocumentNotice: React.FC<{ children: ReactNode }> = ({ children }) => (
  <p className="mt-5 border-t border-slate-300 pt-3 text-center text-[11px] italic leading-4 text-slate-600">{children}</p>
);
