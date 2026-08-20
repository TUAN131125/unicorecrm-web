import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Select } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { LEAD_PAGE_SIZE_OPTIONS } from "../hooks/useLeadPagination";

interface LeadPaginationBarProps {
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function LeadPaginationBar({
  page,
  pageCount,
  pageSize,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
}: LeadPaginationBarProps) {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;

  return (
    <nav
      aria-label={text("Phân trang danh sách Lead", "Lead list pagination")}
      className="flex flex-col gap-2 border-t border-slate-100 bg-white px-3 py-2.5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between"
    >
      <span aria-live="polite">
        {text("Hiển thị", "Showing")} <strong className="text-slate-700">{rangeStart}–{rangeEnd}</strong> {text("trên", "of")} <strong className="text-slate-700">{totalItems}</strong> Lead
      </span>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <Select
          aria-label={text("Số Lead mỗi trang", "Leads per page")}
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-10 min-w-[118px] text-[11px]"
        >
          {LEAD_PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option} / {text("trang", "page")}</option>)}
        </Select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 w-10 shrink-0 px-0"
          aria-label={text("Trang trước", "Previous page")}
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft size={13} />
        </Button>
        <span className="min-w-[74px] text-center font-semibold text-slate-700">
          {text("Trang", "Page")} {page}/{pageCount}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 w-10 shrink-0 px-0"
          aria-label={text("Trang sau", "Next page")}
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          <ChevronRight size={13} />
        </Button>
      </div>
    </nav>
  );
}
