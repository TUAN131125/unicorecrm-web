import React from "react";
import { TableCell } from "@/shared/components/ui";

interface TableResizeHeaderProps {
  colKey: string;
  width: number;
  label: string;
  onResize: (e: React.MouseEvent, colKey: string) => void;
  onReset: (colKey: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  tooltip?: string;
  className?: string;
}

export const TableResizeHeader: React.FC<TableResizeHeaderProps> = ({
  colKey,
  width,
  label,
  onResize,
  onReset,
  onClick,
  children,
  tooltip = "Kéo để đổi kích thước, gõ đúp để khôi phục mặc định",
  className = ""
}) => {
  return (
    <TableCell
      style={{
        width: width,
        minWidth: width,
        maxWidth: width
      }}
      onClick={onClick}
      className={`font-medium text-slate-700 text-[11px] uppercase tracking-wider py-2 px-3 whitespace-normal break-words text-left relative group select-none overflow-visible ${className}`}
    >
      <div className="flex items-center gap-1 min-w-0 pr-2">
        <span className="crm-text-wrap block">{label}</span>
        {children}
      </div>
      {/* Resize Handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onResize(e, colKey);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onReset(colKey);
        }}
        title={tooltip}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col justify-center items-center"
      >
        <div className="h-4 w-[2px] bg-indigo-400 rounded-full" />
      </div>
    </TableCell>
  );
};
