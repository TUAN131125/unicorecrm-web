import React from "react";
import { IconButton } from "@/shared/components/ui";

export interface RelationshipPanelAction<ActionId extends string = string> {
  id: ActionId;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

interface RelationshipPanelActionBarProps<ActionId extends string = string> {
  label: string;
  actions: readonly RelationshipPanelAction<ActionId>[];
  onAction(actionId: ActionId): void;
  className?: string;
}

/**
 * Shared one-line action rail for relationship records.
 * Every action receives an equal column, including seven-action Contact and
 * Customer rails, so no unused strip remains at the right edge.
 */
export function RelationshipPanelActionBar<ActionId extends string = string>({
  label,
  actions,
  onAction,
  className = "",
}: RelationshipPanelActionBarProps<ActionId>) {
  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-1">
        <div
          className="grid w-full items-center gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(actions.length, 1)}, minmax(0, 1fr))` }}
        >
          {actions.map((action) => (
            <IconButton
              key={action.id}
              title={action.disabled ? action.disabledReason || action.label : action.label}
              aria-label={action.label}
              size="sm"
              variant="secondary"
              className="h-9 w-9 justify-self-center"
              disabled={action.disabled}
              onClick={() => onAction(action.id)}
            >
              {action.icon}
            </IconButton>
          ))}
        </div>
      </div>
    </div>
  );
}
