import React from "react";

export type ListTableAlign = "left" | "center" | "right";

const alignClass: Record<ListTableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

interface ListDataTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  minWidth?: number | string;
}

interface ListTableSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  surfaceId?: string;
}

interface ListTableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: ListTableAlign;
  sticky?: "left" | "right";
}

interface ListTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: ListTableAlign;
  sticky?: "left" | "right";
  density?: "compact" | "comfortable";
}

interface ListTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  interactive?: boolean;
}

interface ListRecordIdentityProps {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  tertiary?: React.ReactNode;
  avatar?: React.ReactNode;
  onOpen?: () => void;
  accessibleLabel?: string;
  toneClassName?: string;
}

/**
 * Table surface shared by Lead, Contact, Customer and every operational list.
 * It owns visual rhythm only; columns, data and business actions stay in modules.
 */
export const ListTableSurface: React.FC<ListTableSurfaceProps> = ({
  children,
  surfaceId,
  className = "",
  ...props
}) => (
  <div
    {...props}
    data-list-table-archetype="v1"
    data-list-table-surface={surfaceId}
    className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
  >
    <div className="overflow-x-auto crm-scroll-x">{children}</div>
  </div>
);

export const ListDataTable: React.FC<ListDataTableProps> = ({
  children,
  minWidth = 960,
  className = "",
  style,
  ...props
}) => (
  <table
    {...props}
    style={{ minWidth: typeof minWidth === "number" ? `${minWidth}px` : minWidth, ...style }}
    className={`w-full border-collapse text-left font-sans text-xs text-slate-600 ${className}`}
  >
    {children}
  </table>
);

export const ListTableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <thead {...props} className={`bg-slate-50/70 ${className}`}>
    {children}
  </thead>
);

export const ListTableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <tbody {...props} className={`divide-y divide-slate-100 bg-white ${className}`}>
    {children}
  </tbody>
);

export const ListTableHeaderCell: React.FC<ListTableHeaderCellProps> = ({
  children,
  align = "left",
  sticky,
  className = "",
  ...props
}) => (
  <th
    {...props}
    className={`border-b border-slate-200 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${alignClass[align]} ${sticky === "left" ? "sticky left-0 z-20 bg-slate-50" : sticky === "right" ? "sticky right-0 z-20 border-l border-slate-100 bg-slate-50" : ""} ${className}`}
  >
    {children}
  </th>
);

export const ListTableRow: React.FC<ListTableRowProps> = ({
  children,
  selected = false,
  interactive = true,
  className = "",
  ...props
}) => (
  <tr
    {...props}
    className={`border-b border-indigo-50/40 transition-colors ${interactive ? "hover:bg-indigo-50/20" : ""} ${selected ? "bg-indigo-50/30" : ""} ${className}`}
  >
    {children}
  </tr>
);

export const ListTableCell: React.FC<ListTableCellProps> = ({
  children,
  align = "left",
  sticky,
  density = "comfortable",
  className = "",
  ...props
}) => (
  <td
    {...props}
    className={`${density === "compact" ? "px-3 py-2.5" : "px-3 py-3"} text-[11px] text-slate-600 ${alignClass[align]} ${sticky === "left" ? "sticky left-0 z-10 border-r border-slate-100 bg-white/95" : sticky === "right" ? "sticky right-0 z-10 border-l border-slate-100 bg-white/95" : ""} ${className}`}
  >
    {children}
  </td>
);

export const ListRecordIdentity: React.FC<ListRecordIdentityProps> = ({
  primary,
  secondary,
  tertiary,
  avatar,
  onOpen,
  accessibleLabel,
  toneClassName = "border-indigo-200 bg-indigo-50 text-indigo-700",
}) => (
  <div className="flex min-w-0 items-center gap-2.5">
    {avatar ? (
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[10px] font-semibold ${toneClassName}`}>
        {avatar}
      </div>
    ) : null}
    <div className="min-w-0">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={accessibleLabel}
          className="block max-w-full crm-text-wrap text-left text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {primary}
        </button>
      ) : (
        <div className="crm-text-wrap text-xs font-semibold text-slate-900">{primary}</div>
      )}
      {secondary ? <div className="mt-0.5 crm-text-wrap text-[10px] font-medium text-slate-500">{secondary}</div> : null}
      {tertiary ? <div className="mt-0.5 crm-text-wrap text-[9px] text-slate-400">{tertiary}</div> : null}
    </div>
  </div>
);
