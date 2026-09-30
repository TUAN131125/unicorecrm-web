import { useState } from "react";
import { useI18n } from "@/i18n";
import { Button, Modal, Select, Textarea } from "@/shared/components/ui";
import { formatApplicationError, useAuthoritativeResource } from "@/shared/operations";
import { CAPABILITIES, useEffectiveRecordAccess } from "@/platform/access-control";
import { useRecordOwnershipContext } from "@/platform/record-ownership";
import { getScopedTaskCollectionResource } from "@/modules/tasks";
import { isLeadOperationAvailable, LEAD_OPERATION } from "../../application/leadOperationAvailability";
import { useLeadOwnerAssign } from "../hooks/useLeadOwnerAssign";
import type { Lead } from "../../domain/model/lead.types";

type Props = { lead: Lead; onAssigned?: (id: string) => void; refresh?: () => Promise<unknown> };

export function LeadOwnerAssignAction(props: Props) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const authority = useEffectiveRecordAccess({ resourceKey: "leads", recordId: props.lead.id, record: props.lead,
    requestedCommands: ["lead.assign-owner"], requestedFields: ["ownerId"] });
  const available = Boolean(isLeadOperationAvailable(LEAD_OPERATION.ASSIGN_OWNER) && !props.lead.archivedAt
    && authority.data?.allowedCommands.includes("lead.assign-owner") && authority.data?.fieldAccess.ownerId === "READ_WRITE");
  return <>
    {available && <Button data-guidance-id="leads.owner.assign" size="xs" onClick={(event) => { event.stopPropagation(); setOpen(true); }}>
      {props.lead.ownerId ? (locale === "vi" ? "Đổi phụ trách" : "Change owner") : (locale === "vi" ? "Phân công" : "Assign owner")}
    </Button>}
    <LeadOwnerAssignDialog key={props.lead.id} {...props} isOpen={open} canSubmit={available} onClose={() => setOpen(false)} />
  </>;
}

export function LeadOwnerAssignDialog({ lead, onAssigned, refresh, onClose, isOpen = true, canSubmit = true }: Props & { onClose: () => void; isOpen?: boolean; canSubmit?: boolean }) {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const ownership = useRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
  const owners = ownership?.assignableOwners ?? [];
  const [ownerId, setOwnerId] = useState("");
  const [reason, setReason] = useState("");
  const command = useLeadOwnerAssign(lead, onAssigned, refresh);
  const tasks = useAuthoritativeResource(getScopedTaskCollectionResource({ filters: { recordModuleKey: "leads", recordId: lead.id } }), { enabled: isOpen });
  const hasOpenTasks = tasks.data?.items.some((task) => task.status === "OPEN" && !task.archivedAt);
  const currentOwner = ownership?.visibleOwners.find((owner) => owner.memberId === command.observed.ownerId)?.displayName
    ?? (command.observed.ownerId ? text("Chưa xác định", "Unknown") : text("Chưa phân công", "Unassigned"));
  return <Modal isOpen={isOpen} onClose={() => { if (!command.pending) onClose(); }} title={text("Phân công Lead", "Assign Lead owner")}>
    <form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); if (!canSubmit) return; if (tasks.state !== "READY" && tasks.state !== "ERROR") return; if (await command.submit(ownerId, reason)) { setOwnerId(""); setReason(""); onClose(); } }}>
      <p className="text-sm">{text("Phụ trách hiện tại", "Current owner")}: {currentOwner}</p>
      {hasOpenTasks && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{text(
        "Phân công chỉ đổi người phụ trách Lead. Các công việc đang mở giữ nguyên người thực hiện; dùng Bàn giao khi cần chuyển công việc.",
        "Assignment changes only the Lead owner. Open Tasks keep their assignee; use Handover when Tasks need to move.")}</p>}
      {tasks.error && <p role="status">{text("Chưa tải được công việc. Phân công không chuyển công việc.", "Tasks could not be loaded. Assignment does not transfer Tasks.")}</p>}
      <Select data-guidance-id="leads.owner.assign.target" label={text("Người phụ trách mới", "New owner")} required value={ownerId} disabled={command.pending || command.ambiguous} onChange={(event) => setOwnerId(event.target.value)}>
        <option value="">{text("Chọn người phụ trách", "Select owner")}</option>
        {owners.filter((owner) => owner.memberId !== command.observed.ownerId).map((owner) => <option key={owner.memberId} value={owner.memberId}>{owner.displayName}</option>)}
      </Select>
      <Textarea data-guidance-id="leads.owner.assign.reason" label={text("Lý do phân công", "Assignment reason")} required maxLength={2000} value={reason} disabled={command.pending || command.ambiguous} onChange={(event) => setReason(event.target.value)} />
      {command.error !== undefined && <p role="alert">{formatApplicationError(command.error, { locale })}</p>}
      {command.blocked && <Button type="button" onClick={() => void command.recover()}>{text("Tải lại Lead", "Refresh Lead")}</Button>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={command.pending} onClick={onClose}>{text("Hủy", "Cancel")}</Button>
        <Button type="submit" disabled={!canSubmit || command.pending || command.blocked || (tasks.state !== "READY" && tasks.state !== "ERROR") || !ownerId || ownerId === command.observed.ownerId || !reason.trim()}>{command.pending ? text("Đang phân công…", "Assigning…") : command.ambiguous ? text("Thử lại", "Retry") : text("Xác nhận", "Confirm")}</Button>
      </div>
    </form>
  </Modal>;
}
