import React from "react";
import { ListFilterGroup, ListFilterPopover } from "@/components/crm/list-archetype";

export const OperationFilterPopover: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  title: string;
  resetLabel?: string;
  doneLabel?: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, onReset, title, resetLabel, doneLabel, children }) => (
  <ListFilterPopover
    isOpen={isOpen}
    onClose={onClose}
    onReset={onReset}
    ariaLabel={title}
    resetLabel={resetLabel}
    doneLabel={doneLabel}
  >
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{children}</div>
  </ListFilterPopover>
);

export const OperationFilterGroup = ListFilterGroup;
