import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/classnames/cn";

export interface PanelHandleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isRightPanelVisible: boolean;
}

export const PanelHandle: React.FC<PanelHandleProps> = ({
  isRightPanelVisible,
  className,
  ...props
}) => (
  <button
    type="button"
    aria-expanded={isRightPanelVisible}
    className={cn(
      "group relative flex h-16 w-7 items-center justify-center overflow-hidden rounded-full border border-slate-200/90 bg-white/95 text-indigo-600 shadow-[0_8px_24px_rgba(15,23,42,0.14)] backdrop-blur-sm outline-none transition-[transform,box-shadow,border-color,background-color,color] duration-200 hover:scale-105 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 hover:shadow-[0_12px_30px_rgba(79,70,229,0.18)] active:scale-95 focus-visible:ring-2 focus-visible:ring-indigo-500/40",
      className,
    )}
    {...props}
  >
    <span className="absolute inset-y-3 left-0 w-px bg-gradient-to-b from-transparent via-indigo-200 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    <span className="transition-transform duration-200 group-hover:scale-110">
      {isRightPanelVisible ? (
        <ChevronRight size={14} className="stroke-[2.5]" />
      ) : (
        <ChevronLeft size={14} className="stroke-[2.5]" />
      )}
    </span>
  </button>
);
