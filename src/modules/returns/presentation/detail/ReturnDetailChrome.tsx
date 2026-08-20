import { Activity, CheckCircle2, ClipboardCheck, ListChecks, PackageCheck, PackageOpen, RefreshCw, ShieldCheck, Truck, XCircle } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { recordDetailHeaderActionButtonClassName } from "@/components/crm/detail-archetype";
import type { ReturnRequest, ReturnResolutionIntent } from "../../domain/model/return.types";

export function createReturnDetailTabs(request: ReturnRequest, intents: ReturnResolutionIntent[], receivedTotal: number, approvedTotal: number, auditLabel: string) {
  return [
    { key: "OVERVIEW", label: "Tổng quan", icon: <PackageOpen size={14} /> },
    { key: "ITEMS", label: "Hàng yêu cầu", icon: <ListChecks size={14} />, count: request.items.length },
    { key: "RETURN_FLOW", label: "Thu hồi & nhận hàng", icon: <Truck size={14} />, alert: request.status === "AWAITING_ITEM" && receivedTotal < approvedTotal },
    { key: "RESOLUTION", label: "Xử lý", icon: <RefreshCw size={14} />, count: intents.filter((item) => item.status === "PENDING").length, alert: intents.some((item) => item.status === "PENDING") },
    { key: "ACTIVITY", label: auditLabel, icon: <Activity size={14} /> },
  ];
}

export function ReturnHeaderActions({
  actionIds,
  onApprove,
  onReject,
  onOpenReturnFlow,
  onOpenResolution,
  onClose,
}: {
  actionIds: string[];
  onApprove: () => void;
  onReject: () => void;
  onOpenReturnFlow: () => void;
  onOpenResolution: () => void;
  onClose: () => void;
}) {
  return actionIds.map((actionId) => {
    if (actionId === "approve") return <Button key={actionId} type="button" actionIntent="confirm" size="sm" icon={<ShieldCheck size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={onApprove}>Duyệt</Button>;
    if (actionId === "reject") return <Button key={actionId} type="button" actionIntent="destructive" size="sm" icon={<XCircle size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={onReject}>Từ chối</Button>;
    if (actionId === "create-pickup") return <Button key={actionId} type="button" actionIntent="create" size="sm" icon={<PackageCheck size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={onOpenReturnFlow}>Thiết lập thu hồi</Button>;
    if (actionId === "receive") return <Button key={actionId} type="button" actionIntent="save" size="sm" icon={<ClipboardCheck size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={onOpenReturnFlow}>Ghi nhận nhận hàng</Button>;
    if (actionId === "resolve") return <Button key={actionId} type="button" actionIntent="retry" size="sm" icon={<RefreshCw size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={onOpenResolution}>Xử lý resolution</Button>;
    if (actionId === "close") return <Button key={actionId} type="button" actionIntent="complete" size="sm" icon={<CheckCircle2 size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={onClose}>Đóng Return</Button>;
    return null;
  });
}
