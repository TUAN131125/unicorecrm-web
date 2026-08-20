import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Select } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { LIST_PAGE_SIZE_OPTIONS, type ListPaginationState } from "./useListPagination";

interface ListPaginationBarProps extends Omit<ListPaginationState<unknown>, "pageItems" | "canGoPrevious" | "canGoNext"> {
  itemLabelVi: string;
  itemLabelEn: string;
  ariaLabelVi?: string;
  ariaLabelEn?: string;
}

export const ListPaginationBar: React.FC<ListPaginationBarProps> = ({
  page,
  setPage,
  pageSize,
  setPageSize,
  pageCount,
  totalItems,
  rangeStart,
  rangeEnd,
  itemLabelVi,
  itemLabelEn,
  ariaLabelVi,
  ariaLabelEn,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  const itemLabel = isVi ? itemLabelVi : itemLabelEn;

  return (
    <nav
      aria-label={isVi ? (ariaLabelVi || `Phân trang danh sách ${itemLabelVi}`) : (ariaLabelEn || `${itemLabelEn} list pagination`)}
      data-list-pagination="canonical"
      className="flex min-w-0 flex-col gap-2 border-t border-slate-100 bg-white px-3 py-2.5 text-[11px] font-normal text-slate-500 sm:flex-row sm:items-center sm:justify-between"
    >
      <span aria-live="polite" className="crm-text-wrap">
        {text("Hiển thị", "Showing")} <strong className="font-medium text-slate-700">{rangeStart}–{rangeEnd}</strong> {text("trên", "of")} <strong className="font-medium text-slate-700">{totalItems}</strong> {itemLabel}
      </span>
      <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
        <Select
          aria-label={text(`Số ${itemLabelVi} mỗi trang`, `${itemLabelEn} per page`)}
          value={String(pageSize)}
          onChange={(event) => setPageSize(Number(event.target.value))}
          className="h-10 min-w-[118px] text-[11px]"
        >
          {LIST_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option} / {text("trang", "page")}</option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 w-10 shrink-0 px-0"
          aria-label={text("Trang trước", "Previous page")}
          disabled={page <= 1}
          onClick={() => setPage(Math.max(1, page - 1))}
        >
          <ChevronLeft size={13} />
        </Button>
        <span className="min-w-[74px] text-center font-medium text-slate-700">
          {text("Trang", "Page")} {page}/{pageCount}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 w-10 shrink-0 px-0"
          aria-label={text("Trang sau", "Next page")}
          disabled={page >= pageCount}
          onClick={() => setPage(Math.min(pageCount, page + 1))}
        >
          <ChevronRight size={13} />
        </Button>
      </div>
    </nav>
  );
};
