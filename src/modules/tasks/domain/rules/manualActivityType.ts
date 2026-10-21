import type { ManualActivityType } from "../model/task.types";

export function isManualActivityType(value: unknown): value is ManualActivityType {
  return value === "CALL" || value === "EMAIL" || value === "MEETING" || value === "NOTE" || value === "MESSAGE";
}
