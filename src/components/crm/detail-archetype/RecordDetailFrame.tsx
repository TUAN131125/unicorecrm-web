import React from "react";

interface RecordDetailFrameProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * Shared detail-page outer contract. It standardizes width, spacing and record
 * context without owning module commands, lifecycle rules or transactions.
 */
export const RecordDetailFrame: React.FC<RecordDetailFrameProps> = ({
  children,
  id,
  className = "",
}) => (
  <section
    id={id}
    data-record-detail-archetype="v1"
    className={`mx-auto w-full max-w-7xl space-y-5 pb-12 text-left ${className}`}
  >
    {children}
  </section>
);
