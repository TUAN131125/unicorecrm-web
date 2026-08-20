import type { FieldAccess } from "../domain/accessControl.types";

export type EffectiveAccessDecisionEffect = "ALLOW" | "DENY" | "LIMIT";
export type EffectiveAccessAuthoritySource = "backend" | "demo";

export interface EffectiveAccessDecisionReason {
  code: string;
  effect: EffectiveAccessDecisionEffect;
  message?: string;
  source?: string;
}

export interface EffectiveRecordAccessRequest {
  workspaceId: string;
  resourceKey: string;
  recordId?: string;
  record?: unknown;
  requestedCommands?: readonly string[];
  requestedFields?: readonly string[];
  includeExport?: boolean;
  includeApproval?: boolean;
}

export interface EffectiveRecordAccess {
  workspaceId: string;
  resourceKey: string;
  recordId?: string;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
  allowedCommands: readonly string[];
  fieldAccess: Readonly<Record<string, FieldAccess>>;
  decisionReasons: readonly EffectiveAccessDecisionReason[];
  evaluatedAt: string;
  authority: EffectiveAccessAuthoritySource;
}

export interface EffectiveRecordAccessAuthority {
  readonly source: "backend";
  evaluate(request: EffectiveRecordAccessRequest, signal?: AbortSignal): Promise<EffectiveRecordAccess>;
}

export function commandIsAllowed(access: EffectiveRecordAccess | undefined, command: string): boolean {
  if (!access) return false;
  return access.allowedCommands.includes(command);
}

export function fieldAccessFor(
  access: EffectiveRecordAccess | undefined,
  fieldKey: string,
): FieldAccess {
  return access?.fieldAccess[fieldKey] ?? "HIDDEN";
}
