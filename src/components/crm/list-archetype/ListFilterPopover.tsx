import React from "react";
import { Button } from "@/shared/components/ui";

export interface ListFilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onReset?: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  resetLabel?: string;
  doneLabel?: string;
  contentClassName?: string;
  footer?: React.ReactNode;
}

/**
 * Shared list-filter surface.
 *
 * The popover is rendered inside ListControlBar so it is anchored to the
 * list toolbar, closes through the toolbar outside-click contract, and never
 * takes over the page as a right-side drawer.
 */
export const ListFilterPopover: React.FC<ListFilterPopoverProps> = ({
  isOpen,
  onClose,
  onReset,
  ariaLabel,
  children,
  resetLabel = "Đặt lại",
  doneLabel = "Hoàn tất",
  contentClassName = "",
  footer,
}) => {
  if (!isOpen) return null;

  return (
    <section
      role="dialog"
      aria-label={ariaLabel}
      data-list-filter-popover="v1"
      className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[3200] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_24px_70px_-30px_rgba(15,23,42,0.5)]"
    >
      <div className={`max-h-[min(660px,calc(100vh-10rem))] overflow-y-auto p-4 crm-scroll-y sm:p-5 ${contentClassName}`}>
        {children}
      </div>

      {footer ?? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
          {onReset ? (
            <Button type="button" variant="secondary" size="sm" onClick={onReset}>
              {resetLabel}
            </Button>
          ) : null}
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            {doneLabel}
          </Button>
        </div>
      )}
    </section>
  );
};

export const ListFilterGrid: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
    {children}
  </div>
);

export const ListFilterGroup: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, children, className = "" }) => (
  <section className={`space-y-2.5 ${className}`}>
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
    {children}
  </section>
);
