import React from "react";
import { Archive, Copy, Edit3, Eye, Trophy, XCircle } from "lucide-react";
import type { Deal } from "../../domain/model/deal.types";
import { MenuDivider, MenuItemButton, MenuSection } from "@/shared/components/ui";

interface DealActionMenuProps {
  deal: Deal;
  onViewDetails: (deal: Deal) => void;
  onEdit: (deal: Deal) => void;
  onDuplicate: (deal: Deal) => void;
  onMarkWon: (deal: Deal) => void;
  onMarkLost: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
  labels: {
    record: string;
    outcome: string;
    danger: string;
    viewDetail: string;
    edit: string;
    duplicate: string;
    markWon: string;
    markLost: string;
    delete: string;
  };
}

export const DealActionMenu: React.FC<DealActionMenuProps> = ({
  deal,
  onViewDetails,
  onEdit,
  onDuplicate,
  onMarkWon,
  onMarkLost,
  onDelete,
  labels,
}) => (
  <div className="w-full max-h-[calc(100vh-96px)] overflow-y-auto crm-scroll-y rounded-xl border border-slate-200 bg-white p-1.5 text-left text-xs shadow-2xl space-y-0.5 font-sans animate-fade-in" data-opportunity-row-action-menu="v1">
    <MenuSection title={labels.record} />
    <MenuItemButton onClick={() => onViewDetails(deal)} icon={<Eye size={14} />}>
      {labels.viewDetail}
    </MenuItemButton>
    <MenuItemButton onClick={() => onEdit(deal)} icon={<Edit3 size={14} />}>
      {labels.edit}
    </MenuItemButton>
    <MenuItemButton onClick={() => onDuplicate(deal)} icon={<Copy size={14} />}>
      {labels.duplicate}
    </MenuItemButton>

    <MenuDivider />
    <MenuSection title={labels.outcome} />
    <MenuItemButton onClick={() => onMarkWon(deal)} variant="primary" icon={<Trophy size={14} />}>
      {labels.markWon}
    </MenuItemButton>
    <MenuItemButton onClick={() => onMarkLost(deal)} icon={<XCircle size={14} />}>
      {labels.markLost}
    </MenuItemButton>

    <MenuDivider />
    <MenuSection title={labels.danger} />
    <MenuItemButton onClick={() => onDelete(deal)} variant="danger" icon={<Archive size={14} />}>
      {labels.delete}
    </MenuItemButton>
  </div>
);
