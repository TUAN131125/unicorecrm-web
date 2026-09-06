import { useEffect, useMemo, useState } from "react";
import type { LeadCampaign, LeadSource } from "../../domain/model/lead.types";
import type { Product } from "@/modules/products";
import { getProductCatalogSnapshot, subscribeToProductCatalog } from "@/modules/products";
import {
  listWorkspaceMemberDirectoryFor,
  type WorkspaceMemberDirectoryEntry,
} from "@/platform/member-directory";
import { subscribeToWorkspacePeople } from "@/platform/workspace-membership";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useSubscribableSnapshot } from "@/platform/react";
import { CAPABILITIES } from "@/platform/access-control";
import { useRecordOwnershipContext } from "@/platform/record-ownership";

export interface LeadReferenceData {
  members: WorkspaceMemberDirectoryEntry[];
  products: Product[];
  sources: LeadSource[];
  campaigns: LeadCampaign[];
  memberById: ReadonlyMap<string, WorkspaceMemberDirectoryEntry>;
  productById: ReadonlyMap<string, Product>;
}

export function useLeadReferenceData(
  sources: readonly LeadSource[] = [],
  campaigns: readonly LeadCampaign[] = [],
): LeadReferenceData {
  const workspace = useWorkspaceContextSnapshot();
  const ownership = useRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
  const products = useSubscribableSnapshot(getProductCatalogSnapshot, subscribeToProductCatalog);
  const [directoryMembers, setDirectoryMembers] = useState<WorkspaceMemberDirectoryEntry[]>(
    () => listWorkspaceMemberDirectoryFor(workspace.workspaceId),
  );

  useEffect(() => {
    const refresh = () => setDirectoryMembers(listWorkspaceMemberDirectoryFor(workspace.workspaceId));
    refresh();
    return subscribeToWorkspacePeople((snapshot) => {
      if (snapshot.workspaceId === workspace.workspaceId) refresh();
    });
  }, [workspace.workspaceId]);

  const members = useMemo(() => {
    const byId = new Map(directoryMembers.map((member) => [member.memberId, member]));
    for (const owner of ownership?.visibleOwners ?? []) {
      byId.set(owner.memberId, {
        memberId: owner.memberId,
        displayName: owner.displayName,
        ...(owner.email === undefined ? {} : { email: owner.email }),
        accountSource: "unknown",
      });
    }
    return [...byId.values()];
  }, [directoryMembers, ownership?.visibleOwners]);

  const stableSources = useMemo(() => sources.filter((source) => source.isActive), [sources]);
  const stableCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.isActive), [campaigns]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.memberId, member])), [members]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  return {
    members,
    products,
    sources: stableSources,
    campaigns: stableCampaigns,
    memberById,
    productById,
  };
}

export function getLeadMemberDisplay(
  memberById: ReadonlyMap<string, WorkspaceMemberDirectoryEntry>,
  memberId: string | undefined,
  locale: "vi" | "en",
): string {
  if (!memberId || memberId === "unassigned") return locale === "vi" ? "Chưa phân công" : "Unassigned";
  const member = memberById.get(memberId);
  if (member?.displayName && member.displayName !== "—") return member.displayName;
  return locale === "vi" ? "Chưa có thông tin người phụ trách" : "Owner information unavailable";
}
