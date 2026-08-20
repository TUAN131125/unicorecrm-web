import React from "react";
import { PackageOpen } from "lucide-react";
import { ActionDropdownTrigger } from "@/components/crm/ActionDropdownTrigger";
import {
  ListDataTable,
  ListRecordIdentity,
  ListTableBody,
  ListTableCell,
  ListTableHead,
  ListTableHeaderCell,
  ListTableRow,
  ListTableSurface,
} from "@/components/crm/list-archetype";
import type { CustomerOrder } from "@/modules/orders";
import type { ReturnRequest } from "../../domain/model/return.types";
import { ReturnStatusBadge } from "../components/ReturnStatusBadge";

interface ReturnTableProps {
  records: ReturnRequest[];
  orders: CustomerOrder[];
  selectedIds: string[];
  locale: "vi" | "en";
  activeRecordId?: string;
  onSelect(id: string, checked: boolean): void;
  onOpen(record: ReturnRequest): void;
  onOpenActions(record: ReturnRequest, anchor: HTMLElement): void;
  stageOf(record: ReturnRequest): string;
  stageLabel: Record<string, string>;
  reasonLabel: Record<string, string>;
  resolutionLabel: Record<string, string>;
  requestedQuantity(record: ReturnRequest): number;
  approvedQuantity(record: ReturnRequest): number;
  receivedQuantity(record: ReturnRequest): number;
}

export const ReturnTable: React.FC<ReturnTableProps> = ({
  records,
  orders,
  selectedIds,
  locale,
  activeRecordId,
  onSelect,
  onOpen,
  onOpenActions,
  stageOf,
  stageLabel,
  reasonLabel,
  resolutionLabel,
  requestedQuantity,
  approvedQuantity,
  receivedQuantity,
}) => {
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  return (
  <ListTableSurface surfaceId="returns">
    <ListDataTable minWidth={1260}>
      <ListTableHead>
        <tr>
          <ListTableHeaderCell align="center" className="w-12"><span className="sr-only">{text("Chọn", "Select")}</span></ListTableHeaderCell>
          <ListTableHeaderCell>{text("Yêu cầu đổi / trả", "Return request")}</ListTableHeaderCell>
          <ListTableHeaderCell>{text("Đơn hàng", "Order")}</ListTableHeaderCell>
          <ListTableHeaderCell>{text("Khách hàng", "Customer")}</ListTableHeaderCell>
          <ListTableHeaderCell>{text("Giai đoạn xử lý", "Processing stage")}</ListTableHeaderCell>
          <ListTableHeaderCell>{text("Số lượng", "Quantity")}</ListTableHeaderCell>
          <ListTableHeaderCell>{text("Phương án", "Resolution")}</ListTableHeaderCell>
          <ListTableHeaderCell align="center">{text("Điều kiện", "Eligibility")}</ListTableHeaderCell>
          <ListTableHeaderCell align="center">{text("Trạng thái", "Status")}</ListTableHeaderCell>
          <ListTableHeaderCell>{text("Cập nhật", "Updated")}</ListTableHeaderCell>
          <ListTableHeaderCell align="center" sticky="right">{text("Thao tác", "Actions")}</ListTableHeaderCell>
        </tr>
      </ListTableHead>
      <ListTableBody>
        {records.map((request) => {
          const order = orders.find((item) => item.id === request.orderId);
          const stage = stageOf(request);
          const approved = approvedQuantity(request);
          const received = receivedQuantity(request);
          return (
            <ListTableRow key={request.id} selected={selectedIds.includes(request.id)}>
              <ListTableCell align="center"><input type="checkbox" checked={selectedIds.includes(request.id)} onChange={(event) => onSelect(request.id, event.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></ListTableCell>
              <ListTableCell><ListRecordIdentity avatar={<PackageOpen size={15} />} primary={request.code} secondary={reasonLabel[request.reason] ?? request.reason} onOpen={() => onOpen(request)} /></ListTableCell>
              <ListTableCell><div className="font-medium text-indigo-600">{order?.orderNumber ?? request.orderId}</div></ListTableCell>
              <ListTableCell><div className="font-medium text-slate-800">{order?.customerName ?? request.buyerRef.id}</div><div className="mt-0.5 text-[10px] text-slate-400">{request.buyerRef.type}</div></ListTableCell>
              <ListTableCell><div className="font-medium text-slate-800">{stageLabel[stage] ?? stage}</div>{request.returnMethod ? <div className="mt-0.5 text-[10px] text-slate-400">{request.returnMethod.method}</div> : null}</ListTableCell>
              <ListTableCell><div className="font-medium text-slate-900">{requestedQuantity(request)} {text("yêu cầu", "requested")}</div>{approved > 0 ? <div className="mt-0.5 text-[10px] text-slate-400">{received}/{approved} {text("đã nhận", "received")}</div> : null}</ListTableCell>
              <ListTableCell>{resolutionLabel[request.requestedResolution ?? ""] ?? request.requestedResolution ?? "—"}</ListTableCell>
              <ListTableCell align="center"><span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-medium ${request.eligibilityResult.eligible ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{request.eligibilityResult.eligible ? text("Đủ điều kiện", "Eligible") : text("Cần quyết định", "Decision required")}</span></ListTableCell>
              <ListTableCell align="center"><ReturnStatusBadge status={request.status} /></ListTableCell>
              <ListTableCell className="whitespace-nowrap text-slate-500">{new Date(request.updatedAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</ListTableCell>
              <ListTableCell align="center" sticky="right"><ActionDropdownTrigger isOpen={activeRecordId === request.id} onClick={(event) => { event.stopPropagation(); onOpenActions(request, event.currentTarget); }} title={text(`Thao tác với yêu cầu ${request.code}`, `Actions for request ${request.code}`)} /></ListTableCell>
            </ListTableRow>
          );
        })}
      </ListTableBody>
    </ListDataTable>
  </ListTableSurface>
  );
};
