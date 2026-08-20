import React from "react";
import { ArrowRight, Search, SlidersHorizontal, TableProperties } from "lucide-react";
import { Link } from "react-router-dom";

export interface ReportAnalysisRow {
  id: string;
  label: string;
  secondary?: string;
  count: number;
  value?: number;
  route?: string;
}

export interface ReportGroupOption {
  id: string;
  label: string;
}

interface ReportAnalysisTableProps {
  isVi: boolean;
  rows: ReportAnalysisRow[];
  groupBy: string;
  groupOptions: ReportGroupOption[];
  onGroupByChange(value: string): void;
  query: string;
  onQueryChange(value: string): void;
  sortBy: "count" | "value" | "label";
  onSortByChange(value: "count" | "value" | "label"): void;
  formatMoney(value: number): string;
}

export const ReportAnalysisTable: React.FC<ReportAnalysisTableProps> = ({
  isVi,
  rows,
  groupBy,
  groupOptions,
  onGroupByChange,
  query,
  onQueryChange,
  sortBy,
  onSortByChange,
  formatMoney,
}) => {
  const filteredRows = rows
    .filter((row) => `${row.label} ${row.secondary ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((left, right) => {
      if (sortBy === "label") return left.label.localeCompare(right.label);
      if (sortBy === "value") return (right.value ?? 0) - (left.value ?? 0);
      return right.count - left.count;
    });
  const totalCount = filteredRows.reduce((sum, row) => sum + row.count, 0);
  const totalValue = filteredRows.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const hasValue = filteredRows.some((row) => row.value !== undefined);

  return (
    <section data-guidance-id="reports.analysis.table" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><TableProperties size={16} /></span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-950">{isVi ? "Bảng phân tích đa chiều" : "Multi-dimensional analysis"}</h2>
              <p className="mt-1 crm-text-wrap text-xs font-medium text-slate-500">{isVi ? "Nhóm dữ liệu, tìm nhanh và sắp xếp trước khi drill-down hoặc xuất báo cáo." : "Group, search and sort data before drill-down or export."}</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="relative min-w-[190px] flex-1 xl:flex-none">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={isVi ? "Tìm trong kết quả" : "Search results"} className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            </label>
            <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-500">
              <SlidersHorizontal size={13} />
              <span>{isVi ? "Nhóm theo" : "Group by"}</span>
              <select value={groupBy} onChange={(event) => onGroupByChange(event.target.value)} className="bg-transparent text-xs font-semibold text-slate-800 outline-none">
                {groupOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-500">
              <span>{isVi ? "Sắp xếp" : "Sort"}</span>
              <select value={sortBy} onChange={(event) => onSortByChange(event.target.value as "count" | "value" | "label")} className="bg-transparent text-xs font-semibold text-slate-800 outline-none">
                <option value="count">{isVi ? "Số lượng" : "Count"}</option>
                <option value="value">{isVi ? "Giá trị" : "Value"}</option>
                <option value="label">{isVi ? "Tên" : "Name"}</option>
              </select>
            </label>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50 sm:grid-cols-3">
        <div className="px-5 py-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{isVi ? "Nhóm hiển thị" : "Visible groups"}</div><div className="mt-1 text-lg font-semibold text-slate-950">{filteredRows.length}</div></div>
        <div className="border-l border-slate-200 px-5 py-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{isVi ? "Tổng bản ghi" : "Total records"}</div><div className="mt-1 text-lg font-semibold text-slate-950">{totalCount}</div></div>
        <div className="col-span-2 border-t border-slate-200 px-5 py-3 sm:col-span-1 sm:border-l sm:border-t-0"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{isVi ? "Tổng giá trị" : "Total value"}</div><div className="mt-1 break-words text-lg font-semibold text-slate-950 [overflow-wrap:anywhere]">{hasValue ? formatMoney(totalValue) : "—"}</div></div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="px-5 py-14 text-center text-xs font-semibold text-slate-400">{isVi ? "Không có nhóm dữ liệu phù hợp." : "No matching data groups."}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[680px] w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-white text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <tr><th className="px-5 py-3">{isVi ? "Nhóm" : "Group"}</th><th className="px-5 py-3 text-right">{isVi ? "Số lượng" : "Count"}</th><th className="px-5 py-3 text-right">{isVi ? "Giá trị" : "Value"}</th><th className="px-5 py-3 text-right">{isVi ? "Chi tiết" : "Details"}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5"><div className="crm-text-wrap font-semibold text-slate-900">{row.label}</div>{row.secondary ? <div className="mt-0.5 crm-text-wrap text-[10px] font-medium text-slate-500">{row.secondary}</div> : null}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{row.count}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-900">{row.value === undefined ? "—" : formatMoney(row.value)}</td>
                  <td className="px-5 py-3.5 text-right">{row.route ? <Link to={row.route} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">{isVi ? "Mở nguồn" : "Open source"}<ArrowRight size={11} /></Link> : <span className="text-[10px] font-semibold text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
