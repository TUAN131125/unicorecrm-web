import React from "react";
import { Truck } from "lucide-react";
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
import type { ShippingBooking } from "../../domain/model/shipping.types";
import { ShippingBookingStatusBadge, ShippingCarrierStatusBadge } from "../components/ShippingStatusBadges";

interface ShippingBookingTableProps {
  records: ShippingBooking[];
  locale: "vi" | "en";
  activeRecordId?: string;
  onOpen(record: ShippingBooking): void;
  onOpenActions(record: ShippingBooking, anchor: HTMLElement): void;
  purposeLabel(record: ShippingBooking): string;
  sourceTypeLabel(record: ShippingBooking): string;
  sourceReference(record: ShippingBooking): string;
  groupAttemptCount(record: ShippingBooking): number;
  formatMoney(amount: string | number, currency?: string): string;
}

export const ShippingBookingTable: React.FC<ShippingBookingTableProps> = ({
  records,
  locale,
  activeRecordId,
  onOpen,
  onOpenActions,
  purposeLabel,
  sourceTypeLabel,
  sourceReference,
  groupAttemptCount,
  formatMoney,
}) => {
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  return (
    <ListTableSurface surfaceId="shipping">
      <ListDataTable minWidth={1380}>
        <ListTableHead>
          <tr>
            <ListTableHeaderCell>{text("Vận đơn", "Shipment")}</ListTableHeaderCell>
            <ListTableHeaderCell>{text("Nguồn nghiệp vụ", "Business source")}</ListTableHeaderCell>
            <ListTableHeaderCell>{text("Người nhận", "Recipient")}</ListTableHeaderCell>
            <ListTableHeaderCell>{text("Đơn vị vận chuyển", "Carrier")}</ListTableHeaderCell>
            <ListTableHeaderCell>{text("Đợt giao", "Attempt")}</ListTableHeaderCell>
            <ListTableHeaderCell>{text("Sẵn sàng", "Readiness")}</ListTableHeaderCell>
            <ListTableHeaderCell align="center">{text("Yêu cầu", "Booking")}</ListTableHeaderCell>
            <ListTableHeaderCell align="center">{text("Vận chuyển", "Carrier state")}</ListTableHeaderCell>
            <ListTableHeaderCell align="right">COD</ListTableHeaderCell>
            <ListTableHeaderCell>{text("Cập nhật", "Updated")}</ListTableHeaderCell>
            <ListTableHeaderCell align="center" sticky="right">{text("Thao tác", "Actions")}</ListTableHeaderCell>
          </tr>
        </ListTableHead>
        <ListTableBody>
          {records.map((record) => {
            const readiness = record.readiness?.score ?? 100;
            return (
              <ListTableRow key={record.id}>
                <ListTableCell>
                  <ListRecordIdentity
                    avatar={<Truck size={15} />}
                    toneClassName="border-sky-200 bg-sky-50 text-sky-700"
                    primary={record.code}
                    secondary={record.trackingCode || text("Chưa có mã theo dõi", "No tracking code")}
                    onOpen={() => onOpen(record)}
                  />
                </ListTableCell>
                <ListTableCell><div className="font-medium text-slate-800">{purposeLabel(record)}</div><div className="mt-0.5 crm-text-wrap text-[10px] text-slate-400">{sourceTypeLabel(record)} · {sourceReference(record)}</div></ListTableCell>
                <ListTableCell><div className="font-medium text-slate-800">{record.recipientSnapshot.name}</div><div className="mt-0.5 text-[10px] text-slate-400">{record.recipientSnapshot.phone}</div></ListTableCell>
                <ListTableCell><div className="font-medium text-slate-800">{record.providerNameSnapshot}</div><div className="mt-0.5 crm-text-wrap text-[10px] text-slate-400">{record.serviceNameSnapshot || record.serviceCode || text("Chưa chọn dịch vụ", "No service selected")}</div></ListTableCell>
                <ListTableCell><div className="font-medium text-slate-800">{text("Lần", "Attempt")} {record.attemptNo ?? 1}</div><div className="mt-0.5 text-[10px] text-slate-400">{text("Tổng", "Total")} {groupAttemptCount(record)} {text("lần thử", "attempts")}</div></ListTableCell>
                <ListTableCell>
                  <div className="w-28">
                    <div className={`font-medium ${readiness >= 85 ? "text-emerald-700" : readiness >= 60 ? "text-amber-700" : "text-rose-700"}`}>{readiness}%</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${readiness >= 85 ? "bg-emerald-500" : readiness >= 60 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${readiness}%` }} /></div>
                    {record.readiness?.missingRequired.length ? <div className="mt-1 max-w-[220px] crm-text-wrap text-[9px] text-rose-600">{record.readiness.missingRequired.join(", ")}</div> : null}
                  </div>
                </ListTableCell>
                <ListTableCell align="center"><ShippingBookingStatusBadge status={record.bookingStatus} /></ListTableCell>
                <ListTableCell align="center"><ShippingCarrierStatusBadge status={record.externalStatus} /></ListTableCell>
                <ListTableCell align="right" className="whitespace-nowrap font-semibold text-slate-800">{record.codAmount ? formatMoney(record.codAmount.amount, record.codAmount.currency) : "—"}</ListTableCell>
                <ListTableCell className="whitespace-nowrap text-slate-500">{new Date(record.updatedAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</ListTableCell>
                <ListTableCell align="center" sticky="right"><ActionDropdownTrigger isOpen={activeRecordId === record.id} onClick={(event) => { event.stopPropagation(); onOpenActions(record, event.currentTarget); }} title={text(`Thao tác vận đơn ${record.code}`, `Shipment actions ${record.code}`)} /></ListTableCell>
              </ListTableRow>
            );
          })}
        </ListTableBody>
      </ListDataTable>
    </ListTableSurface>
  );
};
