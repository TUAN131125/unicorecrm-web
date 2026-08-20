import React from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { Button, Modal } from "@/shared/components/ui";
import { auditCustomerRelationshipDataQuality } from "../../public/api";

interface CustomerDataQualityPanelProps { isOpen: boolean; onClose(): void; isVi: boolean; }

export function CustomerDataQualityPanel({ isOpen, onClose, isVi }: CustomerDataQualityPanelProps) {
  const summary = React.useMemo(() => auditCustomerRelationshipDataQuality(), [isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={isVi ? "Chất lượng dữ liệu quan hệ khách hàng" : "Customer relationship data quality"}>
      <div className="space-y-4 text-left">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label={isVi ? "Tổng vấn đề" : "Total issues"} value={summary.total} icon={<ShieldCheck size={16} />} />
          <Metric label={isVi ? "Lỗi" : "Errors"} value={summary.errors} icon={<AlertTriangle size={16} />} />
          <Metric label={isVi ? "Cảnh báo" : "Warnings"} value={summary.warnings} icon={<AlertTriangle size={16} />} />
          <Metric label={isVi ? "Thông tin" : "Info"} value={summary.info} icon={<Info size={16} />} />
        </div>
        {summary.total === 0 ? <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800"><CheckCircle2 size={18} />{isVi ? "Không phát hiện vấn đề đồng bộ." : "No synchronization issues detected."}</div> : (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {summary.issues.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${item.severity === "ERROR" ? "bg-rose-100 text-rose-700" : item.severity === "WARNING" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{item.severity}</span><span className="text-[10px] font-semibold text-slate-500">{item.type}</span><span className="font-mono text-[9px] text-slate-400">{item.recordId}</span></div><p className="mt-2 text-xs leading-5 text-slate-700">{item.message}</p></div>)}
          </div>
        )}
        <div className="flex justify-end"><Button type="button" variant="secondary" onClick={onClose}>{isVi ? "Đóng" : "Close"}</Button></div>
      </div>
    </Modal>
  );
}

const Metric: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>{icon}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div></div>;
