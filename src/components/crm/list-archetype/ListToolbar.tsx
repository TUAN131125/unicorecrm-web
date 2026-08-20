import React from "react";
import {
  ListControlBar,
  type ListControlBarProps,
} from "@/components/crm/ListControlBar";

/**
 * The shared toolbar contract intentionally delegates search/filter/view
 * behavior to the module page. This avoids a mega generic list component.
 */
export const ListToolbar: React.FC<ListControlBarProps> = (props) => (
  <div data-list-toolbar="v1">
    <ListControlBar {...props} />
  </div>
);
