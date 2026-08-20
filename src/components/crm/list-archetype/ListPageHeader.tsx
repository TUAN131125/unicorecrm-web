import React from "react";
import { PageHeader } from "@/shared/components/ui";

interface ListPageHeaderProps {
  title: React.ReactNode;
  count?: number;
  context?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
}

export const ListPageHeader: React.FC<ListPageHeaderProps> = ({
  title,
  count,
  context: _context,
  icon,
  actions,
  id,
}) => {
  const titleWithCount = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{title}</span>
      {typeof count === "number" && (
        <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {count.toLocaleString()}
        </span>
      )}
    </span>
  );

  return (
    <PageHeader
      id={id}
      title={titleWithCount}
      icon={icon}
      actions={actions}
      className="mb-0"
    />
  );
};
