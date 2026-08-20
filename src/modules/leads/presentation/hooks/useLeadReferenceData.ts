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
  const products = useSubscribableSnapshot(getProductCatalogSnapshot, subscribeToProductCatalog);
  const [members, setMembers] = useState<WorkspaceMemberDirectoryEntry[]>(
    () => listWorkspaceMemberDirectoryFor(workspace.workspaceId),
  );

  useEffect(() => {
    const refresh = () => setMembers(listWorkspaceMemberDirectoryFor(workspace.workspaceId));
    refresh();
    return subscribeToWorkspacePeople((snapshot) => {
      if (snapshot.workspaceId === workspace.workspaceId) refresh();
    });
  }, [workspace.workspaceId]);

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
  return locale === "vi" ? `Không tìm thấy thành viên (${memberId})` : `Member not found (${memberId})`;
}
