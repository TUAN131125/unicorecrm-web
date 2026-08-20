import type { HttpClient } from "@/platform/api";
import { AccessGovernanceApiClient } from "@/platform/api/generated/accessGovernanceApi";
import type {
  EffectiveRecordAccess,
  EffectiveRecordAccessAuthority,
  EffectiveRecordAccessRequest,
} from "../application/effectiveRecordAccess";

/** Authoritative object-level authorization boundary backed by OpenAPI. */
export class HttpEffectiveRecordAccessAuthority implements EffectiveRecordAccessAuthority {
  readonly source = "backend" as const;
  private readonly api: AccessGovernanceApiClient;

  constructor(client: HttpClient) { this.api = new AccessGovernanceApiClient(client); }

  async evaluate(request: EffectiveRecordAccessRequest, signal?: AbortSignal): Promise<EffectiveRecordAccess> {
    const value = await this.api.evaluateEffectiveRecordAccess({
      resourceKey: request.resourceKey,
      ...(request.recordId ? { recordId: request.recordId } : {}),
      ...(request.requestedCommands ? { requestedCommands: [...request.requestedCommands] } : {}),
      ...(request.requestedFields ? { requestedFields: [...request.requestedFields] } : {}),
      ...(request.includeExport === undefined ? {} : { includeExport: request.includeExport }),
      ...(request.includeApproval === undefined ? {} : { includeApproval: request.includeApproval }),
    }, { signal });
    return {
      workspaceId: value.workspaceId,
      resourceKey: value.resourceKey,
      ...(value.recordId ? { recordId: value.recordId } : {}),
      canRead: value.canRead,
      canUpdate: value.canUpdate,
      canDelete: value.canDelete,
      canExport: value.canExport,
      canApprove: value.canApprove,
      allowedCommands: [...value.allowedCommands],
      fieldAccess: { ...value.fieldAccess },
      decisionReasons: value.decisionReasons.map((reason) => ({ ...reason })),
      evaluatedAt: value.evaluatedAt,
      authority: "backend",
    };
  }
}
