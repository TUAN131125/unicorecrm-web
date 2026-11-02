import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/i18n";

/** Catalog identity/selection only; commercial configuration belongs to the caller. */
export function ProductSelectionRow({ product, selected, onToggle, disabled, detail, trailing }: {
  product: { id: string; name: string; sku?: string; status: string };
  selected: boolean; onToggle(): void; disabled?: boolean; detail?: ReactNode; trailing?: ReactNode;
}) {
  const { locale } = useI18n();const vi = locale === "vi";
  return <button id={`picker-product-${product.id}`} type="button" aria-pressed={selected} disabled={disabled}
    onClick={onToggle} className={`mb-2 flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left last:mb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`}>
    <span className="min-w-0"><span className="block break-words text-sm font-medium text-slate-900">{product.name}</span>
      <span className="mt-1 block break-words text-[11px] text-slate-500">{detail ?? product.sku}</span>
      <span className="block text-[11px] text-slate-500">{product.status === "active" ? (vi ? "Đang hoạt động" : "Active") : (vi ? "Không khả dụng" : "Unavailable")}</span></span>
    <span className="flex shrink-0 items-center gap-3">{trailing}<span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 bg-white"}`}>{selected && <Check size={12} />}</span></span>
  </button>;
}
