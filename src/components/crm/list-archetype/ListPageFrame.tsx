import React from "react";

interface ListPageFrameProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * Shared list-page outer contract. It standardizes page width, vertical rhythm,
 * and the location of header/toolbar/bulk/content/pagination without owning
 * any module-specific behavior.
 */
export const ListPageFrame: React.FC<ListPageFrameProps> = ({
  children,
  id,
  className = "",
  ...sectionProps
}) => (
  <section
    id={id}
    {...sectionProps}
    data-list-page-archetype="v1"
    className={`mx-auto w-full max-w-7xl space-y-4 pb-12 font-sans text-slate-700 ${className}`}
  >
    {children}
  </section>
);
