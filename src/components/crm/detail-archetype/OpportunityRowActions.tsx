import React from "react";
import { ArrowRight, Eye, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/shared/lib/classnames/cn";

interface OpportunityRowActionsProps {
  detailHref: string;
  detailLabel: string;
  advanceLabel?: string;
  quoteLabel?: string;
  onAdvance?: () => void;
  onCreateQuote?: () => void;
  className?: string;
}

const baseClass = "inline-flex min-h-8 min-w-[88px] max-w-full items-center justify-center gap-1.5 whitespace-normal rounded-lg border px-2.5 py-1.5 text-[10px] font-bold leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:ring-offset-1";

export const OpportunityRowActions: React.FC<OpportunityRowActionsProps> = ({
  detailHref,
  detailLabel,
  advanceLabel,
  quoteLabel,
  onAdvance,
  onCreateQuote,
  className,
}) => (
  <div className={cn("flex flex-wrap items-center justify-end gap-1.5", className)}>
    <Link
      to={detailHref}
      className={cn(baseClass, "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")}
      title={detailLabel}
    >
      <Eye size={12} className="shrink-0" />
      <span className="crm-text-wrap">{detailLabel}</span>
    </Link>
    {onAdvance && advanceLabel ? (
      <button
        type="button"
        onClick={onAdvance}
        className={cn(baseClass, "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100")}
        title={advanceLabel}
      >
        <ArrowRight size={12} className="shrink-0" />
        <span className="crm-text-wrap">{advanceLabel}</span>
      </button>
    ) : null}
    {onCreateQuote && quoteLabel ? (
      <button
        type="button"
        onClick={onCreateQuote}
        className={cn(baseClass, "border-violet-600 bg-violet-600 text-white shadow-sm hover:border-violet-700 hover:bg-violet-700")}
        title={quoteLabel}
      >
        <FileText size={12} className="shrink-0" />
        <span className="crm-text-wrap">{quoteLabel}</span>
      </button>
    ) : null}
  </div>
);
