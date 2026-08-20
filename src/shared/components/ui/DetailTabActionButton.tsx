import React from "react";
import { Button, type ButtonActionIntent, type ButtonProps } from "./Button";
import { cn } from "../../lib/classnames/cn";

export interface DetailTabActionButtonProps extends Omit<ButtonProps, "size"> {
  actionIntent?: ButtonActionIntent;
}

/**
 * Shared action control for record-detail tabs.
 * Keeps tab actions aligned, single-line and visually consistent by intent.
 */
export const DetailTabActionButton: React.FC<DetailTabActionButtonProps> = ({
  className,
  actionIntent = "neutral",
  ...props
}) => (
  <Button
    size="sm"
    actionIntent={actionIntent}
    className={cn("h-9 min-w-[132px] max-w-full px-3.5 whitespace-nowrap", className)}
    {...props}
  />
);
