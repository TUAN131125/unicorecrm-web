import { useEffect, useMemo, useState } from "react";

export const LEAD_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function useLeadPagination<T>(items: readonly T[], initialPageSize = 50) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const rangeStart = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = items.length === 0 ? 0 : Math.min(page * pageSize, items.length);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    pageItems,
    rangeStart,
    rangeEnd,
    totalItems: items.length,
    canGoPrevious: page > 1,
    canGoNext: page < pageCount,
  };
}
