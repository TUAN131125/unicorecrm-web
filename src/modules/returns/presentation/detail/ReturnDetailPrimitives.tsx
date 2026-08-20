import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui";
import type { ShippingBooking } from "@/modules/shipping";

export function ReturnInfo({ label, value }: { label: string; value: ReactNode }) {
  return <div className="space-y-1"><div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</div><div className="break-words text-sm font-medium text-slate-800">{value}</div></div>;
}

export function ShippingEvidenceRow({ booking, onOpen, onSync }: { booking: ShippingBooking; onOpen: () => void; onSync: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <button type="button" onClick={onOpen} className="text-left">
        <span className="text-xs font-medium text-slate-900">{booking.code}</span>
        <span className="ml-2 text-[11px] text-slate-500">{booking.purpose}</span>
        <div className="mt-1 text-[10px] font-medium text-violet-600">{booking.bookingStatus} · {booking.externalStatus} · {booking.readiness?.score ?? 0}% ready</div>
      </button>
      {booking.bookingStatus === "BOOKED" && booking.externalStatus !== "DELIVERED" && <Button type="button" actionIntent="sync" size="sm" icon={<RefreshCw size={13} />} onClick={onSync}>Đồng bộ</Button>}
    </div>
  );
}
