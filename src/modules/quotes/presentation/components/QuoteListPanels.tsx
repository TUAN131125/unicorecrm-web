import { AlertCircle, CheckCircle2, DollarSign, RefreshCw, Sliders, User } from "lucide-react";
import { Button, Card, Modal } from "@/shared/components/ui";
import type { Deal } from "@/modules/deals";
import type { CustomerDisplay as Customer } from "@/modules/customers";

import { formatCurrency } from "@/shared/lib/format/currency";

export interface QuoteListKpis {
  totalCount: number;
  draftCount: number;
  reviewCount: number;
  sentCount: number;
  acceptedCount: number;
  rejectedCount: number;
  expiredCount: number;
  totalValue: number;
  acceptedValue: number;
  avgValue: number;
  conversionRate: number;
  directCount: number;
  linkedCount: number;
  expiringSoonCount: number;
}

interface QuoteListPanelsProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen(value: boolean): void;
  locale: string;
  baseCurrency: string;
  creationSource: "deal" | "direct";
  setCreationSource(value: "deal" | "direct"): void;
  selectedSourceId: string;
  setSelectedSourceId(value: string): void;
  deals: Deal[];
  customers: Customer[];
  t(key: string): string;
  handleStartCreation(): void;
  currencies: string[];
  isStatsOpen: boolean;
  setIsStatsOpen(value: boolean): void;
  kpis: QuoteListKpis;
}

export function QuoteListPanels(props: QuoteListPanelsProps) {
  const {
    isCreateModalOpen, setIsCreateModalOpen, locale, baseCurrency, creationSource, setCreationSource,
    selectedSourceId, setSelectedSourceId, deals, customers, t, handleStartCreation,
    isStatsOpen, setIsStatsOpen, kpis, currencies,
  } = props;

  return (
    <>
      {/* WORKFLOW CREATION TYPE POPUP */}
      <Modal variant="form"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={locale === "vi" ? "Phương thức lập báo giá" : "Choose Quote Method"}
        size="sm"
      >
        <div className="space-y-4 text-left p-1 text-xs">
          <p className="text-slate-500 font-semibold mb-3">
            {locale === "vi"
              ? "Báo giá trong UnicoreCRM có thể tạo ra dưới dạng liên kết cơ hội để bóc tách sản phẩm dòng tiền, hoặc trực tiếp gửi khách hàng vãng lai."
              : "Quotes can be linked to an Opportunity or issued directly to a Contact/Organization Account buyer."}
          </p>

          <div className="grid grid-cols-2 gap-3.5">
            <div
              onClick={() => { setCreationSource("deal"); setSelectedSourceId(deals[0]?.id || ""); }}
              className={`p-3 border rounded-xl cursor-pointer transition flex flex-col justify-between ${creationSource === "deal" ? "border-indigo-600 bg-indigo-50/20 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <div className="flex items-center gap-2 font-medium mb-1">
                <Sliders size={14} className="text-indigo-600" />
                <span>{locale === "vi" ? "Từ Cơ hội bán hàng" : "From Opportunity"}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">{locale === "vi" ? "Thừa hưởng danh mục sản phẩm quan tâm và dòng tiền từ Deal" : "Inherits products, value, and client details automatically."}</p>
            </div>

            <div
              onClick={() => { setCreationSource("direct"); setSelectedSourceId(customers[0]?.id || ""); }}
              className={`p-3 border rounded-xl cursor-pointer transition flex flex-col justify-between ${creationSource === "direct" ? "border-indigo-600 bg-indigo-50/20 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <div className="flex items-center gap-2 font-medium mb-1">
                <User size={14} className="text-sky-600" />
                <span>{locale === "vi" ? "Gửi trực tiếp buyer" : "Direct Buyer Quote"}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">{locale === "vi" ? "Tạo Quote cho Contact/Organization Account mà không cần Deal" : "Create a Quote for a Contact/Organization Account without requiring a Deal."}</p>
            </div>
          </div>

          <div className="pt-3">
            {creationSource === "deal" ? (
              <div className="space-y-1">
                <label className="block text-[10px] font-medium text-slate-400 uppercase">{locale === "vi" ? "CHỌN CƠ HỘI BÁN HÀNG" : "SELECT OPPORTUNITY"}</label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-350 bg-white rounded-lg font-semibold focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">{locale === "vi" ? "-- Chọn cơ hội --" : "-- Select Opp --"}</option>
                  {deals.map(d => (
                    <option key={d.id} value={d.id}>[{d.stage}] {d.name} ({formatCurrency(d.amount ?? 0, d.currency || baseCurrency, locale)})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-[10px] font-medium text-slate-400 uppercase">{locale === "vi" ? "CHỌN KHÁCH HÀNG (MỞ RỘNG)" : "SELECT CUSTOMER (OPTIONAL)"}</label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-350 bg-white rounded-lg font-semibold focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">{locale === "vi" ? "-- Không chọn (Nhập tay sau) --" : "-- No selection (Manual fill later) --"}</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.displayName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={handleStartCreation} className="bg-indigo-600 hover:bg-indigo-700">
              {locale === "vi" ? "Bắt đầu thiết kế" : "Launch Builder"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* STATISTICS MODAL */}
      <Modal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        title={locale === "vi" ? "Thống kê Báo giá & Đề xuất" : "Quotes & Proposals Statistics"}
        size="md"
      >
        <div className="space-y-5 text-left p-1 text-xs">
          {/* Main KPI counts grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="p-3 flex flex-col justify-between bg-indigo-50/35 border border-indigo-100 shadow-xs rounded-xl">
              <span className="text-[10px] font-medium text-indigo-500 uppercase tracking-wider">{locale === "vi" ? "Tổng số báo giá" : "Total Quotes"}</span>
              <span className="text-xl font-semibold text-indigo-900 mt-1">{kpis.totalCount}</span>
            </Card>
            <Card className="p-3 flex flex-col justify-between bg-slate-50 border border-slate-200 shadow-xs rounded-xl">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{locale === "vi" ? "Bản nháp (Draft)" : "Draft Quotes"}</span>
              <span className="text-xl font-semibold text-slate-700 mt-1">{kpis.draftCount}</span>
            </Card>
            <Card className="p-3 flex flex-col justify-between bg-indigo-50/35 border border-indigo-200 shadow-xs rounded-xl">
              <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">{locale === "vi" ? "Chờ duyệt (Review)" : "In Review"}</span>
              <span className="text-xl font-semibold text-indigo-700 mt-1">{kpis.reviewCount}</span>
            </Card>
            <Card className="p-3 flex flex-col justify-between bg-amber-50/40 border border-amber-200 shadow-xs rounded-xl">
              <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">{locale === "vi" ? "Đã gửi khách hàng" : "Sent Quotes"}</span>
              <span className="text-xl font-semibold text-amber-700 mt-1">{kpis.sentCount}</span>
            </Card>
            <Card className="p-3 flex flex-col justify-between bg-emerald-50/40 border border-emerald-200 shadow-xs rounded-xl">
              <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">{locale === "vi" ? "Chấp nhận (Accepted)" : "Accepted Quotes"}</span>
              <span className="text-xl font-semibold text-emerald-700 mt-1">{kpis.acceptedCount}</span>
            </Card>
            <Card className="p-3 flex flex-col justify-between bg-rose-50/40 border border-rose-200 shadow-xs rounded-xl">
              <span className="text-[10px] font-medium text-rose-600 uppercase tracking-wider">{locale === "vi" ? "Từ chối (Rejected)" : "Rejected Quotes"}</span>
              <span className="text-xl font-semibold text-rose-700 mt-1">{kpis.rejectedCount}</span>
            </Card>
            <Card className="p-3 flex flex-col justify-between bg-orange-50/40 border border-orange-200 shadow-xs rounded-xl">
              <span className="text-[10px] font-medium text-orange-600 uppercase tracking-wider">{locale === "vi" ? "Hết hiệu lực" : "Expired Quotes"}</span>
              <span className="text-xl font-semibold text-orange-700 mt-1">{kpis.expiredCount}</span>
            </Card>
          </div>

          {/* Financial summary metrics */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-3.5 bg-white border border-slate-200 shadow-xs rounded-xl flex flex-col justify-between">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={12} className="text-indigo-500" />
                <span>{locale === "vi" ? "Tổng GT đề xuất" : "Total Quoted Value"}</span>
              </div>
              <span className="text-sm font-semibold text-indigo-700 mt-2 select-all">{currencies.length === 1 ? formatCurrency(kpis.totalValue, currencies[0] || baseCurrency, locale) : (locale === "vi" ? "Nhiều tiền tệ" : "Mixed currencies")}</span>
            </Card>
            <Card className="p-3.5 bg-white border border-slate-200 shadow-xs rounded-xl flex flex-col justify-between">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>{locale === "vi" ? "Doanh số chốt" : "Accepted Revenue"}</span>
              </div>
              <span className="text-sm font-semibold text-emerald-600 mt-2 select-all">{currencies.length === 1 ? formatCurrency(kpis.acceptedValue, currencies[0] || baseCurrency, locale) : (locale === "vi" ? "Nhiều tiền tệ" : "Mixed currencies")}</span>
            </Card>
            <Card className="p-3.5 bg-white border border-slate-200 shadow-xs rounded-xl flex flex-col justify-between">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <RefreshCw size={12} className="text-slate-400 animate-spin-slow" />
                <span>{locale === "vi" ? "Giá trị báo giá TB" : "Average Quote Value"}</span>
              </div>
              <span className="text-sm font-semibold text-slate-700 mt-2 select-all">{currencies.length === 1 ? formatCurrency(kpis.avgValue, currencies[0] || baseCurrency, locale) : (locale === "vi" ? "Theo từng tiền tệ" : "Per currency")}</span>
            </Card>
          </div>

          {/* Advanced insights block */}
          <div className="space-y-3 bg-slate-50 p-4 border border-slate-100 rounded-xl">
            <h4 className="text-[11px] font-semibold text-slate-800 uppercase tracking-wider mb-2">{locale === "vi" ? "Chi tiết Hiệu suất & Phân bổ" : "Performance & Distribution Insights"}</h4>

            {/* Conversion rate progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-medium text-slate-600">
                <span>{locale === "vi" ? "Tỷ lệ chấp nhận (Accepted / Sent)" : "Acceptance Rate (Accepted / Sent)"}</span>
                <span className="text-indigo-600 font-semibold">{kpis.conversionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-250 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(kpis.conversionRate, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-medium text-slate-500">
                  <span>{locale === "vi" ? "Báo giá theo Cơ hội" : "Opportunity linked quotes"}</span>
                  <span>{kpis.linkedCount} / {kpis.totalCount}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full"
                    style={{ width: `${kpis.totalCount > 0 ? (kpis.linkedCount / kpis.totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-medium text-slate-500">
                  <span>{locale === "vi" ? "Báo giá trực tiếp" : "Direct customer quotes"}</span>
                  <span>{kpis.directCount} / {kpis.totalCount}</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full"
                    style={{ width: `${kpis.totalCount > 0 ? (kpis.directCount / kpis.totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Expiring soon notice if any */}
            {kpis.expiringSoonCount > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-105 flex items-center gap-1.5 text-[10px] text-rose-800 font-semibold animate-pulse">
                <AlertCircle size={12} className="text-rose-500 shrink-0" />
                <span>{locale === "vi" ? `Có ${kpis.expiringSoonCount} báo giá sắp hết giá trị trong vòng 7 ngày tới!` : `There are ${kpis.expiringSoonCount} quotes expiring in the next 7 days!`}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={() => setIsStatsOpen(false)} className="bg-indigo-600 hover:bg-indigo-700 font-medium px-4 py-2 text-xs">
              {locale === "vi" ? "Đóng" : "Dismiss"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
