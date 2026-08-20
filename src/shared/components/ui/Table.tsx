import React from "react";
import { cn } from "../../lib/classnames/cn";

export interface TableProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  density?: "compact" | "comfortable";
}

export const Table: React.FC<TableProps> = ({ children, className, style, density = "comfortable" }) => (
  <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm crm-scroll-x" data-data-surface="table" data-table-density={density}>
    <table style={style} className={cn("w-full border-collapse text-left text-sm", className)}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode; className?: string; sticky?: boolean }> = ({
  children,
  className,
  sticky = false,
}) => (
  <thead className={cn("border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-700", sticky && "sticky top-0 z-10", className)}>
    {children}
  </thead>
);

export const TableBody: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <tbody className={cn("divide-y divide-slate-100 text-slate-950", className)}>{children}</tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, className, onClick, onKeyDown, tabIndex, ...props }) => {
  const interactive = Boolean(onClick);
  return (
    <tr
      data-data-row="true"
      onClick={onClick}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && interactive && onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick(event as unknown as React.MouseEvent<HTMLTableRowElement>);
        }
      }}
      tabIndex={interactive ? (tabIndex ?? 0) : tabIndex}
      className={cn(
        "transition-colors duration-150",
        interactive && "cursor-pointer hover:bg-violet-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/25",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  isHeader?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({ children, className, isHeader, ...props }) => {
  if (isHeader) {
    return (
      <th scope="col" className={cn("relative px-4 py-3 align-middle text-left font-medium", className)} {...(props as React.ThHTMLAttributes<HTMLTableCellElement>)}>
        {children}
      </th>
    );
  }
  return (
    <td className={cn("relative px-4 py-3.5 align-middle font-normal text-slate-950", className)} {...props}>
      {children}
    </td>
  );
};
