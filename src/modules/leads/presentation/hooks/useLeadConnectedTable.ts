import React from "react";
import { isLeadConnectedApiRuntime } from "../../application/composition/leadApplicationServices";
import { useEffectiveAccess } from "@/platform/access-control";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type { ConnectedLeadTableResolution } from "../model/connectedLeadTableQuery";
import { useLeadServerPagedCollection } from "./useLeadServerPagedCollection";
import { replaceLeads } from "../../public/leads";
import type { Lead } from "../../domain/model/lead.types";

// Table projections remain page-owned; never populate a global Lead collection.
function projectPage(_records: readonly Lead[]): void {}
function evictProjection(): void {
  if (isLeadConnectedApiRuntime()) replaceLeads([]);
}

export function useLeadConnectedTable(options: {
  enabled: boolean; intent: unknown; resolution: ConnectedLeadTableResolution;
}) {
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  const scopeKey = JSON.stringify([workspace.workspaceId, access.accountId, access.membershipId,
    access.memberId, access.authorityRevision, options.intent, options.resolution]);
  const query = React.useMemo(() => options.resolution.kind === "supported" ? options.resolution.query : {}, [JSON.stringify(options.resolution)]);
  const page = useLeadServerPagedCollection({
    scopeKey, enabled: options.enabled && options.resolution.kind === "supported", query,
    initialPageSize: 50, project: projectPage, evictProjection, retainPreviousPage: false,
  });
  // A retained response may be used by the shared hook for refresh bookkeeping,
  // but cannot be labeled as the current page or survive an authorization error.
  const ready = page.enabled && !page.loading && !page.error;
  return { ...page, scopeKey, items: ready ? page.items : [],
    totalItems: ready ? page.totalItems : 0, rangeStart: ready ? page.rangeStart : 0,
    rangeEnd: ready ? page.rangeEnd : 0 };
}
